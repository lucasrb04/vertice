import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const SCRIPT = resolve("deploy/bin/deploy.sh");
const NEW = "a".repeat(40);
const OLD = "b".repeat(40);
const VALID_ENV =
  "NODE_ENV=production\nPOSTGRES_PASSWORD=s3gr3d0-que-nao-pode-vazar\nEMAIL_FROM=Vértice <nao-responda@verticehub.online>\n";

// `docker` e `curl` falsos: gravam cada chamada (uma por linha) e falham quando pedido.
const FAKE_DOCKER = `#!/usr/bin/env bash
echo "docker $* [IMAGE_TAG=\${IMAGE_TAG:-}]" >> "$CALLS"
if [[ -n "\${FAIL_DOCKER:-}" && "$*" =~ $FAIL_DOCKER ]]; then exit 1; fi
case "$1" in
  create) echo fake-container ;;
  cp) touch "$3" ;;
esac
exit 0
`;
const FAKE_CURL = `#!/usr/bin/env bash
echo "curl $*" >> "$CALLS"
exit "\${CURL_EXIT:-0}"
`;

let dir: string;
let bin: string;
let calls: string;

beforeEach(() => {
  const root = mkdtempSync(join(tmpdir(), "deploy-test-"));
  dir = join(root, "vertice");
  bin = join(root, "bin");
  calls = join(root, "calls.log");
  spawnSync("mkdir", ["-p", dir, bin]);
  writeFileSync(join(bin, "docker"), FAKE_DOCKER);
  writeFileSync(join(bin, "curl"), FAKE_CURL);
  chmodSync(join(bin, "docker"), 0o755);
  chmodSync(join(bin, "curl"), 0o755);
  writeFileSync(calls, "");
});

afterEach(() => rmSync(join(dir, ".."), { recursive: true, force: true }));

function run(tag: string, opts: { stdin?: string; env?: Record<string, string> } = {}) {
  const r = spawnSync("bash", [SCRIPT], {
    input: opts.stdin ?? "",
    encoding: "utf8",
    env: {
      NODE_ENV: "test",
      PATH: `${bin}:/usr/bin:/bin`,
      CALLS: calls,
      VERTICE_DIR: dir,
      HEALTH_URL: "https://exemplo.invalid/",
      HEALTH_TIMEOUT: "1",
      SSH_ORIGINAL_COMMAND: tag,
      ...opts.env,
    },
  });
  const log = readFileSync(calls, "utf8").split("\n").filter(Boolean);
  return { code: r.status, out: r.stdout + r.stderr, log, docker: log.filter((l) => l.startsWith("docker ")) };
}

const withEnvFile = () => writeFileSync(join(dir, ".env"), VALID_ENV, { mode: 0o600 });
const release = () => readFileSync(join(dir, "RELEASE"), "utf8").trim();

describe("deploy.sh", () => {
  it.each(["abc; rm -rf /", "", `${NEW} x`, NEW.toUpperCase()])(
    "recusa tag que não é SHA antes de chamar o docker (%j)",
    (tag) => {
      withEnvFile();
      const r = run(tag);
      expect(r.code).toBe(2);
      expect(r.log).toEqual([]);
    },
  );

  it("aborta sem .env", () => {
    const r = run(NEW);
    expect(r.code).toBe(3);
    expect(r.log).toEqual([]);
  });

  it("grava o .env recebido no stdin com permissão 600", () => {
    const r = run(NEW, { stdin: VALID_ENV });
    expect(r.code).toBe(0);
    expect(readFileSync(join(dir, ".env"), "utf8")).toBe(VALID_ENV);
    expect(statSync(join(dir, ".env")).mode & 0o777).toBe(0o600);
  });

  it.each([
    "FOO=1",
    "DATABASE_URL=$(id)",
    "X=1; rm",
    'POSTGRES_PASSWORD="aspas"',
    "POSTGRES_PASSWORD=`id`",
    "POSTGRES_PASSWORD= espaço",
    "linha sem igual",
  ])("recusa .env com chave desconhecida ou valor perigoso (%j)", (line) => {
    withEnvFile();
    const r = run(NEW, { stdin: `NODE_ENV=production\n${line}\n` });
    expect(r.code).toBe(3);
    expect(readFileSync(join(dir, ".env"), "utf8")).toBe(VALID_ENV);
    expect(r.docker).toEqual([]);
  });

  it("nunca ecoa valores do .env", () => {
    const ok = run(NEW, { stdin: VALID_ENV });
    const bad = run(NEW, { stdin: `${VALID_ENV}DATABASE_URL=$(s3gr3d0)\n` });
    for (const r of [ok, bad]) {
      expect(r.out).not.toContain("s3gr3d0");
      expect(r.out).not.toContain("nao-responda");
    }
  });

  it("migrate falho não sobe o app nem grava RELEASE", () => {
    withEnvFile();
    writeFileSync(join(dir, "RELEASE"), OLD);
    const r = run(NEW, { env: { FAIL_DOCKER: "run --rm migrate db:migrate" } });
    expect(r.code).toBe(4);
    expect(r.docker.some((l) => l.includes(" up "))).toBe(false);
    expect(release()).toBe(OLD);
  });

  it("verificação falha e volta para a tag de RELEASE", () => {
    withEnvFile();
    writeFileSync(join(dir, "RELEASE"), OLD);
    const r = run(NEW, { env: { CURL_EXIT: "22" } });
    expect(r.code).toBe(5);
    const ups = r.docker.filter((l) => l.includes("up -d app caddy"));
    expect(ups.at(-1)).toContain(`[IMAGE_TAG=${OLD}]`);
    expect(release()).toBe(OLD);
  });

  it("primeiro deploy sem RELEASE e verificação falha sai com erro claro", () => {
    withEnvFile();
    const r = run(NEW, { env: { CURL_EXIT: "22" } });
    expect(r.code).toBe(5);
    expect(r.out).toContain("sem versão anterior");
  });

  it("sucesso grava RELEASE e roda o rebuild depois do up", () => {
    withEnvFile();
    const r = run(NEW);
    expect(r.code).toBe(0);
    const order = ["compose", "pull", "db:migrate", "db:seed", "up -d app caddy", "db:search:rebuild"].map((step) =>
      r.docker.findIndex((l) => l.includes(step)),
    );
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(r.docker.some((l) => l.includes(`vertice-migrate:${NEW}`))).toBe(true);
    expect(release()).toBe(NEW);
  });
});
