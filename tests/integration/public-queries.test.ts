import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { searchSynonyms, tagAliases } from "@/db/schema";
import { rebuildSearch } from "@/db/search-rebuild";
import { runSeed } from "@/db/seed";
import {
  getPublicOpportunity,
  getPublicProject,
  listFilterOptions,
  listHomeRows,
  searchOpportunities,
  PAGE_SIZE,
  ROW_LIMIT,
} from "@/lib/public/queries";
import { parseVitrineParams } from "@/lib/public/search-params";
import { getDefaultInstitution } from "@/lib/tenant";
import { resetDb } from "../helpers/db";
import { mkCourse, mkForeignInstitution, mkOpportunity, mkProject, mkTag, tagOpportunity } from "../helpers/fixtures";

const H = 3_600_000;
const D = 24 * H;
let inst: string;

const search = (raw: Record<string, string | string[]>, now?: Date) =>
  searchOpportunities(inst, parseVitrineParams(raw), now);
const titles = async (raw: Record<string, string | string[]>) =>
  (await search(raw)).items.map((i) => i.title);

beforeEach(async () => {
  await resetDb();
  await runSeed();
  inst = (await getDefaultInstitution()).id;
});

describe("busca", () => {
  it("normaliza acentos, por similaridade, tag, orientador e sigla", async () => {
    const p = await mkProject({ name: "Equipe Alfa", acronym: "ALFA", advisorName: "Profa. Hortênsia" });
    const o = await mkOpportunity(p.id, { title: "Bolsista de Robótica" });
    await mkOpportunity(p.id, { title: "Outra coisa" });
    const tag = await mkTag("Aerodinâmica");
    await tagOpportunity(o.id, tag!.id);
    expect(await titles({ q: "robotica" })).toEqual(["Bolsista de Robótica"]);
    expect(await titles({ q: "ROBÓTICA" })).toEqual(["Bolsista de Robótica"]);
    expect(await titles({ q: "robotcia" })).toEqual(["Bolsista de Robótica"]);
    expect(await titles({ q: "aerodinamica" })).toEqual(["Bolsista de Robótica"]);
    expect(await titles({ q: "hortensia" })).toHaveLength(2);
    expect(await titles({ q: "alfa" })).toHaveLength(2);
    expect(await titles({ q: "zzzzzz" })).toEqual([]);
  });

  it("caracteres especiais não quebram nem casam tudo", async () => {
    const p = await mkProject();
    await mkOpportunity(p.id, { title: "Desconto de 100% real" });
    await mkOpportunity(p.id, { title: "Programação C++" });
    await mkOpportunity(p.id, { title: "Vaga qualquer" });
    await mkOpportunity(p.id, { title: "Engenharia de Computação" });
    await mkOpportunity(p.id, { title: "1000 vagas" });
    await mkOpportunity(p.id, { title: "O'Brien lab" });
    expect(await titles({ q: "100%" })).toEqual(["Desconto de 100% real"]);
    expect(await titles({ q: "_" })).toEqual([]);
    expect(await titles({ q: "\\" })).toEqual([]);
    expect(await titles({ q: "C++" })).toEqual(["Programação C++"]);
    expect(await titles({ q: "'" })).toEqual(["O'Brien lab"]);
    expect((await search({ q: "%" })).total).toBe(1);
  });

  it("q vazia ou só de espaços equivale a sem busca; relevance sem q cai em recent", async () => {
    const p = await mkProject();
    await mkOpportunity(p.id, { title: "A" });
    await mkOpportunity(p.id, { title: "B" });
    expect((await search({ q: "   ", sort: "relevance" })).total).toBe(2);
  });

  it("relevância ordena por similaridade", async () => {
    const p = await mkProject();
    await mkOpportunity(p.id, { title: "Laboratório de robótica avançada e mais" });
    await mkOpportunity(p.id, { title: "Robotica" });
    expect((await titles({ q: "robotica" }))[0]).toBe("Robotica");
  });
});

describe("relevância com acerto exato", () => {
  it("acerto exato (sigla, área, orientador) vem antes de acerto aproximado", async () => {
    const fuzzy = await mkProject({ name: "Grupo A" });
    const exact = await mkProject({ name: "Grupo B", acronym: "ROBOTICA" });
    await mkOpportunity(exact.id, { title: "Vaga de apoio" });
    // Criado depois (desempate por recência o poria primeiro) e com título quase igual.
    await mkOpportunity(fuzzy.id, { title: "Robotca" });
    expect(await titles({ q: "robotica" })).toEqual(["Vaga de apoio", "Robotca"]);
  });
});

describe("busca em camadas", () => {
  const reindex = () => rebuildSearch(inst);

  it("derivação, plural e acento pelo índice, nas duas formas", async () => {
    const p = await mkProject();
    await mkOpportunity(p.id, { title: "Monitor de programação" });
    await mkOpportunity(p.id, { title: "Oficina de robôs" });
    await reindex();
    for (const q of ["programador", "programacao", "programação", "programar"]) {
      expect(await titles({ q }), q).toEqual(["Monitor de programação"]);
    }
    for (const q of ["robo", "robô", "robos"]) expect(await titles({ q }), q).toEqual(["Oficina de robôs"]);
  });

  it("título exato antes de todos os termos no título, depois no corpo, depois algum termo", async () => {
    const p = await mkProject();
    const some = await mkOpportunity(p.id, { title: "Só energia aqui", description: "Texto." });
    const body = await mkOpportunity(p.id, { title: "Vaga geral", description: "Fala de energia solar." });
    const all = await mkOpportunity(p.id, { title: "Solar e energia", description: "Texto." });
    const exact = await mkOpportunity(p.id, { title: "Energia solar", description: "Texto." });
    await reindex();
    const { items } = await search({ q: "energia solar" });
    expect(items.map((i) => i.slug)).toEqual([exact.slug, all.slug, body.slug, some.slug]);
  });

  it("palavra inteira vence radical: casa antes de caso", async () => {
    const p = await mkProject();
    await mkOpportunity(p.id, { title: "Casa inteligente", createdAt: new Date(Date.now() - 2 * H) });
    await mkOpportunity(p.id, { title: "Estudo de caso", createdAt: new Date(Date.now() - H) });
    await reindex();
    expect(await titles({ q: "casa" })).toEqual(["Casa inteligente", "Estudo de caso"]);
  });

  it("resultado só de termo corrigido vem depois de todo resultado do termo digitado", async () => {
    const p = await mkProject();
    await mkOpportunity(p.id, { title: "Python avançado", createdAt: new Date(Date.now() - H) });
    await mkOpportunity(p.id, { title: "Bolsa qualquer", createdAt: new Date(Date.now() - 2 * H) });
    await mkOpportunity(p.id, { title: "Bolsa de python", createdAt: new Date(Date.now() - 3 * H) });
    await reindex();
    expect(await titles({ q: "bolsa pyhton" })).toEqual(["Bolsa de python", "Bolsa qualquer", "Python avançado"]);
  });

  it("texto literal digitado vem antes do que só casa pela correção", async () => {
    const p = await mkProject();
    await mkOpportunity(p.id, { title: "Bolsa de Python", createdAt: new Date(Date.now() - H) });
    await reindex();
    // Fora do vocabulário: criado depois da reconstrução.
    await mkOpportunity(p.id, { title: "Grupo pyhton", createdAt: new Date(Date.now() - 2 * H) });
    expect(await titles({ q: "pyhton" })).toEqual(["Grupo pyhton", "Bolsa de Python"]);
  });

  it("aberto antes de encerrado mesmo quando o encerrado é exato", async () => {
    const p = await mkProject();
    await mkOpportunity(p.id, { title: "Robótica", deadlineAt: new Date(Date.now() - D) });
    await mkOpportunity(p.id, { title: "Vaga", description: "Fala de robótica." });
    await reindex();
    expect(await titles({ q: "robotica", encerrados: "1" })).toEqual(["Vaga", "Robótica"]);
  });

  it("devolve a correção e corrigir=0 a desliga", async () => {
    const p = await mkProject();
    await mkOpportunity(p.id, { title: "Casa inteligente" });
    await reindex();
    const r = await search({ q: "casinha" });
    expect(r.items.map((i) => i.title)).toEqual(["Casa inteligente"]);
    expect(r.total).toBe(1);
    expect(r.correction).toEqual({ original: "casinha", corrected: "casa" });

    const exact = await search({ q: "casinha", corrigir: "0" });
    expect(exact.items).toEqual([]);
    expect(exact.correction).toBeNull();

    expect((await search({ q: "casa" })).correction).toBeNull();
    expect((await search({})).correction).toBeNull();
    expect((await search({ q: "xqzwvk" })).correction).toBeNull();
  });

  it("aspas: não corrige e busca a expressão", async () => {
    const p = await mkProject();
    await mkOpportunity(p.id, { title: "Casa inteligente" });
    await mkOpportunity(p.id, { title: "Inteligente é a casa" });
    await reindex();
    const r = await search({ q: '"casa inteligente"' });
    expect(r.items.map((i) => i.title)).toEqual(["Casa inteligente"]);
    expect(r.correction).toBeNull();
    expect((await search({ q: '"casinha"' })).items).toEqual([]);
  });

  it("só sinais ou palavras comuns não dão erro e seguem no LIKE", async () => {
    const p = await mkProject();
    await mkOpportunity(p.id, { title: "Grito!!! na sala", description: "Texto." });
    await mkOpportunity(p.id, { title: "Estudo de grafos", description: "Texto." });
    await mkOpportunity(p.id, { title: "Sala a b", description: "Texto." });
    await reindex();
    expect(await titles({ q: "!!!" })).toEqual(["Grito!!! na sala"]);
    expect(await titles({ q: "de" })).toContain("Estudo de grafos");
    expect(await titles({ q: "a" })).toContain("Sala a b");
    expect((await search({ q: "de a" })).total).toBe(0);
  });

  it("sintaxe de tsquery no texto do usuário é só texto", async () => {
    const p = await mkProject();
    await mkOpportunity(p.id, { title: "Bolsa de Python" });
    await reindex();
    for (const q of ["python & | ! ( ) : * ' \\", "a:*", "<->", "python:A", "'", "&", "!python", "(python"]) {
      await expect(search({ q }), q).resolves.toBeDefined();
    }
    expect(await titles({ q: "python & bolsa" })).toEqual(["Bolsa de Python"]);
  });

  it("C++ não vira a letra C no índice; termo com símbolo entra por LIKE, sigla curta inteira", async () => {
    const p = await mkProject();
    const c = await mkOpportunity(p.id, { title: "Firmware em C" });
    await mkOpportunity(p.id, { title: "Programação C++" });
    await mkOpportunity(p.id, { title: "Física aplicada", description: "Científica." });
    const ic = await mkOpportunity(p.id, { title: "Vaga de IC" });
    await reindex();
    expect(c.title).toBe("Firmware em C");
    expect(await titles({ q: "C++" })).toEqual(["Programação C++"]);
    expect(await titles({ q: "programação c++" })).toEqual(["Programação C++"]);
    expect((await titles({ q: "ic" }))[0]).toBe(ic.title);
    expect(await titles({ q: "ic" })).not.toContain("Física aplicada");
  });

  it("sinônimos nos dois sentidos, frase inclusive", async () => {
    const p = await mkProject();
    await mkOpportunity(p.id, { title: "Vaga de IC" });
    await mkOpportunity(p.id, { title: "Iniciação científica em física" });
    await mkOpportunity(p.id, { title: "Curso de engenharia" });
    await reindex();
    const both = ["Iniciação científica em física", "Vaga de IC"].sort();
    expect((await titles({ q: "ic" })).sort()).toEqual(both);
    expect((await titles({ q: "iniciação científica" })).sort()).toEqual(both);
    expect(await titles({ q: "engenheiro" })).toEqual(["Curso de engenharia"]);
    expect(await titles({ q: "engenheiros" })).toEqual(["Curso de engenharia"]);
    await db.insert(searchSynonyms).values({ institutionId: inst, term: "aviao", canonical: "curso" });
    expect(await titles({ q: "avião" })).toEqual(["Curso de engenharia"]);
    expect(await titles({ q: "cursos" })).toEqual(["Curso de engenharia"]);
  });

  it("aspas não expandem sinônimos", async () => {
    const p = await mkProject();
    await mkOpportunity(p.id, { title: "Iniciação científica em física" });
    await reindex();
    expect(await titles({ q: '"ic"' })).toEqual([]);
  });

  it("tag_aliases: slug leva ao nome canônico da tag", async () => {
    const p = await mkProject();
    const o = await mkOpportunity(p.id, { title: "Vaga" });
    const tag = await mkTag("Aprendizado de máquina");
    await tagOpportunity(o.id, tag!.id);
    await db.insert(tagAliases).values([
      { institutionId: inst, aliasSlug: "ml", canonicalTagId: tag!.id },
      { institutionId: inst, aliasSlug: "machine-learning", canonicalTagId: tag!.id },
    ]);
    await reindex();
    expect(await titles({ q: "ml" })).toEqual(["Vaga"]);
    expect(await titles({ q: "machine learning" })).toEqual(["Vaga"]);
  });

  it("processo sem documento continua achável por LIKE, com total igual", async () => {
    const p = await mkProject();
    await reindex();
    await mkOpportunity(p.id, { title: "Sem índice ainda" });
    const r = await search({ q: "indice" });
    expect(r.items.map((i) => i.title)).toEqual(["Sem índice ainda"]);
    expect(r.total).toBe(1);
  });

  it("similaridade de trigramas não vale para processo indexado", async () => {
    const p = await mkProject();
    await mkOpportunity(p.id, { title: "Coletivo de Tecnologia", description: "Agroecologia." });
    await reindex();
    expect(await titles({ q: "astrologia" })).toEqual([]);
  });

  it("consulta muito longa é limitada e não quebra", async () => {
    const p = await mkProject();
    await mkOpportunity(p.id, { title: "Python" });
    await reindex();
    expect(await titles({ q: Array.from({ length: 50 }, () => "python").join(" ") })).toEqual(["Python"]);
    await expect(search({ q: Array.from({ length: 50 }, (_, i) => `a${i}`).join(" ") })).resolves.toBeDefined();
  });
});

describe("visibilidade e filtros", () => {
  it("UNDER_REVIEW e SUSPENDED nunca aparecem; outra instituição também não", async () => {
    const ok = await mkProject();
    const susp = await mkProject({ status: "SUSPENDED" });
    const review = await mkProject({ status: "UNDER_REVIEW" });
    const foreign = await mkForeignInstitution();
    const fp = await mkProject({ institutionId: foreign.id });
    await mkOpportunity(ok.id, { title: "Visível" });
    await mkOpportunity(ok.id, { title: "Em revisão", status: "UNDER_REVIEW" });
    await mkOpportunity(susp.id, { title: "Suspenso" });
    await mkOpportunity(review.id, { title: "Projeto em revisão" });
    await mkOpportunity(fp.id, { title: "Estrangeiro" });
    expect(await titles({ encerrados: "1" })).toEqual(["Visível"]);
  });

  it("encerrados só com encerrados=1 e depois dos abertos; arquivado só como encerrado", async () => {
    const p = await mkProject();
    const arch = await mkProject({ status: "ARCHIVED", name: "Arquivo" });
    const old = await mkOpportunity(p.id, { title: "Vencido", deadlineAt: new Date(Date.now() - D) });
    await mkOpportunity(p.id, { title: "Aberto" });
    await mkOpportunity(arch.id, { title: "Do arquivo" });
    await mkOpportunity(p.id, { title: "Fechado", status: "CLOSED", closedAt: new Date(Date.now() - H) });
    expect(await titles({})).toEqual(["Aberto"]);
    const r = await search({ encerrados: "1" });
    expect(r.items[0].title).toBe("Aberto");
    expect(r.items[0].isOpen).toBe(true);
    expect(r.total).toBe(4);
    const archived = r.items.find((i) => i.title === "Do arquivo")!;
    expect(archived.isOpen).toBe(false);
    expect(archived.closedOn).toBeNull();
    expect(r.items.find((i) => i.title === "Vencido")!.closedOn).toEqual(old.deadlineAt);
    for (const it of r.items.slice(1)) expect(it.isOpen).toBe(false);
  });

  it("scholarship=PAID inclui BOTH", async () => {
    const p = await mkProject();
    await mkOpportunity(p.id, { title: "Paga", scholarshipType: "PAID" });
    await mkOpportunity(p.id, { title: "Ambos", scholarshipType: "BOTH" });
    await mkOpportunity(p.id, { title: "Voluntária", scholarshipType: "VOLUNTARY" });
    expect((await titles({ scholarship: "PAID" })).sort()).toEqual(["Ambos", "Paga"]);
    expect((await titles({ scholarship: "VOLUNTARY" })).sort()).toEqual(["Ambos", "Voluntária"]);
  });

  it("course inclui processo sem cursos definidos", async () => {
    const p = await mkProject();
    const cco = await mkCourse("CCO");
    const eme = await mkCourse("EME");
    await mkOpportunity(p.id, { title: "Só CCO", targetCourseIds: [cco.id] });
    await mkOpportunity(p.id, { title: "Só EME", targetCourseIds: [eme.id] });
    await mkOpportunity(p.id, { title: "Todos" });
    expect((await titles({ course: "CCO" })).sort()).toEqual(["Só CCO", "Todos"]);
    expect((await titles({ course: "XXX" })).sort()).toEqual(["Todos"]);
  });

  it("category repetida", async () => {
    const a = await mkProject({ category: "PET" });
    const b = await mkProject({ category: "EXTENSION" });
    const c = await mkProject({ category: "OTHER" });
    await mkOpportunity(a.id, { title: "A" });
    await mkOpportunity(b.id, { title: "B" });
    await mkOpportunity(c.id, { title: "C" });
    expect((await titles({ category: ["PET", "EXTENSION"] })).sort()).toEqual(["A", "B"]);
  });

  it("tags é AND; várias tags não duplicam e total bate", async () => {
    const p = await mkProject();
    const py = await mkTag("Python");
    const cad = await mkTag("CAD");
    const both = await mkOpportunity(p.id, { title: "Ambas" });
    const one = await mkOpportunity(p.id, { title: "Só python" });
    for (const rel of ["THEME", "DESIRED_SKILL"] as const) await tagOpportunity(both.id, py.id, rel);
    await tagOpportunity(both.id, cad.id, "DEVELOPED_SKILL");
    await tagOpportunity(one.id, py.id);
    expect(await titles({ tags: "python,cad" })).toEqual(["Ambas"]);
    const r = await search({ tags: "python", category: ["LAB_GROUP", "PET"], q: "python" });
    expect(r.items.map((i) => i.title).sort()).toEqual(["Ambas", "Só python"]);
    expect(r.total).toBe(2);
  });

  it("paginação: page=999 devolve a última; total consistente", async () => {
    const p = await mkProject();
    const n = PAGE_SIZE * 2 + 3;
    for (let i = 0; i < n; i++) await mkOpportunity(p.id, { title: `Vaga ${i}` });
    const last = await search({ page: "999" });
    expect(last.page).toBe(3);
    expect(last.pageCount).toBe(3);
    expect(last.total).toBe(n);
    expect(last.items).toHaveLength(3);
    const seen = new Set<string>();
    for (const page of ["1", "2", "3"]) for (const it of (await search({ page })).items) seen.add(it.slug);
    expect(seen.size).toBe(n);
    const empty = await search({ q: "naoexiste" });
    expect(empty).toMatchObject({ items: [], total: 0, page: 1, pageCount: 1 });
  });

  it("popular ordena pela soma de visitas e cliques", async () => {
    const p = await mkProject();
    await mkOpportunity(p.id, { title: "A", viewsCount: 5, externalClicksCount: 0 });
    await mkOpportunity(p.id, { title: "B", viewsCount: 2, externalClicksCount: 2 });
    await mkOpportunity(p.id, { title: "C", viewsCount: 0, externalClicksCount: 9 });
    expect(await titles({ sort: "popular" })).toEqual(["C", "A", "B"]);
  });

  it("deadline ordena abertos pelo prazo mais próximo", async () => {
    const p = await mkProject();
    await mkOpportunity(p.id, { title: "Longe", deadlineAt: new Date(Date.now() + 20 * D) });
    await mkOpportunity(p.id, { title: "Perto", deadlineAt: new Date(Date.now() + 2 * D) });
    expect(await titles({ sort: "deadline" })).toEqual(["Perto", "Longe"]);
  });

  it("cartão: até 4 tags, THEME primeiro, courseCount", async () => {
    const p = await mkProject({ acronym: "SIG", hasInstitutionalBadge: true });
    const o = await mkOpportunity(p.id, { title: "Com tags", targetCourseIds: [(await mkCourse("CCO")).id] });
    await tagOpportunity(o.id, (await mkTag("Zeta")).id, "DESIRED_SKILL");
    for (const n of ["Beta", "Alfa", "Gama", "Delta"]) await tagOpportunity(o.id, (await mkTag(n)).id, "THEME");
    const [card] = (await search({})).items;
    expect(card.tags).toEqual(["Alfa", "Beta", "Delta", "Gama"]);
    expect(card).toMatchObject({ projectAcronym: "SIG", verified: true, courseCount: 1, isOpen: true, closedOn: null });
  });
});

describe("home", () => {
  it("só abertos, respeita limites e popular exclui soma 0", async () => {
    const p = await mkProject();
    for (let i = 0; i < ROW_LIMIT + 3; i++) {
      await mkOpportunity(p.id, { title: `Aberta ${i}`, viewsCount: i === 0 ? 4 : 0 });
    }
    await mkOpportunity(p.id, { title: "Vencida", deadlineAt: new Date(Date.now() - D), viewsCount: 99 });
    const rows = await listHomeRows(inst);
    expect(rows.openCount).toBe(ROW_LIMIT + 3);
    expect(rows.recent).toHaveLength(ROW_LIMIT);
    expect(rows.closing).toHaveLength(ROW_LIMIT);
    expect(rows.popular.map((c) => c.title)).toEqual(["Aberta 0"]);
    for (const c of [...rows.recent, ...rows.closing]) expect(c.isOpen).toBe(true);
  });

  it("sem abertos devolve tudo vazio", async () => {
    const p = await mkProject();
    await mkOpportunity(p.id, { deadlineAt: new Date(Date.now() - D) });
    expect(await listHomeRows(inst)).toEqual({ openCount: 0, recent: [], closing: [], popular: [] });
  });
});

describe("detalhes", () => {
  it("getPublicOpportunity: aberto, encerrado e oculto", async () => {
    const p = await mkProject({ name: "Equipe X" });
    const cco = await mkCourse("CCO");
    const open = await mkOpportunity(p.id, { slug: "aberta", targetCourseIds: [cco.id] });
    await tagOpportunity(open.id, (await mkTag("Python")).id, "DESIRED_SKILL");
    await mkOpportunity(p.id, { slug: "vencida", deadlineAt: new Date(Date.now() - D) });
    await mkOpportunity(p.id, { slug: "oculta", status: "UNDER_REVIEW" });
    const a = (await getPublicOpportunity(inst, "aberta"))!;
    expect(a.isOpen).toBe(true);
    expect(a.closedOn).toBeNull();
    expect(a.courses).toEqual([{ code: "CCO", name: cco.name }]);
    expect(a.tags.DESIRED_SKILL).toEqual([{ slug: "python", name: "Python" }]);
    expect(a.project.name).toBe("Equipe X");
    const v = (await getPublicOpportunity(inst, "vencida"))!;
    expect(v.isOpen).toBe(false);
    expect(v.closedOn).toBeInstanceOf(Date);
    expect(await getPublicOpportunity(inst, "oculta")).toBeNull();
    expect(await getPublicOpportunity(inst, "nao-existe")).toBeNull();
    const foreign = await mkForeignInstitution();
    expect(await getPublicOpportunity(foreign.id, "aberta")).toBeNull();
  });

  it("getPublicProject: separa abertos e encerrados; oculta suspenso e em revisão", async () => {
    const p = await mkProject();
    const susp = await mkProject({ status: "SUSPENDED" });
    const review = await mkProject({ status: "UNDER_REVIEW" });
    await mkOpportunity(p.id, { title: "Aberta" });
    await mkOpportunity(p.id, { title: "Velha", deadlineAt: new Date(Date.now() - D) });
    await mkOpportunity(p.id, { title: "Oculta", status: "UNDER_REVIEW" });
    const r = (await getPublicProject(inst, p.slug))!;
    expect(r.open.map((c) => c.title)).toEqual(["Aberta"]);
    expect(r.closed.map((c) => c.title)).toEqual(["Velha"]);
    expect(await getPublicProject(inst, susp.slug)).toBeNull();
    expect(await getPublicProject(inst, review.slug)).toBeNull();
    const arch = await mkProject({ status: "ARCHIVED" });
    await mkOpportunity(arch.id, { title: "No arquivo" });
    const ar = (await getPublicProject(inst, arch.slug))!;
    expect(ar.open).toEqual([]);
    expect(ar.closed).toHaveLength(1);
  });
});

describe("filtros disponíveis", () => {
  it("12 tags mais usadas em processos abertos e públicos; cursos da instituição", async () => {
    await mkCourse("CCO");
    const p = await mkProject();
    // Tag i é usada por i processos abertos: Tag 13 lidera, Tag 00 não é usada.
    const opps = [];
    for (let i = 0; i < 13; i++) opps.push(await mkOpportunity(p.id, { title: `Vaga ${i}` }));
    for (let i = 0; i < 14; i++) {
      const tag = await mkTag(`Tag ${String(i).padStart(2, "0")}`);
      for (let j = 0; j < i && j < opps.length; j++) await tagOpportunity(opps[j].id, tag!.id);
    }
    const o = await listFilterOptions(inst);
    expect(o.tags).toHaveLength(12);
    expect(o.tags[0].name).toBe("Tag 13");
    expect(o.tags.map((t) => t.name)).not.toContain("Tag 00");
    expect(o.courses.map((c) => c.code)).toContain("CCO");
  });

  it("tag usada só por processo em revisão, projeto suspenso ou processo encerrado não aparece", async () => {
    const ok = await mkProject();
    const susp = await mkProject({ status: "SUSPENDED" });
    const visible = await mkOpportunity(ok.id);
    const review = await mkOpportunity(ok.id, { status: "UNDER_REVIEW" });
    const suspended = await mkOpportunity(susp.id);
    const closed = await mkOpportunity(ok.id, { deadlineAt: new Date(Date.now() - D) });
    const publicTag = await mkTag("Visivel");
    await tagOpportunity(visible.id, publicTag!.id);
    for (const [name, opp] of [["Revisao", review], ["Suspenso", suspended], ["Encerrado", closed]] as const) {
      const t = await mkTag(name, { usageCount: 99 });
      await tagOpportunity(opp.id, t!.id);
    }
    expect((await listFilterOptions(inst)).tags.map((t) => t.name)).toEqual(["Visivel"]);
  });
});
