import { and, eq, sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import {
  opportunities,
  opportunityTags,
  projects,
  searchDocuments,
  searchSynonyms,
  searchVocabulary,
} from "@/db/schema";
import { runSeed } from "@/db/seed";
import { SYNONYMS } from "@/db/seed-data";
import { runDemoSeed } from "@/db/seed-demo";
import { closeOpportunity, createOpportunity, updateOpportunity } from "@/lib/opportunities/service";
import { archiveProject, createProjectWithOpportunity, updateProject } from "@/lib/projects/service";
import { normalizeQuery } from "@/lib/public/queries";
import {
  lockProjectSearchDocuments,
  rebuildSearchDocuments,
  rebuildSearchVocabulary,
  refreshProjectSearchDocuments,
  refreshSearchDocument,
  scheduleVocabularyRebuild,
} from "@/lib/search/index-documents";
import { tagCreationLimiter } from "@/lib/security/rate-limit";
import { getDefaultInstitution } from "@/lib/tenant";
import { resetDb } from "../helpers/db";
import {
  addMember,
  mkForeignInstitution,
  mkOpportunity,
  mkProject,
  mkTag,
  mkUser,
  tagOpportunity,
} from "../helpers/fixtures";
import { validOpportunityInput, validProjectInput } from "../helpers/inputs";

let institutionId: string;

beforeEach(async () => {
  await resetDb();
  await runSeed();
  tagCreationLimiter.reset();
  institutionId = (await getDefaultInstitution()).id;
});

afterEach(() => vi.restoreAllMocks());

async function setup(project: Parameters<typeof mkProject>[0] = {}) {
  const owner = await mkUser("owner@unifei.edu.br");
  const row = await mkProject(project);
  await addMember(row.id, owner.id, "OWNER");
  return { owner, project: row };
}

const wizard = (opportunity = validOpportunityInput(), project = validProjectInput()) => ({ project, opportunity });

/** O documento do processo casa com a consulta, na mesma configuração usada pela busca. */
async function matches(opportunityId: string, query: string): Promise<boolean> {
  const { rows } = await db.execute<{ ok: boolean }>(sql`
    select document @@ plainto_tsquery('portuguese', ${query}) as ok
    from search_documents where opportunity_id = ${opportunityId}
  `);
  return rows[0]?.ok ?? false;
}

async function words(inst = institutionId): Promise<Map<string, number>> {
  const rows = await db.select().from(searchVocabulary).where(eq(searchVocabulary.institutionId, inst));
  return new Map(rows.map((r) => [r.word, r.frequency]));
}

describe("documento de busca", () => {
  it("o wizard indexa o processo com projeto e tags, na mesma escrita", async () => {
    const user = await mkUser("a@unifei.edu.br");
    const { opportunityId } = await createProjectWithOpportunity(
      user,
      wizard(
        validOpportunityInput({
          title: "Bolsista de hidráulica",
          tags: { THEME: [{ name: "Robótica" }], DESIRED_SKILL: [], DEVELOPED_SKILL: [] },
        }),
      ),
    );
    expect(await matches(opportunityId, "hidraulica")).toBe(true);
    expect(await matches(opportunityId, "baja")).toBe(true);
    expect(await matches(opportunityId, "robotica")).toBe(true);
  });

  it("createOpportunity indexa e updateOpportunity reindexa, inclusive as tags novas", async () => {
    const { owner, project } = await setup();
    const { opportunityId } = await createOpportunity(owner, project.id, validOpportunityInput({ title: "Soldador" }));
    expect(await matches(opportunityId, "soldador")).toBe(true);

    await updateOpportunity(
      owner,
      project.id,
      opportunityId,
      validOpportunityInput({
        title: "Torneiro",
        tags: { THEME: [{ name: "Metrologia" }], DESIRED_SKILL: [], DEVELOPED_SKILL: [] },
      }),
    );
    expect(await matches(opportunityId, "soldador")).toBe(false);
    expect(await matches(opportunityId, "torneiro")).toBe(true);
    expect(await matches(opportunityId, "metrologia")).toBe(true);
  });

  it("updateProject atualiza o documento de todos os processos do projeto", async () => {
    const { owner, project } = await setup();
    const a = await createOpportunity(owner, project.id, validOpportunityInput({ title: "Primeiro" }));
    const b = await createOpportunity(owner, project.id, validOpportunityInput({ title: "Segundo" }));

    await updateProject(owner, project.id, validProjectInput({ name: "Aerodesign Mantiqueira", acronym: "AEROMAN" }));

    for (const { opportunityId } of [a, b]) {
      expect(await matches(opportunityId, "mantiqueira")).toBe(true);
      expect(await matches(opportunityId, "aeroman")).toBe(true);
    }
  });

  it("escrita que falha não deixa documento", async () => {
    const user = await mkUser("a@unifei.edu.br");
    await expect(
      createProjectWithOpportunity(user, wizard(validOpportunityInput({ targetCourseIds: [crypto.randomUUID()] }))),
    ).rejects.toThrow();
    expect(await db.select().from(searchDocuments)).toHaveLength(0);
  });

  it("casa derivações e acentos nas duas formas do vetor", async () => {
    const { project } = await setup();
    const a = await mkOpportunity(project.id, { title: "Programação de robôs", description: "Montagem." });
    await rebuildSearchDocuments(institutionId);
    for (const q of ["programador", "programação", "programacao", "robo", "robôs", "robos"]) {
      expect(await matches(a.id, q), q).toBe(true);
    }
  });

  it("dá peso A a título, sigla e tags; B a projeto, área e orientador; C à descrição", async () => {
    const { project } = await setup({ name: "Bravo", acronym: "ALFA", advisorName: "Delta" });
    const opp = await mkOpportunity(project.id, { title: "Eco", roleArea: "Foxtrot", description: "Golf" });
    await tagOpportunity(opp.id, (await mkTag("Hotel"))!.id);
    await rebuildSearchDocuments(institutionId);

    const { rows } = await db.execute<{ lexeme: string; weights: string[] }>(sql`
      select w.lexeme, w.weights from search_documents d, unnest(d.document) as w(lexeme, positions, weights)
      where d.opportunity_id = ${opp.id}
    `);
    const weightOf = (lexeme: string) => [...new Set(rows.find((r) => r.lexeme === lexeme)?.weights)];
    expect(rows.length).toBeGreaterThan(0);
    for (const l of ["eco", "alfa", "hotel"]) expect(weightOf(l), l).toEqual(["A"]);
    for (const l of ["brav", "delt", "foxtrot"]) expect(weightOf(l), l).toEqual(["B"]);
    expect(weightOf("golf")).toEqual(["C"]);
  });

  it("rebuild é idempotente e recria documentos que faltam", async () => {
    const { project } = await setup();
    const opp = await mkOpportunity(project.id, { title: "Solda" });
    await rebuildSearchDocuments(institutionId);
    const snapshot = async () =>
      (
        await db.execute<{ id: string; doc: string }>(
          sql`select opportunity_id as id, document::text as doc from search_documents order by 1`,
        )
      ).rows;
    const first = await snapshot();
    await rebuildSearchDocuments(institutionId);
    expect(await snapshot()).toEqual(first);

    await db.delete(searchDocuments).where(eq(searchDocuments.opportunityId, opp.id));
    await rebuildSearchDocuments(institutionId);
    expect(await snapshot()).toEqual(first);
  });

  it("indexa processo oculto: a visibilidade fica nos predicados da consulta", async () => {
    const { project } = await setup();
    const opp = await mkOpportunity(project.id, { title: "Sigiloso", status: "UNDER_REVIEW" });
    await rebuildSearchDocuments(institutionId);
    expect(await matches(opp.id, "sigiloso")).toBe(true);
  });

  it("rebuild de uma instituição não toca a outra", async () => {
    const foreign = await mkForeignInstitution();
    const project = await mkProject({ institutionId: foreign.id });
    await mkOpportunity(project.id, { title: "Estrangeira" });
    await rebuildSearchDocuments(institutionId);
    expect(await db.select().from(searchDocuments)).toHaveLength(0);
  });
});

describe("vocabulário", () => {
  it("stopwords saem antes do unaccent e a frequência conta processos", async () => {
    const p = await mkProject({ name: "Grupo", acronym: null, advisorName: null });
    await mkOpportunity(p.id, { title: "Até você", description: "Não ate pais país." });
    await rebuildSearchVocabulary(institutionId);
    const rows = await db.select().from(searchVocabulary).where(eq(searchVocabulary.institutionId, institutionId));
    const words = new Map(rows.map((r) => [r.word, r.frequency]));
    for (const w of ["ate", "voce", "nao"]) expect(words.has(w), w).toBe(false);
    expect(words.get("pais")).toBe(1);
  });

  it("reúne título, área, descrição, projeto, sigla, orientador e tags, normalizados", async () => {
    const { project } = await setup({ name: "Hidráulica Aplicada", acronym: "HIDRA", advisorName: "Profa. Conceição" });
    const opp = await mkOpportunity(project.id, {
      title: "Bolsista de Robótica",
      roleArea: "Mecatrônica",
      description: "Ação em Itajubá, 2026, C3PO: veja [edital](https://exemplo.org/caminho-secreto).",
    });
    await tagOpportunity(opp.id, (await mkTag("Metrologia"))!.id);
    await rebuildSearchVocabulary(institutionId);

    const v = await words();
    for (const w of [
      "hidraulica",
      "aplicada",
      "hidra",
      "conceicao",
      "bolsista",
      "robotica",
      "mecatronica",
      "acao",
      "itajuba",
      "metrologia",
    ]) {
      expect(v.has(w), w).toBe(true);
    }
    for (const w of v.keys()) expect(w, w).toMatch(/^[a-z]{3,}$/);
    expect(v.has("exemplo")).toBe(false);
    expect(v.has("c3po")).toBe(false);
  });

  it("conta em quantos processos públicos a palavra aparece", async () => {
    const { project } = await setup();
    await mkOpportunity(project.id, { title: "Telhado telhado", description: "Telhado" });
    await mkOpportunity(project.id, { title: "Telhado" });
    await rebuildSearchVocabulary(institutionId);
    expect((await words()).get("telhado")).toBe(2);
  });

  it("inclui encerrado e projeto arquivado; exclui oculto e projeto fora do público", async () => {
    const { project } = await setup();
    const archived = await mkProject({ status: "ARCHIVED" });
    const suspended = await mkProject({ status: "SUSPENDED" });
    await mkOpportunity(project.id, { title: "Encerrado", status: "CLOSED" });
    await mkOpportunity(project.id, { title: "Vencido", deadlineAt: new Date(Date.now() - 1000) });
    await mkOpportunity(archived.id, { title: "Arquivado" });
    await mkOpportunity(project.id, { title: "Sigiloso", status: "UNDER_REVIEW" });
    await mkOpportunity(suspended.id, { title: "Suspenso" });
    await rebuildSearchVocabulary(institutionId);

    const v = await words();
    expect(v.has("encerrado")).toBe(true);
    expect(v.has("vencido")).toBe(true);
    expect(v.has("arquivado")).toBe(true);
    expect(v.has("sigiloso")).toBe(false);
    expect(v.has("suspenso")).toBe(false);
  });

  it("remove a palavra quando o processo vai para UNDER_REVIEW ou o projeto para SUSPENDED", async () => {
    const { project } = await setup();
    const opp = await mkOpportunity(project.id, { title: "Efemero" });
    const other = await mkProject();
    await mkOpportunity(other.id, { title: "Passageiro" });
    await rebuildSearchVocabulary(institutionId);
    expect((await words()).has("efemero")).toBe(true);
    expect((await words()).has("passageiro")).toBe(true);

    await db.update(opportunities).set({ status: "UNDER_REVIEW" }).where(eq(opportunities.id, opp.id));
    await rebuildSearchVocabulary(institutionId);
    expect((await words()).has("efemero")).toBe(false);

    await db.update(projects).set({ status: "SUSPENDED" }).where(eq(projects.id, other.id));
    await rebuildSearchVocabulary(institutionId);
    expect((await words()).has("passageiro")).toBe(false);
  });

  it("acompanha as escritas: criar, editar, encerrar e arquivar", async () => {
    const { owner, project } = await setup();
    const { opportunityId } = await createOpportunity(owner, project.id, validOpportunityInput({ title: "Soldador" }));
    expect((await words()).has("soldador")).toBe(true);

    await updateOpportunity(owner, project.id, opportunityId, validOpportunityInput({ title: "Torneiro" }));
    expect((await words()).has("soldador")).toBe(false);
    expect((await words()).has("torneiro")).toBe(true);

    await updateProject(owner, project.id, validProjectInput({ name: "Oficina Mantiqueira" }));
    expect((await words()).has("mantiqueira")).toBe(true);

    await closeOpportunity(owner, project.id, opportunityId);
    expect((await words()).has("torneiro")).toBe(true);

    await archiveProject(owner, project.id);
    expect((await words()).has("torneiro")).toBe(true);
  });

  it("o wizard alimenta o vocabulário", async () => {
    const user = await mkUser("a@unifei.edu.br");
    await createProjectWithOpportunity(user, wizard(validOpportunityInput({ title: "Hidrologia" })));
    expect((await words()).has("hidrologia")).toBe(true);
  });

  it("rebuild é idempotente e fica dentro da instituição", async () => {
    const { project } = await setup();
    await mkOpportunity(project.id, { title: "Solda" });
    const foreign = await mkForeignInstitution();
    const foreignProject = await mkProject({ institutionId: foreign.id });
    await mkOpportunity(foreignProject.id, { title: "Estrangeira" });

    await rebuildSearchVocabulary(institutionId);
    const first = await words();
    await rebuildSearchVocabulary(institutionId);
    expect(await words()).toEqual(first);
    expect(first.has("estrangeira")).toBe(false);
    expect((await words(foreign.id)).size).toBe(0);
  });

  it("palavra enorme fica de fora e não trava a reconstrução", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { owner, project } = await setup();
    const { opportunityId } = await createOpportunity(owner, project.id, validOpportunityInput({ title: "Soldador" }));
    const huge = "a".repeat(300);
    const longest = "b".repeat(40);

    await updateOpportunity(
      owner,
      project.id,
      opportunityId,
      validOpportunityInput({
        title: "Torneiro",
        description: `Descrição com ${huge}, ${longest} e ${"c".repeat(41)}.`,
      }),
    );

    const [row] = await db.select().from(opportunities).where(eq(opportunities.id, opportunityId));
    expect(row.title).toBe("Torneiro");
    const v = await words();
    expect(log).not.toHaveBeenCalled();
    expect(v.has("torneiro")).toBe(true);
    expect(v.has("soldador")).toBe(false);
    expect(v.has(longest)).toBe(true);
    expect([...v.keys()].filter((w) => w.length > 40)).toEqual([]);
  });

  it("rebuilds concorrentes não colidem", async () => {
    const { project } = await setup();
    await mkOpportunity(project.id, { title: "Solda" });
    await Promise.all(Array.from({ length: 5 }, () => rebuildSearchVocabulary(institutionId)));
    expect((await words()).get("solda")).toBe(1);
  });

  describe("quando a reconstrução falha", () => {
    // Falha real no banco: a tabela some durante a escrita e volta no fim.
    async function withBrokenVocabulary(fn: () => Promise<void>) {
      await db.execute(sql`alter table search_vocabulary rename to search_vocabulary_off`);
      try {
        await fn();
      } finally {
        await db.execute(sql`alter table search_vocabulary_off rename to search_vocabulary`);
      }
    }

    it("scheduleVocabularyRebuild registra o erro e não rejeita", async () => {
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      await withBrokenVocabulary(() => expect(scheduleVocabularyRebuild(institutionId)).resolves.toBeUndefined());
      expect(log).toHaveBeenCalledOnce();
    });

    it("não aborta nenhuma escrita, e o documento é salvo", async () => {
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      const { owner, project } = await setup();
      const { opportunityId } = await createOpportunity(
        owner,
        project.id,
        validOpportunityInput({ title: "Soldador" }),
      );

      await withBrokenVocabulary(async () => {
        await updateOpportunity(owner, project.id, opportunityId, validOpportunityInput({ title: "Torneiro" }));
        await updateProject(owner, project.id, validProjectInput({ name: "Oficina Mantiqueira" }));
        await closeOpportunity(owner, project.id, opportunityId);
        await archiveProject(owner, project.id);
      });

      expect(log).toHaveBeenCalledTimes(4);
      const [row] = await db.select().from(opportunities).where(eq(opportunities.id, opportunityId));
      expect(row).toMatchObject({ title: "Torneiro", status: "CLOSED" });
      expect(await matches(opportunityId, "torneiro")).toBe(true);
      expect(await matches(opportunityId, "mantiqueira")).toBe(true);
    });
  });
});

describe("carga inicial", () => {
  it("o seed grava os sinônimos normalizados, sem duplicar", async () => {
    await runSeed();
    const rows = await db.select().from(searchSynonyms).where(eq(searchSynonyms.institutionId, institutionId));
    expect(rows).toHaveLength(SYNONYMS.length);
    for (const [term, canonical] of [
      ["ic", "iniciacao cientifica"],
      ["engenheiro", "engenharia"],
      ["robo", "robotica"],
      ["programador", "programacao"],
      ["pibic", "iniciacao cientifica"],
      ["empresa jr", "empresa junior"],
    ]) {
      expect(
        rows.some((r) => r.term === term && r.canonical === canonical),
        term,
      ).toBe(true);
    }
    for (const r of rows) {
      expect(normalizeQuery(r.term)).toBe(r.term);
      expect(normalizeQuery(r.canonical)).toBe(r.canonical);
      expect(`${r.term} ${r.canonical}`).not.toMatch(/\btcc\b/);
    }
  });

  it("o seed de demonstração deixa documentos e vocabulário prontos", async () => {
    await runDemoSeed();
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(opportunities);
    expect(await db.select().from(searchDocuments)).toHaveLength(n);
    expect((await words()).has("suspensao")).toBe(true);
    const [doc] = await db
      .select({ id: searchDocuments.opportunityId })
      .from(searchDocuments)
      .innerJoin(opportunities, eq(opportunities.id, searchDocuments.opportunityId))
      .where(and(eq(opportunities.slug, "demo-projetista-suspensao")));
    expect(await matches(doc.id, "projetista")).toBe(true);
  });
});

describe("escritas concorrentes", () => {
  it("editar o projeto e um processo dele ao mesmo tempo mantém os dois textos no documento", async () => {
    const { project } = await setup();
    const opp = await mkOpportunity(project.id, { title: "Antigo" });
    await rebuildSearchDocuments(institutionId);

    let projectIndexed!: () => void;
    let commitProject!: () => void;
    const indexed = new Promise<void>((r) => (projectIndexed = r));
    const commit = new Promise<void>((r) => (commitProject = r));

    const editProject = db.transaction(async (tx) => {
      await tx.update(projects).set({ name: "Mantiqueira" }).where(eq(projects.id, project.id));
      await refreshProjectSearchDocuments(tx, project.id);
      projectIndexed();
      await commit;
    });
    await indexed;
    const editOpportunity = db.transaction(async (tx) => {
      await tx.update(opportunities).set({ title: "Torneiro" }).where(eq(opportunities.id, opp.id));
      await refreshSearchDocument(tx, opp.id);
    });
    await new Promise((r) => setTimeout(r, 100));
    commitProject();
    await Promise.all([editProject, editOpportunity]);

    expect(await matches(opp.id, "mantiqueira")).toBe(true);
    expect(await matches(opp.id, "torneiro")).toBe(true);
  });

  it("rebuild com edição em andamento espera o commit e não regrava o texto antigo", async () => {
    const { project } = await setup();
    const opp = await mkOpportunity(project.id, { title: "Antigo" });
    await rebuildSearchDocuments(institutionId);

    let edited!: () => void;
    let commit!: () => void;
    const editedP = new Promise<void>((r) => (edited = r));
    const commitP = new Promise<void>((r) => (commit = r));
    const edit = db.transaction(async (tx) => {
      await tx.update(opportunities).set({ title: "Torneiro" }).where(eq(opportunities.id, opp.id));
      await refreshSearchDocument(tx, opp.id);
      edited();
      await commitP;
    });
    await editedP;
    const rebuild = rebuildSearchDocuments(institutionId);
    await new Promise((r) => setTimeout(r, 100));
    commit();
    await Promise.all([edit, rebuild]);

    expect(await matches(opp.id, "torneiro")).toBe(true);
  });

  /** Com a trava do projeto em posse de outra transação, a escrita não pode ter travado nenhuma linha. */
  async function assertNoRowLockedWhileWaiting(
    projectId: string,
    opportunityId: string,
    write: () => Promise<unknown>,
  ) {
    let held!: () => void;
    let release!: () => void;
    const heldP = new Promise<void>((r) => (held = r));
    const releaseP = new Promise<void>((r) => (release = r));
    const holder = db.transaction(async (tx) => {
      await lockProjectSearchDocuments(tx, projectId);
      held();
      await releaseP;
    });
    await heldP;
    const writing = write();
    await new Promise((r) => setTimeout(r, 150));
    try {
      await db.transaction((tx) =>
        tx.select().from(opportunities).where(eq(opportunities.id, opportunityId)).for("update", { noWait: true }),
      );
      await db.transaction((tx) =>
        tx.select().from(projects).where(eq(projects.id, projectId)).for("update", { noWait: true }),
      );
    } finally {
      release();
      await Promise.all([holder, writing]);
    }
  }

  it("updateOpportunity e closeOpportunity pegam a trava do projeto antes das linhas", async () => {
    const { owner, project } = await setup();
    const { opportunityId } = await createOpportunity(owner, project.id, validOpportunityInput());
    await assertNoRowLockedWhileWaiting(project.id, opportunityId, () =>
      updateOpportunity(owner, project.id, opportunityId, validOpportunityInput({ title: "Torneiro" })),
    );
    await assertNoRowLockedWhileWaiting(project.id, opportunityId, () =>
      closeOpportunity(owner, project.id, opportunityId),
    );
  });

  it("updateProject e archiveProject pegam a trava do projeto antes das linhas", async () => {
    const { owner, project } = await setup();
    const { opportunityId } = await createOpportunity(owner, project.id, validOpportunityInput());
    await assertNoRowLockedWhileWaiting(project.id, opportunityId, () =>
      updateProject(owner, project.id, validProjectInput()),
    );
    await assertNoRowLockedWhileWaiting(project.id, opportunityId, () => archiveProject(owner, project.id));
  });

  it("createOpportunity pega a trava do projeto antes de mexer nas tags", async () => {
    const { owner, project } = await setup();
    const tag = (await mkTag("Metrologia"))!;
    const { opportunityId } = await createOpportunity(owner, project.id, validOpportunityInput());
    await assertNoRowLockedWhileWaiting(project.id, opportunityId, async () => {
      await createOpportunity(
        owner,
        project.id,
        validOpportunityInput({ tags: { THEME: [{ id: tag.id }], DESIRED_SKILL: [], DEVELOPED_SKILL: [] } }),
      );
    });
    expect(await db.select().from(opportunityTags).where(eq(opportunityTags.tagId, tag.id))).toHaveLength(1);
  });
});
