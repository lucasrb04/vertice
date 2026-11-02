import { isIP } from "node:net";

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
