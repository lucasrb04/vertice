import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { applications, opportunities, projectMembers, studentProfiles } from "@/db/schema";
import type { AuthUser } from "@/lib/auth/guards";

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
