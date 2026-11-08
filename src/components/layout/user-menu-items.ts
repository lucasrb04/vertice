export type UserMenuItem = { href: string; label: string };

/** Itens do menu da conta, na ordem em que aparecem. Administração só para SYSTEM_ADMIN. */
export function userMenuItems(user: { systemRole: "USER" | "SYSTEM_ADMIN" }): UserMenuItem[] {
  const items: UserMenuItem[] = [
    { href: "/painel", label: "Meus projetos" },
    { href: "/minhas-candidaturas", label: "Minhas candidaturas" },
    { href: "/publicar", label: "Publicar processo" },
  ];
  if (user.systemRole === "SYSTEM_ADMIN") items.push({ href: "/admin", label: "Administração" });
  return items;
}

/** Iniciais para o avatar sem foto: primeira letra do primeiro e do último nome. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0].charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
  return (first + last).toLocaleUpperCase("pt-BR");
}
