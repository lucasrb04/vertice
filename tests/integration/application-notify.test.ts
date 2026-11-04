import { render } from "@react-email/render";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { applications, users } from "@/db/schema";
import { runSeed } from "@/db/seed";
import { resetDb } from "../helpers/db";
import { mkOpportunity, mkProject, mkUser } from "../helpers/fixtures";

type Sent = { to: string; subject: string; react: Parameters<typeof render>[0] };
const sent: Sent[] = [];
const batches: number[] = [];
const failFor = new Set<string>();
vi.mock("@/lib/email/send", () => ({
  sendEmail: vi.fn(async (input: Sent) => {
    if (failFor.has(input.to)) throw new Error(`boom ${input.to}`);
    sent.push(input);
    return true;
  }),
  sendEmailBatch: vi.fn(async (inputs: Sent[]) => {
    batches.push(inputs.length);
    for (const input of inputs) if (failFor.has(input.to)) throw new Error(`boom ${input.to}`);
    sent.push(...inputs);
    return inputs.length;
  }),
}));

import { notifyApplicationReceived, notifyStatusChanged } from "@/lib/email/notify";

let seq = 0;
async function mkApplication() {
  const project = await mkProject();
  const opp = await mkOpportunity(project.id, { internalSelectionEnabled: true });
  return { project, opp };
}
async function apply(opportunityId: string, name = "Ana Lima") {
  const student = await mkUser(`aluno${seq++}@unifei.edu.br`);
  await db.update(users).set({ name }).where(eq(users.id, student.id));
  const [app] = await db.insert(applications).values({ opportunityId, userId: student.id }).returning();
  return { app: app!, student };
}

beforeEach(async () => {
  await resetDb();
  await runSeed();
  sent.length = 0;
  batches.length = 0;
  failFor.clear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("notifyApplicationReceived", () => {
  it("envia a confirmação ao aluno", async () => {
    const { opp } = await mkApplication();
    const { app, student } = await apply(opp.id);
    await notifyApplicationReceived(app.id);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe(student.email);
    expect(sent[0]!.subject).toContain(opp.title);
    expect(await render(sent[0]!.react)).toContain("Ana Lima");
  });

  it("candidatura inexistente não envia nem lança", async () => {
    await expect(notifyApplicationReceived("00000000-0000-4000-8000-000000000000")).resolves.toBeUndefined();
    expect(sent).toHaveLength(0);
  });
});

describe("notifyStatusChanged", () => {
  it("manda um e-mail por item numa só chamada ao provedor, com a etapa em pt-BR e a mensagem", async () => {
    const { opp } = await mkApplication();
    const a = await apply(opp.id);
    const b = await apply(opp.id);
    await notifyStatusChanged([
      { applicationId: a.app.id, toStatus: "INTERVIEW", message: "Entrevista na segunda, 14h" },
      { applicationId: b.app.id, toStatus: "REJECTED", message: null },
    ]);
    expect(batches).toEqual([2]);
    expect(sent.map((s) => s.to)).toEqual([a.student.email, b.student.email]);
    const first = await render(sent[0]!.react);
    expect(first).toContain("Entrevista");
    expect(first).toContain("Entrevista na segunda, 14h");
    const second = await render(sent[1]!.react);
    expect(second).toContain("Não selecionado");
    expect(second).not.toContain("Mensagem da equipe");
  });

  it("banido e candidatura inexistente ficam de fora do lote", async () => {
    const { opp } = await mkApplication();
    const a = await apply(opp.id);
    const banned = await apply(opp.id);
    await db.update(users).set({ isBanned: true }).where(eq(users.id, banned.student.id));
    await notifyStatusChanged([
      { applicationId: banned.app.id, toStatus: "ACCEPTED", message: null },
      { applicationId: "00000000-0000-4000-8000-000000000000", toStatus: "ACCEPTED", message: null },
      { applicationId: a.app.id, toStatus: "ACCEPTED", message: null },
    ]);
    expect(sent.map((s) => s.to)).toEqual([a.student.email]);
  });

  it("falha do envio não lança e o log não traz dados do aluno", async () => {
    const { opp } = await mkApplication();
    const a = await apply(opp.id, "Maria Souza");
    failFor.add(a.student.email);
    await expect(
      notifyStatusChanged([{ applicationId: a.app.id, toStatus: "ACCEPTED", message: "segredo-da-mensagem" }]),
    ).resolves.toBeUndefined();
    const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(vi.mocked(console.error)).toHaveBeenCalled();
    for (const piece of ["Maria", a.student.email, "segredo-da-mensagem", "boom"]) expect(logged).not.toContain(piece);
  });

  it("lista vazia não faz nada", async () => {
    await notifyStatusChanged([]);
    expect(sent).toHaveLength(0);
  });
});
