export type FieldErrors = Record<string, string[]>;

/** Mensagens do campo `field` e dos seus subcaminhos (`field.x.y`). */
export function errorsFor(errors: FieldErrors | undefined, field: string): string[] {
  if (!errors) return [];
  return Object.entries(errors)
    .filter(([key]) => key === field || key.startsWith(`${field}.`))
    .flatMap(([, messages]) => messages);
}

/** Erros sem os do campo `field` (e subcaminhos): o campo editado deixa de mostrar um erro já corrigido. */
export function withoutFieldError(errors: FieldErrors, field: string): FieldErrors {
  const keys = Object.keys(errors).filter((key) => key === field || key.startsWith(`${field}.`));
  if (keys.length === 0) return errors;
  const next = { ...errors };
  for (const key of keys) delete next[key];
  return next;
}

/** Separa `fieldErrors` com chaves `prefixo.campo` por prefixo, removendo-o; o resto vai em `rest`. */
export function splitPrefixedErrors<P extends string>(
  errors: FieldErrors | undefined,
  prefixes: readonly P[],
): Record<P, FieldErrors> & { rest: FieldErrors } {
  const groups: Record<string, FieldErrors> = { rest: {} };
  for (const p of prefixes) groups[p] = {};
  for (const [key, messages] of Object.entries(errors ?? {})) {
    const prefix = prefixes.find((p) => key.startsWith(`${p}.`));
    if (prefix) groups[prefix]![key.slice(prefix.length + 1)] = messages;
    else groups.rest![key] = messages;
  }
  return groups as Record<P, FieldErrors> & { rest: FieldErrors };
}
