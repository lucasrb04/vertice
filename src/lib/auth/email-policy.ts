export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Igualdade exata do domínio (sem sufixo/subdomínio). Exige exatamente um "@" e parte local não vazia. */
export function isAllowedEmail(email: string, allowedDomains: readonly string[]): boolean {
  const parts = normalizeEmail(email).split("@");
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || !domain) return false;
  return allowedDomains.some((d) => normalizeEmail(d) === domain);
}
