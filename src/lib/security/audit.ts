import { db, type Db, type Tx } from "@/db";
import { auditLogs } from "@/db/schema";
import { getRequestIp } from "./request-ip";

export type AuditAction =
  | "ADMIN_MAINTENANCE_ACCESS"
  | "ADMIN_ACCESS_DENIED"
  | "USER_BANNED"
  | "PROJECT_ARCHIVED"
  | "PROJECT_MEMBER_ADDED"
  | "PROJECT_MEMBER_REMOVED"
  | "PROJECT_MEMBER_ROLE_CHANGED"
  | "PROJECT_MEMBER_LEFT";
export type AuditTargetType = "PROJECT" | "OPPORTUNITY" | "TAG" | "USER" | "ROUTE";

export type AuditEntry = {
  institutionId: string;
  actorUserId: string | null;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
};

export async function logAudit(entry: AuditEntry, executor: Db | Tx = db): Promise<void> {
  await executor.insert(auditLogs).values({
    institutionId: entry.institutionId,
    actorUserId: entry.actorUserId,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId ?? null,
    metadata: entry.metadata ?? {},
    ipAddress: entry.ipAddress ?? null,
  });
}

// Reexport: a função mora em request-ip.ts para o proxy não carregar o banco.
export { getRequestIp };
