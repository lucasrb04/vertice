import { isIP } from "node:net";
import { db, type Db, type Tx } from "@/db";
import { auditLogs } from "@/db/schema";

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

/**
 * IP do cliente para auditoria. Só é confiável porque o proxy reverso (Caddy) reescreve
 * x-forwarded-for/x-real-ip; sem ele, o cliente controla esses cabeçalhos. Valores que não são
 * IP válido viram null — também evita estourar o varchar(64) de audit_logs.ip_address.
 */
export function getRequestIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded && isIP(forwarded)) return forwarded;
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp && isIP(realIp)) return realIp;
  return null;
}
