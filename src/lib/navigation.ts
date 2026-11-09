export type NavHref = "/" | "/publicar" | "/minhas-candidaturas" | "/painel";

/** Pílula ativa do cabeçalho. "Processos" (`/`) cobre a lista e as páginas de cada processo. */
export function isNavActive(href: NavHref, pathname: string): boolean {
  if (href === "/") return pathname === "/" || pathname === "/processos" || pathname.startsWith("/processo/");
  return pathname === href || pathname.startsWith(`${href}/`);
}
