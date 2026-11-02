import { and, count, eq } from "drizzle-orm";
import { z } from "zod";
import { db, type Tx } from "@/db";
import { applications, opportunities, opportunityTags, tags as tagsTable, type ProjectStatus } from "@/db/schema";
import { NotFoundError } from "@/lib/auth/errors";
import type { AuthUser } from "@/lib/auth/guards";
import { DomainError, fromZodError } from "@/lib/domain-errors";
import { EDITOR_ROLES, loadProjectForWrite } from "@/lib/projects/permissions";
import { assertCoursesBelongToInstitution, insertOpportunity } from "@/lib/projects/service";
import { lockProjectSearchDocuments, refreshSearchDocument, scheduleVocabularyRebuild } from "@/lib/search/index-documents";
import { syncOpportunityTags } from "@/lib/tags/service";
import { dayFromDeadline, deadlineFromDay, todayInSaoPaulo } from "@/lib/time";
import {
  TAG_GROUPS,
  makeOpportunitySchema,
  type OpportunityFormValues,
  type OpportunityInput,
} from "@/lib/validation/opportunity";
import { isOpportunityOpen } from "./status";

export const OPPORTUNITY_CLOSED = "Este processo já foi encerrado e não pode ser alterado. Duplique-o para abrir um novo ciclo.";

export const HAS_APPLICATIONS = "Este processo já tem candidaturas.";

export const QUESTION_LOCKED = "A pergunta não pode mudar depois das primeiras candidaturas.";

type Opts = { now?: Date };

function parseInput(input: unknown, now: Date): OpportunityInput {
  const parsed = makeOpportunitySchema({ today: todayInSaoPaulo(now) }).safeParse(input);
  if (!parsed.success) throw fromZodError(parsed.error);
  return parsed.data;
}

const uuidSchema = z.uuid();

const normalizeQuestion = (question: string | null) => question?.trim() || null;

async function countApplications(client: Pick<Tx, "select">, opportunityId: string): Promise<number> {
  const [{ n }] = await client.select({ n: count() }).from(applications).where(eq(applications.opportunityId, opportunityId));
  return n;
}

/** Trava a linha do processo (que precisa ser do projeto da rota) e exige que ainda esteja aberto. */
async function lockOpenOpportunity(
  tx: Tx,
  project: { id: string; status: ProjectStatus },
  opportunityId: string,
  now: Date,
) {
  if (!uuidSchema.safeParse(opportunityId).success) throw new NotFoundError();
  const [row] = await tx
    .select()
    .from(opportunities)
    .where(and(eq(opportunities.id, opportunityId), eq(opportunities.projectId, project.id)))
    .for("update");
  if (!row) throw new NotFoundError();
  if (!isOpportunityOpen(row, project.status, now)) throw new DomainError("OPPORTUNITY_CLOSED", OPPORTUNITY_CLOSED);
  return row;
}

export async function createOpportunity(
  user: AuthUser,
  projectId: string,
  input: unknown,
  opts: Opts = {},
): Promise<{ opportunityId: string }> {
  const { project } = await loadProjectForWrite(user, projectId, EDITOR_ROLES);
  const data = parseInput(input, opts.now ?? new Date());
  const opportunityId = await db.transaction((tx) => insertOpportunity(tx, { user, projectId: project.id }, data));
  await scheduleVocabularyRebuild(project.institutionId);
  return { opportunityId };
}

export async function updateOpportunity(
  user: AuthUser,
  projectId: string,
  opportunityId: string,
  input: unknown,
  opts: Opts = {},
): Promise<void> {
  const now = opts.now ?? new Date();
  const { project } = await loadProjectForWrite(user, projectId, EDITOR_ROLES);
  const data = parseInput(input, now);

  await db.transaction(async (tx) => {
    await lockProjectSearchDocuments(tx, project.id);
    const row = await lockOpenOpportunity(tx, project, opportunityId, now);
    await assertCoursesBelongToInstitution(tx, row.institutionId, data.targetCourseIds);

    const turningOff = row.internalSelectionEnabled && !data.internalSelectionEnabled;
    const questionChanged = normalizeQuestion(row.customQuestion) !== normalizeQuestion(data.customQuestion);
    if ((turningOff || questionChanged) && (await countApplications(tx, row.id)) > 0) {
      throw new DomainError("HAS_APPLICATIONS", turningOff ? HAS_APPLICATIONS : QUESTION_LOCKED);
    }

    // slug, projectId, institutionId, status, contadores e closedAt ficam de fora de propósito.
    const { tags, scholarshipValueCents, deadline, ...rest } = data;
    await tx
      .update(opportunities)
      .set({ ...rest, scholarshipValueCents, deadlineAt: deadlineFromDay(deadline), updatedAt: now })
      .where(and(eq(opportunities.id, row.id), eq(opportunities.projectId, project.id)));
    await syncOpportunityTags(tx, { institutionId: row.institutionId, userId: user.id, opportunityId: row.id }, tags);
    await refreshSearchDocument(tx, row.id);
  });
  await scheduleVocabularyRebuild(project.institutionId);
}

export async function closeOpportunity(
  user: AuthUser,
  projectId: string,
  opportunityId: string,
  opts: Opts = {},
): Promise<void> {
  const now = opts.now ?? new Date();
  const { project } = await loadProjectForWrite(user, projectId, EDITOR_ROLES);
  await db.transaction(async (tx) => {
    await lockProjectSearchDocuments(tx, project.id);
    const row = await lockOpenOpportunity(tx, project, opportunityId, now);
    await tx
      .update(opportunities)
      .set({ status: "CLOSED", closedAt: now, updatedAt: now })
      .where(and(eq(opportunities.id, row.id), eq(opportunities.projectId, project.id)));
    await refreshSearchDocument(tx, row.id);
  });
  await scheduleVocabularyRebuild(project.institutionId);
}

function formatCents(cents: number): string {
  const s = String(cents).padStart(3, "0");
  return `${s.slice(0, -2)},${s.slice(-2)}`;
}

/**
 * Valores do formulário para editar ou duplicar um processo. As tags vão como refs `{ id }` (o
 * contrato do schema) e os nomes vão à parte em `tagNames` (id → nome), só para exibição.
 */
export async function getOpportunityFormValues(
  user: AuthUser,
  projectId: string,
  opportunityId: string,
  mode: "edit" | "duplicate",
  opts: Opts = {},
): Promise<{
  values: OpportunityFormValues;
  tagNames: Record<string, string>;
  isOpen: boolean;
  /** Só no modo de edição: a duplicata é um processo novo, sem candidaturas. */
  hasApplications: boolean;
}> {
  const { project } = await loadProjectForWrite(user, projectId, EDITOR_ROLES);
  if (!uuidSchema.safeParse(opportunityId).success) throw new NotFoundError();
  const [o] = await db
    .select()
    .from(opportunities)
    .where(and(eq(opportunities.id, opportunityId), eq(opportunities.projectId, project.id)));
  if (!o) throw new NotFoundError();

  const tagRows = await db
    .select({ tagId: opportunityTags.tagId, relationType: opportunityTags.relationType, name: tagsTable.name })
    .from(opportunityTags)
    .innerJoin(tagsTable, eq(tagsTable.id, opportunityTags.tagId))
    .where(eq(opportunityTags.opportunityId, o.id));
  const tags: Record<(typeof TAG_GROUPS)[number], { id: string }[]> = { THEME: [], DESIRED_SKILL: [], DEVELOPED_SKILL: [] };
  const tagNames: Record<string, string> = {};
  for (const r of tagRows) {
    tags[r.relationType].push({ id: r.tagId });
    tagNames[r.tagId] = r.name;
  }

  const dup = mode === "duplicate";
  const values: OpportunityFormValues = {
    title: o.title,
    description: o.description,
    roleArea: o.roleArea ?? "",
    vacanciesCount: o.vacanciesCount ?? 1,
    deadline: dup ? "" : dayFromDeadline(o.deadlineAt),
    externalUrl: o.externalUrl ?? "",
    internalSelectionEnabled: o.internalSelectionEnabled,
    customQuestion: o.customQuestion ?? "",
    scholarshipType: o.scholarshipType,
    fundingAgency: o.fundingAgency ?? "",
    scholarshipValue: o.scholarshipValueCents === null ? "" : formatCents(o.scholarshipValueCents),
    weeklyHours: o.weeklyHours,
    applicationsOpenOn: dup ? "" : (o.applicationsOpenOn ?? ""),
    interviewStartsOn: dup ? "" : (o.interviewStartsOn ?? ""),
    interviewEndsOn: dup ? "" : (o.interviewEndsOn ?? ""),
    resultOn: dup ? "" : (o.resultOn ?? ""),
    activitiesStartOn: dup ? "" : (o.activitiesStartOn ?? ""),
    targetCourseIds: o.targetCourseIds,
    minSemester: o.minSemester,
    availabilityRequirement: o.availabilityRequirement ?? "",
    noOtherScholarship: o.noOtherScholarship,
    tags,
  };
  return {
    values,
    tagNames,
    isOpen: isOpportunityOpen(o, project.status, opts.now ?? new Date()),
    hasApplications: !dup && (await countApplications(db, o.id)) > 0,
  };
}
