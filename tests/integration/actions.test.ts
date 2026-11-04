import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { applications, opportunities, projects } from "@/db/schema";
import { runSeed } from "@/db/seed";
import { resetDb } from "../helpers/db";
import { addMember, mkOpportunity, mkProject, mkUser } from "../helpers/fixtures";
import { validOpportunityInput, validProjectInput } from "../helpers/inputs";

const state = vi.hoisted(() => ({
  sessionUserId: null as string | null,
  turnstileOk: true,
  headers: new Headers({ "x-forwarded-for": "10.0.0.9" }),
  afterCallbacks: [] as (() => Promise<void>)[],
}));

vi.mock("next/headers", () => ({ headers: async () => state.headers }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/server", () => ({ after: (cb: () => Promise<void>) => state.afterCallbacks.push(cb) }));
vi.mock("@/lib/auth/session", () => ({
  getSessionUser: async () => (state.sessionUserId ? { id: state.sessionUserId } : null),
}));
vi.mock("@/lib/security/turnstile", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/security/turnstile")>()),
  verifyTurnstile: async (token: string) => state.turnstileOk && token !== "",
}));

const { createProjectWithOpportunityAction, updateProjectAction } = await import("@/actions/project.actions");
const { searchTagsAction } = await import("@/actions/tag.actions");
const { moveApplicationsAction } = await import("@/actions/application.actions");

describe("Server Actions", () => {
  beforeEach(async () => {
    await resetDb();
    await runSeed();
    state.sessionUserId = null;
    state.turnstileOk = true;
    state.afterCallbacks.length = 0;
  });

  const wizard = (opportunity = validOpportunityInput()) => ({
    turnstileToken: "tok",
    project: validProjectInput(),
    opportunity,
  });

  it("cria projeto e processo com Turnstile válido", async () => {
    const user = (await mkUser("a@unifei.edu.br"))!;
    state.sessionUserId = user.id;
    const res = await createProjectWithOpportunityAction(wizard());
    expect(res.ok).toBe(true);
    expect(await db.select().from(projects)).toHaveLength(1);
  });

  it("Turnstile inválido recusa sem gravar nada", async () => {
    const user = (await mkUser("a@unifei.edu.br"))!;
    state.sessionUserId = user.id;
    state.turnstileOk = false;
    const res = await createProjectWithOpportunityAction(wizard());
    expect(res).toMatchObject({ ok: false, error: "TURNSTILE_FAILED" });
    expect(await db.select().from(projects)).toHaveLength(0);
    expect(await db.select().from(opportunities)).toHaveLength(0);
  });

  it("token de tipo ou tamanho inválido → TURNSTILE_FAILED sem gravar", async () => {
    const user = (await mkUser("a@unifei.edu.br"))!;
    state.sessionUserId = user.id;
    for (const turnstileToken of [123 as unknown as string, "x".repeat(2049)]) {
      const res = await createProjectWithOpportunityAction({ ...wizard(), turnstileToken });
      expect(res).toMatchObject({ ok: false, error: "TURNSTILE_FAILED" });
    }
    expect(await db.select().from(projects)).toHaveLength(0);
  });

  it("sem sessão → UNAUTHORIZED", async () => {
    const res = await createProjectWithOpportunityAction(wizard());
    expect(res).toMatchObject({ ok: false, error: "UNAUTHORIZED", message: "Sua sessão expirou. Entre de novo." });
    expect(await searchTagsAction("py").catch((e: unknown) => (e as Error).name)).toBe("UnauthorizedError");
  });

  it("erro de validação volta por campo", async () => {
    const user = (await mkUser("a@unifei.edu.br"))!;
    state.sessionUserId = user.id;
    const res = await createProjectWithOpportunityAction(wizard(validOpportunityInput({ externalUrl: "http://x" })));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe("VALIDATION");
    expect(res.fieldErrors?.["opportunity.externalUrl"]).toContain("Use um link começando com https://");
  });

  it("não-membro recebe NOT_FOUND com a mesma mensagem de id inexistente", async () => {
    const user = (await mkUser("a@unifei.edu.br"))!;
    const foreign = (await mkProject())!;
    state.sessionUserId = user.id;
    const a = await updateProjectAction(foreign.id, validProjectInput());
    const b = await updateProjectAction("00000000-0000-4000-8000-000000000000", validProjectInput());
    expect(a).toEqual(b);
    expect(a).toMatchObject({ ok: false, error: "NOT_FOUND", message: "Não encontrado." });
  });

  it("membro OWNER atualiza o projeto", async () => {
    const user = (await mkUser("a@unifei.edu.br"))!;
    const p = (await mkProject())!;
    await addMember(p.id, user.id, "OWNER");
    state.sessionUserId = user.id;
    expect(await updateProjectAction(p.id, validProjectInput({ name: "Novo Nome" }))).toMatchObject({ ok: true });
  });

  it("moveApplicationsAction: sem sessão, não-membro e membro", async () => {
    const project = (await mkProject())!;
    const opp = (await mkOpportunity(project.id, { internalSelectionEnabled: true }))!;
    const student = (await mkUser("aluno@unifei.edu.br"))!;
    const [app] = await db.insert(applications).values({ opportunityId: opp.id, userId: student.id }).returning();
    const input = {
      projectId: project.id,
      opportunityId: opp.id,
      items: [{ applicationId: app!.id, fromStatus: "APPLIED" }],
      toStatus: "IN_REVIEW",
    };

    expect(await moveApplicationsAction(input)).toMatchObject({ ok: false, error: "UNAUTHORIZED" });
    expect(state.afterCallbacks).toHaveLength(0);

    const outsider = (await mkUser("fora@unifei.edu.br"))!;
    state.sessionUserId = outsider.id;
    expect(await moveApplicationsAction(input)).toEqual({ ok: false, error: "NOT_FOUND", message: "Não encontrado." });
    expect(state.afterCallbacks).toHaveLength(0);

    const reviewer = (await mkUser("rev@unifei.edu.br"))!;
    await addMember(project.id, reviewer.id, "REVIEWER");
    state.sessionUserId = reviewer.id;
    expect(await moveApplicationsAction(input)).toEqual({ ok: true, data: { moved: 1, skipped: 0 } });
    // O aviso por e-mail só é agendado para quem foi movido, e sem expor nada ao cliente.
    expect(state.afterCallbacks).toHaveLength(1);
  });

  it("moveApplicationsAction: processo oculto em projeto ativo não move nem agenda e-mail", async () => {
    const project = (await mkProject())!;
    const opp = (await mkOpportunity(project.id, {
      internalSelectionEnabled: true,
      status: "UNDER_REVIEW",
      statusBeforeModeration: "OPEN",
    }))!;
    const student = (await mkUser("aluno@unifei.edu.br"))!;
    const [app] = await db.insert(applications).values({ opportunityId: opp.id, userId: student.id }).returning();
    const reviewer = (await mkUser("rev@unifei.edu.br"))!;
    await addMember(project.id, reviewer.id, "REVIEWER");
    state.sessionUserId = reviewer.id;

    const res = await moveApplicationsAction({
      projectId: project.id,
      opportunityId: opp.id,
      items: [{ applicationId: app!.id, fromStatus: "APPLIED" }],
      toStatus: "ACCEPTED",
    });
    expect(res).toEqual({ ok: false, error: "RULE", message: "Este processo está oculto pela moderação." });
    expect(state.afterCallbacks).toHaveLength(0);
    const [row] = await db.select().from(applications).where(eq(applications.id, app!.id));
    expect(row!.status).toBe("APPLIED");
  });

  it("searchTagsAction exige sessão e valida o tamanho", async () => {
    const user = (await mkUser("a@unifei.edu.br"))!;
    state.sessionUserId = user.id;
    expect(await searchTagsAction("x".repeat(65))).toEqual([]);
    const found = await searchTagsAction("  pyth ");
    expect(found.map((t) => t.name)).toContain("Python");
  });
});
