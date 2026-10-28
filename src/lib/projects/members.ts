import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { projectMembers, users } from "@/db/schema";
import { NotFoundError } from "@/lib/auth/errors";
import type { AuthUser } from "@/lib/auth/guards";
import { DomainError, fromZodError } from "@/lib/domain-errors";
import { ALL_ROLES, OWNER_ONLY, loadProjectForWrite } from "@/lib/projects/permissions";
import { logAudit } from "@/lib/security/audit";

/** Mesma mensagem para e-mail inexistente, banido ou de outra instituição: não revela nenhum dos três. */
export const MEMBER_NO_ACCOUNT =
  "Essa pessoa ainda não entrou no Vértice. Peça para ela entrar uma vez com a conta da UNIFEI e tente de novo.";

export const addMemberInputSchema = z.object({
  email: z.email().trim().toLowerCase(),
  role: z.enum(["ADMIN", "REVIEWER"]),
});

const assignableRoleSchema = addMemberInputSchema.shape.role;
const uuidSchema = z.string().uuid();

function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } } | null;
  return e?.code === "23505" || e?.cause?.code === "23505";
}

function requireUuid(value: string): string {
  if (!uuidSchema.safeParse(value).success) throw new NotFoundError();
  return value;
}

export async function addMember(user: AuthUser, projectId: string, input: unknown): Promise<void> {
  const parsed = addMemberInputSchema.safeParse(input);
  if (!parsed.success) throw fromZodError(parsed.error);
  const { project } = await loadProjectForWrite(user, projectId, OWNER_ONLY);

  const [target] = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(sql`lower(${users.email})`, parsed.data.email),
        eq(users.institutionId, project.institutionId),
        eq(users.isBanned, false),
      ),
    )
    .limit(1);
  if (!target) throw new DomainError("MEMBER_NO_ACCOUNT", MEMBER_NO_ACCOUNT);

  const alreadyMember = new DomainError("ALREADY_MEMBER", "Essa pessoa já faz parte do projeto.");
  try {
    await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: projectMembers.id })
        .from(projectMembers)
        .where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, target.id)))
        .limit(1);
      if (existing) throw alreadyMember;
      await tx.insert(projectMembers).values({ projectId: project.id, userId: target.id, role: parsed.data.role });
      await logAudit(
        {
          institutionId: project.institutionId,
          actorUserId: user.id,
          action: "PROJECT_MEMBER_ADDED",
          targetType: "PROJECT",
          targetId: project.id,
          metadata: { memberUserId: target.id, role: parsed.data.role },
        },
        tx,
      );
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw alreadyMember;
    throw err;
  }
}

export async function changeMemberRole(
  user: AuthUser,
  projectId: string,
  memberUserId: string,
  role: "ADMIN" | "REVIEWER",
): Promise<void> {
  const newRole = assignableRoleSchema.safeParse(role);
  if (!newRole.success) throw fromZodError(newRole.error);
  const { project } = await loadProjectForWrite(user, projectId, OWNER_ONLY);
  const targetId = requireUuid(memberUserId);

  await db.transaction(async (tx) => {
    const [member] = await tx
      .select({ role: projectMembers.role })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, targetId)))
      .limit(1);
    if (!member) throw new NotFoundError();
    if (member.role === "OWNER") throw new DomainError("OWNER_IMMUTABLE", "O dono do projeto não pode ser alterado aqui.");
    await tx
      .update(projectMembers)
      .set({ role: newRole.data })
      .where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, targetId)));
    await logAudit(
      {
        institutionId: project.institutionId,
        actorUserId: user.id,
        action: "PROJECT_MEMBER_ROLE_CHANGED",
        targetType: "PROJECT",
        targetId: project.id,
        metadata: { memberUserId: targetId, from: member.role, to: newRole.data },
      },
      tx,
    );
  });
}

export async function removeMember(user: AuthUser, projectId: string, memberUserId: string): Promise<void> {
  const { project } = await loadProjectForWrite(user, projectId, OWNER_ONLY);
  const targetId = requireUuid(memberUserId);

  await db.transaction(async (tx) => {
    const [member] = await tx
      .select({ role: projectMembers.role })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, targetId)))
      .limit(1);
    if (!member) throw new NotFoundError();
    if (member.role === "OWNER") throw new DomainError("OWNER_IMMUTABLE", "O dono do projeto não pode ser alterado aqui.");
    await tx.delete(projectMembers).where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, targetId)));
    await logAudit(
      {
        institutionId: project.institutionId,
        actorUserId: user.id,
        action: "PROJECT_MEMBER_REMOVED",
        targetType: "PROJECT",
        targetId: project.id,
        metadata: { memberUserId: targetId, role: member.role },
      },
      tx,
    );
  });
}

export async function leaveProject(user: AuthUser, projectId: string): Promise<void> {
  const { project, membership } = await loadProjectForWrite(user, projectId, ALL_ROLES);
  if (membership.role === "OWNER") throw new DomainError("OWNER_IMMUTABLE", "O dono do projeto não pode sair dele.");

  await db.transaction(async (tx) => {
    await tx.delete(projectMembers).where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, user.id)));
    await logAudit(
      {
        institutionId: project.institutionId,
        actorUserId: user.id,
        action: "PROJECT_MEMBER_LEFT",
        targetType: "PROJECT",
        targetId: project.id,
        metadata: { role: membership.role },
      },
      tx,
    );
  });
}
