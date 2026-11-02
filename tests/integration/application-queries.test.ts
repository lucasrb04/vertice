import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
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
    const project = await mkProject({ name: "Projeto Alfa" });
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
      { applicationId: app.id, fromStatus: "APPLIED", toStatus: "IN_REVIEW", actorUserId: reviewer.id, createdAt: at(1) },
      { applicationId: app.id, fromStatus: "IN_REVIEW", toStatus: "INTERVIEW", message: "Entrevista dia 10.", actorUserId: reviewer.id, createdAt: at(2) },
      { applicationId: app.id, fromStatus: "INTERVIEW", toStatus: "ACCEPTED", message: "Parabéns!", actorUserId: reviewer.id, createdAt: at(3) },
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
