import { and, eq, gt, inArray, like, sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { courses, opportunities, projectMembers, projects } from "@/db/schema";
import type { AuthUser } from "@/lib/auth/guards";
import { isUniqueViolation } from "@/lib/db-errors";
import { DomainError, fromZodError, RateLimitError, ValidationError } from "@/lib/domain-errors";
import {
  lockProjectSearchDocuments,
  refreshProjectSearchDocuments,
  refreshSearchDocument,
  scheduleVocabularyRebuild,
} from "@/lib/search/index-documents";
import { logAudit } from "@/lib/security/audit";
import { opportunitySlug, projectSlugBase } from "@/lib/slug";
import { syncOpportunityTags } from "@/lib/tags/service";
import { deadlineFromDay, todayInSaoPaulo } from "@/lib/time";
import type { OpportunityInput } from "@/lib/validation/opportunity";
import { makeWizardSchema } from "@/lib/validation/opportunity";
import { type ProjectInput, projectInputSchema } from "@/lib/validation/project";
import { EDITOR_ROLES, loadProjectForWrite, OWNER_ONLY } from "./permissions";

export const PROJECT_RATE_LIMIT = "Você atingiu o limite de 3 projetos criados por dia. Tente de novo amanhã.";
export const PROJECT_NOT_ACTIVE = "Este projeto não está mais ativo e não pode ser alterado.";

const projectNotActive = () => new DomainError("PROJECT_NOT_ACTIVE", PROJECT_NOT_ACTIVE);

/**
 * Abre a escrita no projeto: toma a trava que a moderação e o arquivamento também tomam e relê o
 * status sob ela. `loadProjectForWrite` checa antes da trava; sem esta releitura, um projeto ocultado
 * ou arquivado no meio do caminho ainda receberia a gravação.
 */
export async function lockActiveProject(tx: Tx, projectId: string): Promise<void> {
  await lockProjectSearchDocuments(tx, projectId);
  const [row] = await tx.select({ status: projects.status }).from(projects).where(eq(projects.id, projectId));
  if (row?.status !== "ACTIVE") throw projectNotActive();
}

const MAX_PROJECTS_PER_DAY = 3;
const DAY_MS = 24 * 3_600_000;

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

/** Menor sufixo livre a partir de `minSuffix`: base, base-2, base-3… */
async function nextFreeProjectSlug(tx: Tx, institutionId: string, base: string, minSuffix = 1): Promise<string> {
  const rows = await tx
    .select({ slug: projects.slug })
    .from(projects)
    .where(and(eq(projects.institutionId, institutionId), like(projects.slug, `${escapeLike(base)}%`)));
  const taken = new Set(rows.map((r) => r.slug));
  for (let n = minSuffix; ; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

function suffixOf(slug: string, base: string): number {
  return slug === base ? 1 : Number(slug.slice(base.length + 1)) || 1;
}

export async function assertCoursesBelongToInstitution(
  tx: Tx,
  institutionId: string,
  courseIds: string[],
): Promise<void> {
  if (courseIds.length === 0) return;
  const found = await tx
    .select({ id: courses.id })
    .from(courses)
    .where(and(eq(courses.institutionId, institutionId), inArray(courses.id, courseIds)));
  if (found.length !== new Set(courseIds).size) {
    throw new ValidationError({ targetCourseIds: ["Curso inválido."] });
  }
}

export async function insertOpportunity(
  tx: Tx,
  ctx: { user: AuthUser; projectId: string },
  input: OpportunityInput,
): Promise<string> {
  const { user, projectId } = ctx;

  await lockActiveProject(tx, projectId);
  await assertCoursesBelongToInstitution(tx, user.institutionId, input.targetCourseIds);

  const { tags, scholarshipValueCents, deadline, ...rest } = input;
  const [row] = await tx
    .insert(opportunities)
    .values({
      ...rest,
      institutionId: user.institutionId,
      projectId,
      slug: opportunitySlug(input.title),
      scholarshipValueCents,
      deadlineAt: deadlineFromDay(deadline),
    })
    .returning({ id: opportunities.id });

  await syncOpportunityTags(tx, { institutionId: user.institutionId, userId: user.id, opportunityId: row.id }, tags);
  await refreshSearchDocument(tx, row.id);
  return row.id;
}

export async function createProjectWithOpportunity(
  user: AuthUser,
  input: unknown,
  opts: { now?: Date } = {},
): Promise<{ projectId: string; opportunityId: string }> {
  const now = opts.now ?? new Date();
  const parsed = makeWizardSchema({ today: todayInSaoPaulo(now) }).safeParse(input);
  if (!parsed.success) throw fromZodError(parsed.error);
  const { project: projectInput, opportunity } = parsed.data;

  const created = await db.transaction(async (tx) => {
    // Serializa criações do mesmo usuário para o limite diário não ser furado por corrida.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`project-create:${user.id}`}))`);

    const [{ count }] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(projects)
      .innerJoin(projectMembers, eq(projectMembers.projectId, projects.id))
      .where(
        and(
          eq(projectMembers.userId, user.id),
          eq(projectMembers.role, "OWNER"),
          gt(projects.createdAt, new Date(now.getTime() - DAY_MS)),
        ),
      );
    if (count >= MAX_PROJECTS_PER_DAY) throw new RateLimitError(PROJECT_RATE_LIMIT);

    const base = projectSlugBase(projectInput.name);
    let slug = await nextFreeProjectSlug(tx, user.institutionId, base);
    let projectId: string | undefined;
    for (let attempt = 0; attempt < 2 && !projectId; attempt++) {
      try {
        // Savepoint: uma violação de unicidade não pode abortar a transação inteira.
        const [row] = await tx.transaction((sp) =>
          sp
            .insert(projects)
            .values({ ...projectInput, institutionId: user.institutionId, slug })
            .returning({ id: projects.id }),
        );
        projectId = row.id;
      } catch (err) {
        if (attempt === 1 || !isUniqueViolation(err)) throw err;
        slug = await nextFreeProjectSlug(tx, user.institutionId, base, suffixOf(slug, base) + 1);
      }
    }
    if (!projectId) throw new Error("PROJECT_INSERT_FAILED");

    await tx.insert(projectMembers).values({ projectId, userId: user.id, role: "OWNER" });
    const opportunityId = await insertOpportunity(tx, { user, projectId }, opportunity);
    return { projectId, opportunityId };
  });
  await scheduleVocabularyRebuild(user.institutionId);
  return created;
}

export async function updateProject(user: AuthUser, projectId: string, input: unknown): Promise<void> {
  const { project } = await loadProjectForWrite(user, projectId, EDITOR_ROLES);
  const parsed = projectInputSchema.safeParse(input);
  if (!parsed.success) throw fromZodError(parsed.error);
  const data: ProjectInput = parsed.data;

  await db.transaction(async (tx) => {
    await lockProjectSearchDocuments(tx, project.id);
    // slug, institutionId e status ficam de fora de propósito. Só grava se, sob a trava, ainda estiver ativo.
    const changed = await tx
      .update(projects)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(projects.id, project.id),
          eq(projects.institutionId, project.institutionId),
          eq(projects.status, "ACTIVE"),
        ),
      )
      .returning({ id: projects.id });
    if (changed.length === 0) throw projectNotActive();
    await refreshProjectSearchDocuments(tx, project.id);
  });
  await scheduleVocabularyRebuild(project.institutionId);
}

export async function archiveProject(user: AuthUser, projectId: string): Promise<void> {
  const { project } = await loadProjectForWrite(user, projectId, OWNER_ONLY);
  await db.transaction(async (tx) => {
    await lockProjectSearchDocuments(tx, project.id);
    // Ocultado pela moderação entre a checagem e a trava: não sobrescreve o estado da moderação.
    const changed = await tx
      .update(projects)
      .set({ status: "ARCHIVED", updatedAt: new Date() })
      .where(
        and(
          eq(projects.id, project.id),
          eq(projects.institutionId, project.institutionId),
          eq(projects.status, "ACTIVE"),
        ),
      )
      .returning({ id: projects.id });
    if (changed.length === 0) throw projectNotActive();
    await refreshProjectSearchDocuments(tx, project.id);
    await logAudit(
      {
        institutionId: project.institutionId,
        actorUserId: user.id,
        action: "PROJECT_ARCHIVED",
        targetType: "PROJECT",
        targetId: project.id,
      },
      tx,
    );
  });
  await scheduleVocabularyRebuild(project.institutionId);
}
