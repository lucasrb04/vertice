import { and, desc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { applicationEvents, applications, opportunities, projectMembers, projects, studentProfiles } from "@/db/schema";
import type { AuthUser } from "@/lib/auth/guards";
import { type ApplicationStatus, IN_PROGRESS_STATUSES } from "./labels";

/** Estado do aluno diante de um processo, para a página de candidatura. */
export async function getApplyContext(user: AuthUser, opportunityId: string) {
  const [[applied], [member], [profile]] = await Promise.all([
    db
      .select({ id: applications.id })
      .from(applications)
      .where(and(eq(applications.opportunityId, opportunityId), eq(applications.userId, user.id))),
    db
      .select({ userId: projectMembers.userId })
      .from(projectMembers)
      .innerJoin(opportunities, eq(opportunities.projectId, projectMembers.projectId))
      .where(and(eq(opportunities.id, opportunityId), eq(projectMembers.userId, user.id))),
    db
      .select({
        courseId: studentProfiles.courseId,
        currentSemester: studentProfiles.currentSemester,
        linkedinUrl: studentProfiles.linkedinUrl,
        githubUrl: studentProfiles.githubUrl,
        lattesUrl: studentProfiles.lattesUrl,
        portfolioUrl: studentProfiles.portfolioUrl,
      })
      .from(studentProfiles)
      .where(eq(studentProfiles.userId, user.id)),
  ]);
  return {
    alreadyApplied: Boolean(applied),
    isMember: Boolean(member),
    profile: profile ?? null,
  };
}

export type MyApplication = {
  id: string;
  opportunityTitle: string;
  /** Nulo quando o processo ou o projeto está oculto: a página pública devolveria 404. */
  opportunitySlug: string | null;
  projectName: string;
  /** Projeto arquivado com a candidatura ainda em andamento: o aluno não terá resultado por aqui. */
  projectArchived: boolean;
  status: ApplicationStatus;
  appliedAt: Date;
  messages: { toStatus: ApplicationStatus; message: string; createdAt: Date }[];
};

/** Candidaturas do próprio aluno, da mais recente para a mais antiga. Nunca devolve o ator dos eventos. */
export async function listMyApplications(user: AuthUser): Promise<MyApplication[]> {
  const rows = await db
    .select({
      id: applications.id,
      opportunityTitle: opportunities.title,
      opportunitySlug: opportunities.slug,
      opportunityStatus: opportunities.status,
      projectName: projects.name,
      projectStatus: projects.status,
      status: applications.status,
      appliedAt: applications.createdAt,
    })
    .from(applications)
    .innerJoin(opportunities, eq(opportunities.id, applications.opportunityId))
    .innerJoin(projects, eq(projects.id, opportunities.projectId))
    .where(and(eq(applications.userId, user.id), eq(opportunities.institutionId, user.institutionId)))
    .orderBy(desc(applications.createdAt), desc(applications.id));
  if (rows.length === 0) return [];

  // Os eventos vêm por candidatura do próprio usuário: a junção repete o filtro de dono.
  const events = await db
    .select({
      applicationId: applicationEvents.applicationId,
      toStatus: applicationEvents.toStatus,
      message: applicationEvents.message,
      createdAt: applicationEvents.createdAt,
    })
    .from(applicationEvents)
    .innerJoin(applications, eq(applications.id, applicationEvents.applicationId))
    .where(and(eq(applications.userId, user.id), isNotNull(applicationEvents.message)))
    .orderBy(desc(applicationEvents.createdAt), desc(applicationEvents.id));

  const byApplication = new Map<string, MyApplication["messages"]>();
  for (const e of events) {
    const list = byApplication.get(e.applicationId) ?? [];
    list.push({ toStatus: e.toStatus, message: e.message!, createdAt: e.createdAt });
    byApplication.set(e.applicationId, list);
  }
  return rows.map(({ opportunityStatus, opportunitySlug, projectStatus, ...row }) => ({
    ...row,
    projectArchived: projectStatus === "ARCHIVED" && IN_PROGRESS_STATUSES.includes(row.status),
    opportunitySlug:
      opportunityStatus === "UNDER_REVIEW" || !["ACTIVE", "ARCHIVED"].includes(projectStatus) ? null : opportunitySlug,
    messages: byApplication.get(row.id) ?? [],
  }));
}

/** Id da candidatura do usuário a um processo, para o botão "Ver minha candidatura". */
export async function getMyApplicationId(userId: string, opportunityId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: applications.id })
    .from(applications)
    .where(and(eq(applications.userId, userId), eq(applications.opportunityId, opportunityId)));
  return row?.id ?? null;
}
