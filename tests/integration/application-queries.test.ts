import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { applicationEvents, applications } from "@/db/schema";
import { runSeed } from "@/db/seed";
import { getMyApplicationId, listMyApplications } from "@/lib/applications/queries";
import { resetDb } from "../helpers/db";
import { mkOpportunity, mkProject, mkUser } from "../helpers/fixtures";

beforeEach(async () => {
  await resetDb();
  await runSeed();
});

let seq = 0;
const at = (minutes: number) => new Date(Date.UTC(2026, 0, 1, 12, minutes));

async function apply(userId: string, opportunityId: string, createdAt: Date) {
  const [app] = await db.insert(applications).values({ userId, opportunityId, createdAt }).returning();
  await db
    .insert(applicationEvents)
    .values({ applicationId: app.id, fromStatus: null, toStatus: "APPLIED", actorUserId: userId, createdAt });
  return app;
}

describe("listMyApplications", () => {
  it("lista só as do próprio usuário, mais recentes primeiro", async () => {
    const project = await mkProject({ name: "Projeto Alfa", acronym: "ALFA", category: "PET" });
    const [a, b, c] = await Promise.all([
      mkOpportunity(project.id, { title: "Primeira" }),
      mkOpportunity(project.id, { title: "Segunda" }),
      mkOpportunity(project.id, { title: "De outro" }),
    ]);
    const me = await mkUser(`eu${seq++}@unifei.edu.br`);
    const other = await mkUser(`outro${seq++}@unifei.edu.br`);
    await apply(me.id, a.id, at(1));
    await apply(me.id, b.id, at(2));
    await apply(other.id, c.id, at(3));

    const list = await listMyApplications(me);
    expect(list.map((x) => x.opportunityTitle)).toEqual(["Segunda", "Primeira"]);
    expect(list[0]).toMatchObject({
      projectName: "Projeto Alfa",
      projectAcronym: "ALFA",
      projectCategory: "PET",
      opportunitySlug: b.slug,
      status: "APPLIED",
      appliedAt: at(2),
      messages: [],
    });
  });

  it("messages traz só eventos com mensagem, do mais recente ao mais antigo, sem ator", async () => {
    const project = await mkProject();
    const opp = await mkOpportunity(project.id);
    const me = await mkUser(`eu${seq++}@unifei.edu.br`);
    const reviewer = await mkUser(`rev${seq++}@unifei.edu.br`);
    const app = await apply(me.id, opp.id, at(0));
    await db.insert(applicationEvents).values([
      {
        applicationId: app.id,
        fromStatus: "APPLIED",
        toStatus: "IN_REVIEW",
        actorUserId: reviewer.id,
        createdAt: at(1),
      },
      {
        applicationId: app.id,
        fromStatus: "IN_REVIEW",
        toStatus: "INTERVIEW",
        message: "Entrevista dia 10.",
        actorUserId: reviewer.id,
        createdAt: at(2),
      },
      {
        applicationId: app.id,
        fromStatus: "INTERVIEW",
        toStatus: "ACCEPTED",
        message: "Parabéns!",
        actorUserId: reviewer.id,
        createdAt: at(3),
      },
    ]);
    await db.update(applications).set({ status: "ACCEPTED" }).where(eq(applications.id, app.id));

    const [item] = await listMyApplications(me);
    expect(item.status).toBe("ACCEPTED");
    expect(item.messages).toEqual([
      { toStatus: "ACCEPTED", message: "Parabéns!", createdAt: at(3) },
      { toStatus: "INTERVIEW", message: "Entrevista dia 10.", createdAt: at(2) },
    ]);
    expect(JSON.stringify(item)).not.toContain(reviewer.id);
  });

  it("projeto arquivado continua na lista; UNDER_REVIEW vem sem slug", async () => {
    const archived = await mkProject({ status: "ARCHIVED" });
    const project = await mkProject();
    const a = await mkOpportunity(archived.id, { title: "Do arquivado" });
    const b = await mkOpportunity(project.id, { title: "Em revisão", status: "UNDER_REVIEW" });
    const me = await mkUser(`eu${seq++}@unifei.edu.br`);
    await apply(me.id, a.id, at(1));
    await apply(me.id, b.id, at(2));

    const list = await listMyApplications(me);
    expect(list.map((x) => x.opportunityTitle)).toEqual(["Em revisão", "Do arquivado"]);
    expect(list[0].opportunitySlug).toBeNull();
    expect(list[1].opportunitySlug).toBe(a.slug);
  });
});

describe("listMyApplications: alvo oculto", () => {
  it("anula o link de processo ou projeto oculto pela moderação", async () => {
    const me = await mkUser(`oculto${seq++}@unifei.edu.br`);
    const suspended = await mkProject({ name: "Projeto suspenso", status: "SUSPENDED" });
    const review = await mkProject({ name: "Projeto em revisão", status: "UNDER_REVIEW" });
    const archived = await mkProject({ name: "Projeto arquivado", status: "ARCHIVED" });
    const visible = await mkProject({ name: "Projeto visível" });
    const hiddenProcess = await mkOpportunity(visible.id, { title: "Processo oculto", status: "UNDER_REVIEW" });
    const inSuspended = await mkOpportunity(suspended.id, { title: "No suspenso" });
    const inReview = await mkOpportunity(review.id, { title: "No em revisão" });
    const inArchived = await mkOpportunity(archived.id, { title: "No arquivado" });
    const ok = await mkOpportunity(visible.id, { title: "Normal" });
    const opps = [hiddenProcess, inSuspended, inReview, inArchived, ok];
    for (const [i, o] of opps.entries()) await apply(me.id, o.id, at(i));

    const slugs = new Map((await listMyApplications(me)).map((x) => [x.opportunityTitle, x.opportunitySlug]));
    expect(slugs.get("Processo oculto")).toBeNull();
    expect(slugs.get("No suspenso")).toBeNull();
    expect(slugs.get("No em revisão")).toBeNull();
    expect(slugs.get("No arquivado")).toBe(inArchived.slug);
    expect(slugs.get("Normal")).toBe(ok.slug);
  });
});

describe("listMyApplications: dois alunos e projeto arquivado", () => {
  it("mensagens de outro aluno na mesma oportunidade não vazam", async () => {
    const project = await mkProject();
    const opp = await mkOpportunity(project.id);
    const me = await mkUser(`eu${seq++}@unifei.edu.br`);
    const other = await mkUser(`outro${seq++}@unifei.edu.br`);
    const reviewer = await mkUser(`rev${seq++}@unifei.edu.br`);
    const mine = await apply(me.id, opp.id, at(0));
    const theirs = await apply(other.id, opp.id, at(1));
    await db.insert(applicationEvents).values([
      {
        applicationId: mine.id,
        fromStatus: "APPLIED",
        toStatus: "IN_REVIEW",
        message: "Para mim.",
        actorUserId: reviewer.id,
        createdAt: at(2),
      },
      {
        applicationId: theirs.id,
        fromStatus: "APPLIED",
        toStatus: "REJECTED",
        message: "Para o outro.",
        actorUserId: reviewer.id,
        createdAt: at(3),
      },
    ]);

    const list = await listMyApplications(me);
    expect(list.map((x) => x.id)).toEqual([mine.id]);
    expect(list[0].messages).toEqual([{ toStatus: "IN_REVIEW", message: "Para mim.", createdAt: at(2) }]);
    expect(JSON.stringify(list)).not.toContain("Para o outro.");
  });

  it("marca projeto arquivado só na candidatura em andamento", async () => {
    const archived = await mkProject({ status: "ARCHIVED" });
    const active = await mkProject();
    const me = await mkUser(`eu${seq++}@unifei.edu.br`);
    const inProgress = await apply(me.id, (await mkOpportunity(archived.id)).id, at(1));
    const finished = await apply(me.id, (await mkOpportunity(archived.id)).id, at(2));
    await db.update(applications).set({ status: "ACCEPTED" }).where(eq(applications.id, finished.id));
    const elsewhere = await apply(me.id, (await mkOpportunity(active.id)).id, at(3));

    const byId = new Map((await listMyApplications(me)).map((x) => [x.id, x]));
    expect(byId.get(inProgress.id)?.projectArchived).toBe(true);
    expect(byId.get(finished.id)?.projectArchived).toBe(false);
    expect(byId.get(elsewhere.id)?.projectArchived).toBe(false);
  });
});

describe("getMyApplicationId", () => {
  it("devolve o id da própria candidatura, ou nulo", async () => {
    const project = await mkProject();
    const opp = await mkOpportunity(project.id);
    const me = await mkUser(`eu${seq++}@unifei.edu.br`);
    const other = await mkUser(`outro${seq++}@unifei.edu.br`);
    const app = await apply(me.id, opp.id, at(0));
    expect(await getMyApplicationId(me.id, opp.id)).toBe(app.id);
    expect(await getMyApplicationId(other.id, opp.id)).toBeNull();
  });
});
