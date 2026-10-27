import { db, type Db, type Tx } from "@/db";
import { auditLogs } from "@/db/schema";

export type AuditAction = "ADMIN_MAINTENANCE_ACCESS" | "ADMIN_ACCESS_DENIED" | "USER_BANNED";
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

export function getRequestIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  return headers.get("x-real-ip")?.trim() || null;
}
