import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const SCRIPT = resolve("deploy/bin/backup.sh");

let root: string;
let dir: string;
let bin: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "backup-test-"));
  dir = join(root, "vertice");
  bin = join(root, "bin");
  mkdirSync(join(dir, "backups"), { recursive: true });
  mkdirSync(bin);
  // `docker compose ... exec -T postgres pg_dump` falso: devolve um dump fixo.
  writeFileSync(join(bin, "docker"), '#!/usr/bin/env bash\nprintf "DUMP"\n');
  chmodSync(join(bin, "docker"), 0o755);
});

afterEach(() => {
  // A pasta sem leitura do segundo teste impediria o rmSync de apagar a raiz.
  spawnSync("chmod", ["-R", "u+rwx", root]);
  rmSync(root, { recursive: true, force: true });
});

function run(cwd: string) {
  return spawnSync("bash", [SCRIPT], {
    cwd,
    encoding: "utf8",
    env: { NODE_ENV: "test", PATH: `${bin}:/usr/bin:/bin`, VERTICE_DIR: dir },
  });
}

describe("backup.sh", () => {
  it("grava o dump do dia com permissão 600", () => {
    const r = run(root);
    expect(r.status).toBe(0);
    const [file] = readdirSync(join(dir, "backups"));
    expect(file).toMatch(/^vertice-\d{4}-\d{2}-\d{2}\.dump$/);
    expect(readFileSync(join(dir, "backups", file), "utf8")).toBe("DUMP");
    expect(statSync(join(dir, "backups", file)).mode & 0o777).toBe(0o600);
  });

  // Na VM (findutils do Ubuntu 24.04), o find falha se não puder voltar à pasta de quem chamou, como
  // /home/ubuntu num `sudo -u deploy`. O script não pode depender dessa pasta: roda dentro de VERTICE_DIR.
  it("roda dentro de VERTICE_DIR, não na pasta de quem chamou", () => {
    writeFileSync(join(bin, "docker"), '#!/usr/bin/env bash\npwd > "$VERTICE_DIR/cwd"\nprintf "DUMP"\n');
    const caller = join(root, "quem-chamou");
    mkdirSync(caller);
    const r = run(caller);
    expect(r.status).toBe(0);
    expect(readFileSync(join(dir, "cwd"), "utf8").trim()).toBe(dir);
  });
});
