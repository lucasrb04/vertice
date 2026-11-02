import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { applicationEvents, applications, courses, opportunities, projects, studentProfiles, users } from "@/db/schema";
import { NotFoundError } from "@/lib/auth/errors";
import { authorizeProjectRole, type AuthUser, type ProjectAccess } from "@/lib/auth/guards";
import { DomainError, fromZodError } from "@/lib/domain-errors";
import { ALL_ROLES, effectiveMembership } from "@/lib/projects/permissions";
import { lockProjectSearchDocuments } from "@/lib/search/index-documents";
import { moveSchema, type MoveInput } from "@/lib/validation/application";
import { APPLICATION_STATUSES, type ApplicationStatus } from "./labels";

export const PROJECT_READ_ONLY = "Este projeto não está ativo: o quadro é só leitura.";

export type BoardCard = {
  id: string;
  status: ApplicationStatus;
  name: string;
  email: string;
  courseName: string | null;
  currentSemester: number | null;
  appliedAt: Date;
  answerText: string | null;
  profileLink: string | null;
  history: { toStatus: ApplicationStatus; message: string | null; createdAt: Date }[];
  /** Candidatura de quem está vendo o quadro: ela não pode ser movida por ele (D45). */
  isOwn: boolean;
};

export type Board = {
  project: { id: string; name: string };
  opportunity: { id: string; title: string; customQuestion: string | null };
  canMove: boolean;
  columns: { status: ApplicationStatus; cards: BoardCard[] }[];
};

export type MoveResult = {
  moved: { applicationId: string; toStatus: ApplicationStatus; message: string | null }[];
  skipped: number;
};

const uuidSchema = z.uuid();

/**
 * Leitura e escrita do quadro exigem membership real. O guard deixa todo SYSTEM_ADMIN passar, e
 * candidato não é visível para quem não é da equipe: sem membership, mesmo erro de inexistente.
 */
async function loadBoardAccess(user: AuthUser, projectId: string, ipAddress?: string | null): Promise<ProjectAccess> {
  const access = await authorizeProjectRole(user, projectId, ALL_ROLES, { allowInactive: true, ipAddress });
  if (!(await effectiveMembership(access))) throw new NotFoundError();
  return access;
}

/** Quadro de um processo do projeto, com uma coluna por etapa. Inclui projeto arquivado, só leitura. */
export async function getBoard(
  user: AuthUser,
  projectId: string,
  opportunityId: string,
  opts: { ipAddress?: string | null } = {},
): Promise<Board> {
  const { project } = await loadBoardAccess(user, projectId, opts.ipAddress);
  if (!uuidSchema.safeParse(opportunityId).success) throw new NotFoundError();

  const [opportunity] = await db
    .select({ id: opportunities.id, title: opportunities.title, customQuestion: opportunities.customQuestion })
    .from(opportunities)
    .where(
      and(
        eq(opportunities.id, opportunityId),
        eq(opportunities.projectId, project.id),
        eq(opportunities.institutionId, project.institutionId),
      ),
    );
  if (!opportunity) throw new NotFoundError();

  const rows = await db
    .select({
      id: applications.id,
      userId: applications.userId,
      status: applications.status,
      name: users.name,
      email: users.email,
      courseName: courses.name,
      currentSemester: studentProfiles.currentSemester,
      appliedAt: applications.createdAt,
      answerText: applications.answerText,
      profileLink: applications.externalProfileLink,
    })
    .from(applications)
    .innerJoin(users, eq(users.id, applications.userId))
    .leftJoin(studentProfiles, eq(studentProfiles.userId, applications.userId))
    .leftJoin(courses, eq(courses.id, studentProfiles.courseId))
    .where(eq(applications.opportunityId, opportunity.id))
    .orderBy(asc(applications.createdAt), asc(applications.id));

  const events = await db
    .select({
      applicationId: applicationEvents.applicationId,
      toStatus: applicationEvents.toStatus,
      message: applicationEvents.message,
      createdAt: applicationEvents.createdAt,
    })
    .from(applicationEvents)
    .innerJoin(applications, eq(applications.id, applicationEvents.applicationId))
    .where(eq(applications.opportunityId, opportunity.id))
    .orderBy(asc(applicationEvents.createdAt), asc(applicationEvents.id));

  const historyOf = new Map<string, BoardCard["history"]>();
  for (const { applicationId, ...event } of events) {
    const list = historyOf.get(applicationId) ?? [];
    list.push(event);
    historyOf.set(applicationId, list);
  }

  return {
    project: { id: project.id, name: project.name },
    opportunity,
    canMove: project.status === "ACTIVE",
    columns: APPLICATION_STATUSES.map((status) => ({
      status,
      cards: rows
        .filter((r) => r.status === status)
        .map(({ userId, ...r }) => ({ ...r, history: historyOf.get(r.id) ?? [], isOwn: userId === user.id })),
    })),
  };
}

/**
 * Move candidaturas entre etapas. Processo encerrado continua movendo: a seleção ocorre depois do
 * prazo. A etapa de origem enviada é conferida com a linha travada; a que não confere, já está no
 * destino, não é deste processo ou é do próprio ator (D45) não muda e conta em `skipped`. Quem envia
 * e-mail usa `moved`.
 */
export async function moveApplications(user: AuthUser, input: MoveInput): Promise<MoveResult> {
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) throw fromZodError(parsed.error);
  const { projectId, opportunityId, items, toStatus, message } = parsed.data;
  const { project } = await loadBoardAccess(user, projectId);

  return db.transaction(async (tx) => {
    await lockProjectSearchDocuments(tx, project.id);
    // Relido sob a trava que `archiveProject` também toma: arquivar no meio não deixa escrita passar.
    const [current] = await tx.select({ status: projects.status }).from(projects).where(eq(projects.id, project.id));
    if (current?.status !== "ACTIVE") throw new DomainError("PROJECT_READ_ONLY", PROJECT_READ_ONLY);

    const [opportunity] = await tx
      .select({ id: opportunities.id })
      .from(opportunities)
      .where(
        and(
          eq(opportunities.id, opportunityId),
          eq(opportunities.projectId, project.id),
          eq(opportunities.institutionId, project.institutionId),
        ),
      );
    if (!opportunity) throw new NotFoundError();

    const expected = new Map(items.map((i) => [i.applicationId, i.fromStatus]));
    const rows = await tx
      .select({ id: applications.id, status: applications.status, userId: applications.userId })
      .from(applications)
      .where(and(inArray(applications.id, [...expected.keys()]), eq(applications.opportunityId, opportunity.id)))
      .orderBy(asc(applications.id))
      .for("update");

    const movable = rows.filter(
      (r) => r.status === expected.get(r.id) && r.status !== toStatus && r.userId !== user.id,
    );
    if (movable.length > 0) {
      await tx
        .update(applications)
        .set({
          status: toStatus,
          updatedByUserId: user.id,
          updatedAt: new Date(),
          // Sem mensagem, a última enviada continua valendo.
          ...(message ? { organizerFeedback: message } : {}),
        })
        .where(inArray(applications.id, movable.map((r) => r.id)));
      await tx.insert(applicationEvents).values(
        movable.map((r) => ({
          applicationId: r.id,
          fromStatus: r.status,
          toStatus,
          message,
          actorUserId: user.id,
        })),
      );
    }

    return {
      moved: movable.map((r) => ({ applicationId: r.id, toStatus, message })),
      skipped: items.length - movable.length,
    };
  });
}
