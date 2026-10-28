import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { projectMembers, type ProjectRole } from "@/db/schema";
import { NotFoundError } from "@/lib/auth/errors";
import { authorizeProjectRole, type AuthUser, type ProjectAccess } from "@/lib/auth/guards";

export const ALL_ROLES = ["OWNER", "ADMIN", "REVIEWER"] as const;
export const EDITOR_ROLES = ["OWNER", "ADMIN"] as const;
export const OWNER_ONLY = ["OWNER"] as const;

/**
 * Guard de toda escrita em projeto: exige membership real com um dos `roles` E projeto ACTIVE.
 * SYSTEM_ADMIN sem membership só lê, então recebe NotFoundError (a auditoria do acesso já foi gravada).
 */
export async function loadProjectForWrite(
  user: AuthUser,
  projectId: string,
  roles: readonly ProjectRole[],
): Promise<ProjectAccess & { membership: { role: ProjectRole } }> {
  const access = await authorizeProjectRole(user, projectId, ALL_ROLES, { allowInactive: true });
  let membership = access.membership;
  if (!membership && user.systemRole === "SYSTEM_ADMIN") {
    // authorizeProjectRole não consulta project_members para SYSTEM_ADMIN; só uma membership real habilita escrita.
    const [row] = await db
      .select({ role: projectMembers.role })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, access.project.id), eq(projectMembers.userId, user.id)))
      .limit(1);
    membership = row ?? null;
  }
  if (!membership || !roles.includes(membership.role) || access.project.status !== "ACTIVE") {
    throw new NotFoundError();
  }
  return { ...access, membership };
}
