/** Violação de unique (SQLSTATE 23505), direta ou encapsulada em `cause` pelo driver/ORM. */
export function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } } | null;
  return e?.code === "23505" || e?.cause?.code === "23505";
}
