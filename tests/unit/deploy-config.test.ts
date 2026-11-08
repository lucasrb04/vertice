import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const compose = readFileSync("deploy/compose.prod.yml", "utf8");
const caddyfile = readFileSync("deploy/Caddyfile", "utf8");
const envExample = readFileSync("deploy/.env.production.example", "utf8");
const deployScript = readFileSync("deploy/bin/deploy.sh", "utf8");
const workflow = readFileSync(".github/workflows/ci.yml", "utf8");

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

  it("o Dozzle escuta só no loopback da VM (acesso por túnel SSH), nunca na internet", () => {
    const ports = [...service("dozzle").matchAll(/^\s+- "([^"]+)"$/gm)].map((m) => m[1]).filter((p) => /:\d+$/.test(p));
    expect(ports).toEqual(["127.0.0.1:8080:8080"]);
  });

  it("o Dozzle só lê logs: socket do Docker read-only, sem ações, sem shell, sem analytics", () => {
    const dozzle = service("dozzle");
    expect(dozzle).toMatch(/image: amir20\/dozzle:v\d+\.\d+\.\d+$/m);
    expect(dozzle).toContain("/var/run/docker.sock:/var/run/docker.sock:ro");
    expect(dozzle).not.toMatch(/ENABLE_(ACTIONS|SHELL)|enable-(actions|shell)/i);
    expect(dozzle).toContain('DOZZLE_NO_ANALYTICS: "true"');
  });

  it("todos os serviços de longa duração reiniciam sozinhos", () => {
    for (const name of ["postgres", "app", "caddy", "dozzle"])
      expect(service(name)).toContain("restart: unless-stopped");
  });

  it("todos os serviços logam no journald, que guarda o histórico entre deploys e reboots", () => {
    expect(compose).toMatch(/^x-logging: &logging\n {2}driver: journald\n/m);
    for (const name of ["postgres", "app", "migrate", "caddy", "dozzle"])
      expect(service(name)).toContain("logging: *logging");
  });

  it("dados e certificados ficam em volumes nomeados", () => {
    expect(service("postgres")).toContain("pgdata:/var/lib/postgresql/data");
    expect(service("caddy")).toContain("caddy_data:/data");
  });
});

describe("pipeline", () => {
  it("runs da mesma ref rodam em fila, para um deploy antigo nunca passar por cima de um novo", () => {
    const topLevel = workflow.slice(0, workflow.indexOf("\njobs:"));
    expect(topLevel).toMatch(/^concurrency:\n {2}group: ci-\$\{\{ github\.ref \}\}\n {2}cancel-in-progress: false$/m);
  });
});

describe("Caddyfile", () => {
  it("sobrescreve X-Forwarded-For com o IP real da conexão", () => {
    expect(caddyfile).toContain("header_up X-Forwarded-For {remote_host}");
  });

  it("registra os acessos sem o código e o state do OAuth na URL", () => {
    expect(caddyfile).toMatch(/^\s+log \{$/m);
    expect(caddyfile).toMatch(/request>uri query \{\s+delete code\s+delete state\s+\}/);
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

  it("o exemplo é versionado (não cai no .gitignore de .env*)", () => {
    const ignored = spawnSync("git", ["check-ignore", "-q", "deploy/.env.production.example"]);
    expect(ignored.status).toBe(1);
  });

  it("o .env montado pela pipeline traz toda chave aceita pelo deploy.sh", () => {
    const sent = [...workflow.matchAll(/"([A-Z][A-Z0-9_]*)=/g)].map((m) => m[1]);
    expect([...new Set(sent)].sort()).toEqual([...new Set(envKeys(envExample))].sort());
  });

  it("o exemplo não traz nenhum valor real", () => {
    for (const line of envExample.split("\n").filter((l) => /^[A-Z]/.test(l))) {
      const [key, value] = [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)];
      if (/SECRET|PASSWORD|API_KEY|CLIENT_ID/.test(key)) expect(value, key).toBe("");
    }
  });
});
