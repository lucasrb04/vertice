import type { ProjectRole } from "@/db/schema";
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
  const { membership } = access;
  if (!membership || !roles.includes(membership.role) || access.project.status !== "ACTIVE") {
    throw new NotFoundError();
  }
  return { ...access, membership };
}
