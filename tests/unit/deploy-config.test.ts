import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const compose = readFileSync("deploy/compose.prod.yml", "utf8");
const caddyfile = readFileSync("deploy/Caddyfile", "utf8");
const envExample = readFileSync("deploy/.env.production.example", "utf8");
const deployScript = readFileSync("deploy/bin/deploy.sh", "utf8");

/** Bloco YAML de um serviço: do `  nome:` até o próximo serviço de mesmo recuo ou seção de topo. */
function service(name: string): string {
  const match = compose.match(new RegExp(`^  ${name}:\\n((?:    .*\\n|\\s*\\n)*)`, "m"));
  if (!match) throw new Error(`serviço ${name} não encontrado`);
  return match[1];
}

const envKeys = (text: string) => [...text.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1]);
const schemaKeys = [...readFileSync("src/env.ts", "utf8").matchAll(/^ {4}([A-Z][A-Z0-9_]*): z/gm)].map((m) => m[1]);

describe("compose de produção", () => {
  it("só o caddy publica portas", () => {
    for (const name of ["postgres", "app", "migrate"]) expect(service(name)).not.toMatch(/^\s+ports:/m);
    expect(service("caddy")).toMatch(/"80:80"/);
    expect(service("caddy")).toMatch(/"443:443"/);
  });

  it("todos os serviços de longa duração reiniciam sozinhos", () => {
    for (const name of ["postgres", "app", "caddy"]) expect(service(name)).toContain("restart: unless-stopped");
  });

  it("dados e certificados ficam em volumes nomeados", () => {
    expect(service("postgres")).toContain("pgdata:/var/lib/postgresql/data");
    expect(service("caddy")).toContain("caddy_data:/data");
  });
});

describe("Caddyfile", () => {
  it("sobrescreve X-Forwarded-For com o IP real da conexão", () => {
    expect(caddyfile).toContain("header_up X-Forwarded-For {remote_host}");
  });
});

describe(".env de produção", () => {
  it("o exemplo cobre todas as chaves do env.ts", () => {
    expect(schemaKeys.length).toBeGreaterThan(10);
    for (const key of schemaKeys) expect(envKeys(envExample)).toContain(key);
  });

  it("o deploy.sh aceita toda chave do exemplo, e só elas", () => {
    const allowed =
      deployScript
        .match(/ALLOWED_KEYS=\(([\s\S]*?)\)/)?.[1]
        .split(/\s+/)
        .filter(Boolean) ?? [];
    expect(allowed.sort()).toEqual([...new Set(envKeys(envExample))].sort());
  });

  it("o exemplo não traz nenhum valor real", () => {
    for (const line of envExample.split("\n").filter((l) => /^[A-Z]/.test(l))) {
      const [key, value] = [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)];
      if (/SECRET|PASSWORD|API_KEY|CLIENT_ID/.test(key)) expect(value, key).toBe("");
    }
  });
});
