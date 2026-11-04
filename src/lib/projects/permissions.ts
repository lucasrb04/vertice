import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { type ProjectRole, type ProjectStatus, projectMembers } from "@/db/schema";
import { NotFoundError } from "@/lib/auth/errors";
import { type AuthUser, authorizeProjectRole, type ProjectAccess } from "@/lib/auth/guards";

export const ALL_ROLES = ["OWNER", "ADMIN", "REVIEWER"] as const;
export const EDITOR_ROLES = ["OWNER", "ADMIN"] as const;
export const OWNER_ONLY = ["OWNER"] as const;

type Membership = { role: ProjectRole };

/**
 * Membership real do usuário no projeto. O guard devolve `membership: null` para todo SYSTEM_ADMIN
 * (ele passa sem consultar `project_members`), então aqui a membership dele é buscada no banco.
 */
export async function effectiveMembership(access: ProjectAccess): Promise<Membership | null> {
  if (access.membership || access.user.systemRole !== "SYSTEM_ADMIN") return access.membership;
  const [row] = await db
    .select({ role: projectMembers.role })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, access.project.id), eq(projectMembers.userId, access.user.id)))
    .limit(1);
  return row ?? null;
}

/** O que a interface oferece (spec §6.6): só com membership real e projeto ACTIVE. */
export function projectCapabilities(
  status: ProjectStatus,
  membership: Membership | null,
): { canEdit: boolean; canManageMembers: boolean; canLeave: boolean } {
  if (!membership || status !== "ACTIVE") return { canEdit: false, canManageMembers: false, canLeave: false };
  return {
    canEdit: (EDITOR_ROLES as readonly ProjectRole[]).includes(membership.role),
    canManageMembers: membership.role === "OWNER",
    canLeave: membership.role !== "OWNER",
  };
}

/**
 * Guard de toda escrita em projeto: exige membership real com um dos `roles` E projeto ACTIVE.
 * SYSTEM_ADMIN sem membership só lê, então recebe NotFoundError (a auditoria do acesso já foi gravada).
 */
export async function loadProjectForWrite(
  user: AuthUser,
  projectId: string,
  roles: readonly ProjectRole[],
): Promise<ProjectAccess & { membership: Membership }> {
  const access = await authorizeProjectRole(user, projectId, ALL_ROLES, { allowInactive: true });
  // Só uma membership real habilita escrita, inclusive para SYSTEM_ADMIN.
  const membership = await effectiveMembership(access);
  if (!membership || !roles.includes(membership.role) || access.project.status !== "ACTIVE") {
    throw new NotFoundError();
  }
  return { ...access, membership };
}
