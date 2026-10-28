import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { opportunities, opportunityTags, tags } from "@/db/schema";
import { runSeed } from "@/db/seed";
import { NotFoundError } from "@/lib/auth/errors";
import { DomainError } from "@/lib/domain-errors";
import {
  OPPORTUNITY_CLOSED,
  closeOpportunity,
  createOpportunity,
  getOpportunityFormValues,
  updateOpportunity,
} from "@/lib/opportunities/service";
import { tagCreationLimiter } from "@/lib/security/rate-limit";
import { resetDb } from "../helpers/db";
import { addMember, mkOpportunity, mkProject, mkUser } from "../helpers/fixtures";
import { validOpportunityInput } from "../helpers/inputs";

beforeEach(async () => {
  await resetDb();
  await runSeed();
  tagCreationLimiter.reset();
});

async function setup() {
  const owner = await mkUser("owner@unifei.edu.br");
  const project = await mkProject();
  await addMember(project.id, owner.id, "OWNER");
  return { owner, project };
}

const get = async (id: string) => (await db.select().from(opportunities).where(eq(opportunities.id, id)))[0];

describe("createOpportunity", () => {
  it("OWNER e ADMIN criam; REVIEWER, não-membro e SYSTEM_ADMIN sem membership recebem NotFoundError", async () => {
    const { owner, project } = await setup();
    const admin = await mkUser("admin@unifei.edu.br");
    const reviewer = await mkUser("rev@unifei.edu.br");
    const outsider = await mkUser("out@unifei.edu.br");
    const sysadmin = await mkUser("sys@unifei.edu.br", { systemRole: "SYSTEM_ADMIN" });
    await addMember(project.id, admin.id, "ADMIN");
    await addMember(project.id, reviewer.id, "REVIEWER");

    for (const u of [owner, admin]) {
      const { opportunityId } = await createOpportunity(u, project.id, validOpportunityInput());
      expect((await get(opportunityId)).projectId).toBe(project.id);
    }
    for (const u of [reviewer, outsider, sysadmin]) {
      await expect(createOpportunity(u, project.id, validOpportunityInput())).rejects.toBeInstanceOf(NotFoundError);
    }
  });

  it("projeto ARCHIVED recusa criar, editar e encerrar", async () => {
    const { owner } = await setup();
    const project = await mkProject({ status: "ARCHIVED" });
    await addMember(project.id, owner.id, "OWNER");
    const opp = await mkOpportunity(project.id);
    await expect(createOpportunity(owner, project.id, validOpportunityInput())).rejects.toBeInstanceOf(NotFoundError);
    await expect(updateOpportunity(owner, project.id, opp.id, validOpportunityInput())).rejects.toBeInstanceOf(NotFoundError);
    await expect(closeOpportunity(owner, project.id, opp.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("updateOpportunity / closeOpportunity", () => {
  it("editar processo de outro projeto trocando o opportunityId é recusado", async () => {
    const { owner, project: a } = await setup();
    const b = await mkProject();
    const oppB = await mkOpportunity(b.id);
    await expect(updateOpportunity(owner, a.id, oppB.id, validOpportunityInput({ title: "Título invadido" }))).rejects.toBeInstanceOf(NotFoundError);
    await expect(closeOpportunity(owner, a.id, oppB.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(updateOpportunity(owner, a.id, "não-é-uuid", validOpportunityInput())).rejects.toBeInstanceOf(NotFoundError);
    const after = await get(oppB.id);
    expect(after.title).toBe("Vaga de teste");
    expect(after.status).toBe("OPEN");
  });

  it("processo encerrado não pode ser editado nem encerrado de novo", async () => {
    const { owner, project } = await setup();
    const opp = await mkOpportunity(project.id);
    await closeOpportunity(owner, project.id, opp.id);
    const row = await get(opp.id);
    expect(row.status).toBe("CLOSED");
    expect(row.closedAt).not.toBeNull();
    for (const p of [
      updateOpportunity(owner, project.id, opp.id, validOpportunityInput()),
      closeOpportunity(owner, project.id, opp.id),
    ]) {
      const err = await p.catch((e) => e);
      expect(err).toBeInstanceOf(DomainError);
      expect(err.code).toBe("OPPORTUNITY_CLOSED");
      expect(err.userMessage).toBe(OPPORTUNITY_CLOSED);
    }
  });

  it("prazo vencido conta como encerrado", async () => {
    const { owner, project } = await setup();
    const opp = await mkOpportunity(project.id, { deadlineAt: new Date(Date.now() - 3_600_000) });
    await expect(updateOpportunity(owner, project.id, opp.id, validOpportunityInput())).rejects.toMatchObject({
      code: "OPPORTUNITY_CLOSED",
    });
  });

  it("edição mantém slug e atualiza tags", async () => {
    const { owner, project } = await setup();
    const { opportunityId } = await createOpportunity(
      owner,
      project.id,
      validOpportunityInput({ tags: { THEME: [{ name: "Robótica" }], DESIRED_SKILL: [], DEVELOPED_SKILL: [] } }),
    );
    const before = await get(opportunityId);
    await updateOpportunity(
      owner,
      project.id,
      opportunityId,
      validOpportunityInput({
        title: "Título totalmente novo",
        scholarshipType: "PAID",
        scholarshipValue: "700,00",
        tags: { THEME: [], DESIRED_SKILL: [{ name: "Python" }], DEVELOPED_SKILL: [] },
      }),
    );
    const after = await get(opportunityId);
    expect(after.slug).toBe(before.slug);
    expect(after.title).toBe("Título totalmente novo");
    expect(after.scholarshipValueCents).toBe(70000);
    expect(after.status).toBe("OPEN");
    const rows = await db
      .select({ name: tags.name, rel: opportunityTags.relationType })
      .from(opportunityTags)
      .innerJoin(tags, eq(tags.id, opportunityTags.tagId))
      .where(eq(opportunityTags.opportunityId, opportunityId));
    expect(rows).toEqual([{ name: "Python", rel: "DESIRED_SKILL" }]);
  });
});

describe("getOpportunityFormValues", () => {
  it("duplicar gera valores sem datas e cria processo novo aberto com slug novo", async () => {
    const { owner, project } = await setup();
    const { opportunityId } = await createOpportunity(
      owner,
      project.id,
      validOpportunityInput({
        scholarshipType: "PAID",
        scholarshipValue: "1200,50",
        tags: { THEME: [{ name: "Robótica" }], DESIRED_SKILL: [], DEVELOPED_SKILL: [] },
      }),
    );
    await closeOpportunity(owner, project.id, opportunityId);

    const edit = await getOpportunityFormValues(owner, project.id, opportunityId, "edit");
    expect(edit.deadline).not.toBe("");
    expect(edit.scholarshipValue).toBe("1200,50");

    const values = await getOpportunityFormValues(owner, project.id, opportunityId, "duplicate");
    expect(values.deadline).toBe("");
    expect(values.resultOn).toBe("");
    expect(values.tags).toEqual(edit.tags);
    expect(values.tags?.THEME).toHaveLength(1);

    const next = validOpportunityInput({ ...values, deadline: validOpportunityInput().deadline });
    const { opportunityId: newId } = await createOpportunity(owner, project.id, next);
    expect(newId).not.toBe(opportunityId);
    const [a, b] = [await get(opportunityId), await get(newId)];
    expect(b.slug).not.toBe(a.slug);
    expect(b.status).toBe("OPEN");
    expect(b.scholarshipValueCents).toBe(120050);
  });

  it("recusa processo de outro projeto", async () => {
    const { owner, project } = await setup();
    const other = await mkOpportunity((await mkProject()).id);
    await expect(getOpportunityFormValues(owner, project.id, other.id, "edit")).rejects.toBeInstanceOf(NotFoundError);
  });
});
