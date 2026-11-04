import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import type { Project, ProjectRole, User } from "@/db/schema";
import { projectMembers, projects, users } from "@/db/schema";
import { getRequestIp, logAudit } from "@/lib/security/audit";
import { NotFoundError, UnauthorizedError } from "./errors";
import { getSessionUser } from "./session";

export type AuthUser = Pick<User, "id" | "name" | "email" | "institutionId" | "systemRole">;
export type ProjectAccess = { user: AuthUser; project: Project; membership: { role: ProjectRole } | null };

const uuidSchema = z.string().uuid();

/** Relê o usuário do banco a cada chamada: banimento vale na próxima requisição. */
export async function resolveActiveUser(sessionUser: { id: string } | null): Promise<AuthUser> {
  if (!sessionUser) throw new UnauthorizedError("NO_SESSION");
  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      institutionId: users.institutionId,
      systemRole: users.systemRole,
      isBanned: users.isBanned,
    })
    .from(users)
    .where(eq(users.id, sessionUser.id))
    .limit(1);
  if (!row) throw new UnauthorizedError("NO_SESSION");
  if (row.isBanned) throw new UnauthorizedError("BANNED");
  return { id: row.id, name: row.name, email: row.email, institutionId: row.institutionId, systemRole: row.systemRole };
}

export async function authorizeProjectRole(
  user: AuthUser,
  projectId: string,
  roles: readonly ProjectRole[],
  opts: { allowInactive?: boolean; ipAddress?: string | null } = {},
): Promise<ProjectAccess> {
  if (!uuidSchema.safeParse(projectId).success) throw new NotFoundError();

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.institutionId, user.institutionId)))
    .limit(1);
  if (!project) throw new NotFoundError();

  // SYSTEM_ADMIN da mesma instituição passa sempre, com trilha de auditoria.
  if (user.systemRole === "SYSTEM_ADMIN") {
    await logAudit({
      institutionId: project.institutionId,
      actorUserId: user.id,
      action: "ADMIN_MAINTENANCE_ACCESS",
      targetType: "PROJECT",
      targetId: project.id,
      ipAddress: opts.ipAddress ?? null,
    });
    return { user, project, membership: null };
  }

  if (project.status !== "ACTIVE" && !opts.allowInactive) throw new NotFoundError();

  const [membership] = await db
    .select({ role: projectMembers.role })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, user.id)))
    .limit(1);
  if (!membership || !roles.includes(membership.role)) throw new NotFoundError();

  return { user, project, membership };
}

export async function authorizeSystemAdmin(
  user: AuthUser | null,
  ctx: { path: string; ipAddress: string | null },
): Promise<AuthUser> {
  if (user?.systemRole === "SYSTEM_ADMIN") return user;
  if (user) {
    await logAudit({
      institutionId: user.institutionId,
      actorUserId: user.id,
      action: "ADMIN_ACCESS_DENIED",
      targetType: "ROUTE",
      targetId: null,
      metadata: { path: ctx.path },
      ipAddress: ctx.ipAddress,
    });
  }
  throw new NotFoundError();
}

// --- Wrappers de request (dependem do runtime do Next) ---

export async function requireAuth(): Promise<AuthUser> {
  return resolveActiveUser(await getSessionUser());
}

/**
 * Para Server Components: sem sessão → /entrar (com `?next=` se `nextPath` vier); banido →
 * /entrar?error=ACCOUNT_SUSPENDED. `nextPath` precisa ser um caminho interno fixo da página.
 */
export async function requireAuthPage(nextPath?: string): Promise<AuthUser> {
  // Resolve dentro do try e age fora dele: redirect() lança e não pode ser engolido por um catch.
  let user: AuthUser | null = null;
  let redirectTo = nextPath ? `/entrar?next=${encodeURIComponent(nextPath)}` : "/entrar";
  try {
    user = await requireAuth();
  } catch (err) {
    if (!(err instanceof UnauthorizedError)) throw err;
    if (err.reason === "BANNED") redirectTo = "/entrar?error=ACCOUNT_SUSPENDED";
  }
  if (!user) redirect(redirectTo);
  return user;
}

/** Para Server Actions e route handlers. Lança `UnauthorizedError` ou `NotFoundError`. */
export async function requireProjectRole(
  projectId: string,
  roles: readonly ProjectRole[],
  opts: { allowInactive?: boolean } = {},
): Promise<ProjectAccess> {
  const user = await requireAuth();
  const ipAddress = getRequestIp(await headers());
  return authorizeProjectRole(user, projectId, roles, { ...opts, ipAddress });
}

/** Para Server Components: como `requireAuthPage` na falta de sessão; sem permissão → notFound(). */
export async function requireProjectRolePage(
  projectId: string,
  roles: readonly ProjectRole[],
  opts: { allowInactive?: boolean } = {},
): Promise<ProjectAccess> {
  const user = await requireAuthPage();
  const ipAddress = getRequestIp(await headers());
  let access: ProjectAccess | null = null;
  try {
    access = await authorizeProjectRole(user, projectId, roles, { ...opts, ipAddress });
  } catch (err) {
    if (!(err instanceof NotFoundError)) throw err;
  }
  if (!access) notFound();
  return access;
}

/**
 * Para Server Actions e route handlers. Sem sessão ou banido → `UnauthorizedError`; autenticado
 * sem SYSTEM_ADMIN → `NotFoundError`, com ADMIN_ACCESS_DENIED auditado (via authorizeSystemAdmin).
 */
export async function requireSystemAdmin(path: string): Promise<AuthUser> {
  const user = await requireAuth();
  return authorizeSystemAdmin(user, { path, ipAddress: getRequestIp(await headers()) });
}

/** Para Server Components: qualquer recusa (inclusive sem sessão) vira notFound(), sem redirecionar. */
export async function requireSystemAdminPage(path: string): Promise<AuthUser> {
  let user: AuthUser | null = null;
  try {
    user = await requireAuth();
  } catch (err) {
    if (!(err instanceof UnauthorizedError)) throw err;
  }
  let admin: AuthUser | null = null;
  try {
    admin = await authorizeSystemAdmin(user, { path, ipAddress: getRequestIp(await headers()) });
  } catch (err) {
    if (!(err instanceof NotFoundError)) throw err;
  }
  if (!admin) notFound();
  return admin;
}
