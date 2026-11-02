import { and, asc, count, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { applications, courses, opportunities, projectMembers, projects, users } from "@/db/schema";
import type { ProjectCategory, ProjectRole, ProjectStatus } from "@/db/schema";
import type { AuthUser, ProjectAccess } from "@/lib/auth/guards";
import { closedOnDate, isOpportunityOpen } from "@/lib/opportunities/status";

export async function listMyProjects(user: AuthUser): Promise<
  Array<{
    id: string;
    name: string;
    acronym: string | null;
    category: ProjectCategory;
    status: ProjectStatus;
    role: ProjectRole;
  }>
> {
  return db
    .select({
      id: projects.id,
      name: projects.name,
      acronym: projects.acronym,
      category: projects.category,
      status: projects.status,
      role: projectMembers.role,
    })
    .from(projectMembers)
    .innerJoin(projects, eq(projects.id, projectMembers.projectId))
    .where(and(eq(projectMembers.userId, user.id), eq(projects.institutionId, user.institutionId)))
    .orderBy(asc(projects.name));
}

export async function listProjectsUserCanPublishIn(user: AuthUser): Promise<Array<{ id: string; name: string }>> {
  return db
    .select({ id: projects.id, name: projects.name })
    .from(projectMembers)
    .innerJoin(projects, eq(projects.id, projectMembers.projectId))
    .where(
      and(
        eq(projectMembers.userId, user.id),
        inArray(projectMembers.role, ["OWNER", "ADMIN"]),
        eq(projects.status, "ACTIVE"),
        eq(projects.institutionId, user.institutionId),
      ),
    )
    .orderBy(asc(projects.name));
}

export type PanelOpportunity = {
  id: string;
  title: string;
  deadlineAt: Date;
  closedOn: Date | null;
  vacanciesCount: number;
  hasExternalUrl: boolean;
  internalSelectionEnabled: boolean;
  /** Zero para quem não tem membership real: a contagem é dado da equipe. */
  applicationsCount: number;
};

export async function getProjectPanel(
  access: ProjectAccess,
  now: Date = new Date(),
): Promise<{ open: PanelOpportunity[]; closed: PanelOpportunity[] }> {
  const rows = await db
    .select()
    .from(opportunities)
    .where(and(eq(opportunities.projectId, access.project.id), eq(opportunities.institutionId, access.project.institutionId)));

  const counts = access.membership
    ? await db
        .select({ opportunityId: applications.opportunityId, total: count() })
        .from(applications)
        .innerJoin(opportunities, eq(opportunities.id, applications.opportunityId))
        .where(eq(opportunities.projectId, access.project.id))
        .groupBy(applications.opportunityId)
    : [];
  const countByOpportunity = new Map(counts.map((c) => [c.opportunityId, c.total]));

  const open: PanelOpportunity[] = [];
  const closed: PanelOpportunity[] = [];
  for (const o of rows) {
    const isOpen = isOpportunityOpen(o, access.project.status, now);
    const item: PanelOpportunity = {
      id: o.id,
      title: o.title,
      deadlineAt: o.deadlineAt,
      // Projeto inativo com processo ainda em andamento: sem data de encerramento (spec §6.3).
      closedOn: isOpen ? null : closedOnDate(o, now),
      vacanciesCount: o.vacanciesCount ?? 1,
      hasExternalUrl: o.externalUrl !== null,
      internalSelectionEnabled: o.internalSelectionEnabled,
      applicationsCount: countByOpportunity.get(o.id) ?? 0,
    };
    (isOpen ? open : closed).push(item);
  }
  open.sort((a, b) => a.deadlineAt.getTime() - b.deadlineAt.getTime());
  closed.sort((a, b) => {
    if (a.closedOn && b.closedOn) {
      const diff = b.closedOn.getTime() - a.closedOn.getTime();
      if (diff !== 0) return diff;
    } else if (a.closedOn || b.closedOn) {
      return a.closedOn ? -1 : 1; // sem data de encerramento por último
    }
    return b.deadlineAt.getTime() - a.deadlineAt.getTime();
  });
  return { open, closed };
}

export async function listMembers(
  access: ProjectAccess,
): Promise<Array<{ userId: string; name: string; email: string; role: ProjectRole }>> {
  return db
    .select({ userId: users.id, name: users.name, email: users.email, role: projectMembers.role })
    .from(projectMembers)
    .innerJoin(users, eq(users.id, projectMembers.userId))
    .where(eq(projectMembers.projectId, access.project.id))
    .orderBy(sql`(${projectMembers.role} = 'OWNER') desc`, asc(users.name));
}

export async function listCourses(institutionId: string): Promise<Array<{ id: string; code: string; name: string }>> {
  return db
    .select({ id: courses.id, code: courses.code, name: courses.name })
    .from(courses)
    .where(eq(courses.institutionId, institutionId))
    .orderBy(asc(courses.name));
}
