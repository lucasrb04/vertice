import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { UserMenu } from "@/components/layout/user-menu";
import { initials, userMenuItems } from "@/components/layout/user-menu-items";

describe("userMenuItems", () => {
  it("usuário comum: painel, candidaturas e publicar, nessa ordem", () => {
    expect(userMenuItems({ systemRole: "USER" })).toEqual([
      { href: "/painel", label: "Painel" },
      { href: "/minhas-candidaturas", label: "Minhas candidaturas" },
      { href: "/publicar", label: "Publicar processo" },
    ]);
  });

  it("admin ganha Administração no fim", () => {
    expect(userMenuItems({ systemRole: "SYSTEM_ADMIN" }).at(-1)).toEqual({ href: "/admin", label: "Administração" });
  });
});

describe("initials", () => {
  it("primeira letra do primeiro e do último nome", () => {
    expect(initials("Lucas Ribeiro Barbosa")).toBe("LB");
  });
  it("um nome só vira uma letra; espaços e minúsculas não atrapalham", () => {
    expect(initials("  ana  ")).toBe("A");
    expect(initials("élida souza")).toBe("ÉS");
  });
  it("nome vazio não quebra", () => {
    expect(initials("")).toBe("?");
  });
});

describe("UserMenu (botão fechado)", () => {
  const user = { name: "Lucas Ribeiro Barbosa", email: "lucas@unifei.edu.br", systemRole: "USER" as const };

  it("mostra a foto do Google quando existe", () => {
    const out = renderToStaticMarkup(
      <UserMenu user={{ ...user, image: "https://lh3.googleusercontent.com/a/foto" }} />,
    );
    expect(out).toContain('src="https://lh3.googleusercontent.com/a/foto"');
    // Sem Referer: a foto vem do domínio do Google e não precisa saber de qual página foi pedida.
    expect(out.toLowerCase()).toContain('referrerpolicy="no-referrer"');
  });

  it("sem foto, mostra as iniciais", () => {
    const out = renderToStaticMarkup(<UserMenu user={{ ...user, image: null }} />);
    expect(out).not.toContain("<img");
    expect(out).toContain(">LB<");
  });

  it("o botão tem nome acessível e anuncia que abre um menu", () => {
    const out = renderToStaticMarkup(<UserMenu user={{ ...user, image: null }} />);
    expect(out).toContain('aria-label="Menu da conta de Lucas Ribeiro Barbosa"');
    expect(out).toContain('aria-haspopup="menu"');
  });
});
