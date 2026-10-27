/**
 * Adia a criação de um objeto até o primeiro acesso a uma propriedade. Usado em `db` e `auth`
 * para que nenhum módulo leia o ambiente no import: `next build` coleta as rotas importando-as e
 * não deve exigir as variáveis de runtime (spec §6.5 — a checagem é no boot, em instrumentation.ts).
 */
export function lazy<T extends object>(factory: () => T): T {
  let instance: T | undefined;
  const get = (): T => (instance ??= factory());
  return new Proxy({} as T, {
    get(_target, prop) {
      const real = get();
      const value: unknown = Reflect.get(real, prop, real);
      return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(real) : value;
    },
    has(_target, prop) {
      return Reflect.has(get(), prop);
    },
    set(_target, prop, value) {
      return Reflect.set(get(), prop, value);
    },
  });
}
