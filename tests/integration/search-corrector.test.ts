import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { searchSynonyms, tagAliases } from "@/db/schema";
import { rebuildSearch } from "@/db/search-rebuild";
import { runSeed } from "@/db/seed";
import { correctQuery } from "@/lib/search/corrector";
import { getDefaultInstitution } from "@/lib/tenant";
import { resetDb } from "../helpers/db";
import { mkOpportunity, mkProject, mkTag } from "../helpers/fixtures";

let inst: string;

async function catalog(...titles: string[]) {
  const p = await mkProject({ name: "Grupo", acronym: null });
  for (const title of titles) await mkOpportunity(p.id, { title, description: "Texto." });
  await rebuildSearch(inst);
}

const corrected = async (q: string) => (await correctQuery(inst, q)).corrected;

beforeEach(async () => {
  await resetDb();
  await runSeed();
  inst = (await getDefaultInstitution()).id;
});

describe("correctQuery", () => {
  it("corrige os exemplos da spec, inclusive no meio de frase", async () => {
    await catalog("Casa inteligente", "Bolsa de Python", "Robótica", "Algoritmo genético", "Programação");
    expect(await corrected("casinha")).toBe("casa");
    expect(await corrected("casinhas")).toBe("casa");
    expect(await corrected("pyhton")).toBe("python");
    expect(await corrected("robotcia")).toBe("robotica");
    expect(await corrected("algoritimo")).toBe("algoritmo");
    expect(await corrected("progamação")).toBe("programacao");
    expect(await correctQuery(inst, "bolsa pyhton")).toEqual(
      expect.objectContaining({ original: "bolsa pyhton", corrected: "bolsa python", terms: ["bolsa", "python"] }),
    );
  });

  it("palavra real fora do catálogo não vira outra (spec §5.3)", async () => {
    await catalog("Ação", "Robótica", "Busca", "Casa", "Aero", "Prof. Otávio", "Vale");
    for (const q of ["avião", "domótica", "música", "nasa", "carro", "navio", "vôlei"]) {
      expect(await corrected(q), q).toBeNull();
      expect((await correctQuery(inst, q)).terms, q).toHaveLength(1);
    }
  });

  it("a regra nova preserva os erros de digitação", async () => {
    await catalog("Bolsa de Python", "Robótica", "Algoritmo", "Engenharia", "Programação", "Casa", "Café");
    const cases: [string, string][] = [
      ["blosa", "bolsa"],
      ["oython", "python"],
      ["pyhton", "python"],
      ["pithon", "python"],
      ["robotcia", "robotica"],
      ["algoritimo", "algoritmo"],
      ["engeharia", "engenharia"],
      ["progamacao", "programacao"],
      ["casinha", "casa"],
      ["cafezinho", "cafe"],
    ];
    for (const [q, want] of cases) expect(await corrected(q), q).toBe(want);
  });

  it("distância 2 entre 5 e 7 letras só com as mesmas letras: palavra real fica", async () => {
    await catalog("Tetra", "Cinta", "Plano", "Jornada", "Camada");
    for (const q of ["teatro", "cinema", "planta", "jornal", "camisa"]) expect(await corrected(q), q).toBeNull();
  });

  it("erros reais continuam corrigidos pela regra da spec", async () => {
    await catalog(
      "Python",
      "Estágio",
      "Marketing",
      "Iniciação",
      "Dados",
      "Hidrologia",
      "Robótica",
      "Algoritmo",
      "Engenharia",
      "Bolsa",
    );
    const cases: [string, string][] = [
      ["pyhton", "python"],
      ["pyton", "python"],
      ["phyton", "python"],
      ["estaigo", "estagio"],
      ["marqueting", "marketing"],
      ["iniciasao", "iniciacao"],
      ["dadso", "dados"],
      ["hydrologia", "hidrologia"],
      ["robotcia", "robotica"],
      ["algoritimo", "algoritmo"],
      ["engeharia", "engenharia"],
      ["blosa", "bolsa"],
      ["oython", "python"],
    ];
    for (const [q, want] of cases) expect(await corrected(q), q).toBe(want);
  });

  it("stopword acentuada não é candidata, mas conta como conhecida", async () => {
    await catalog("Inscrições até amanhã; você não precisa", "Vice-diretoria");
    expect(await corrected("arte")).toBeNull();
    expect(await corrected("voce")).toBeNull();
    expect(await corrected("até")).toBeNull();
    expect(await corrected("tambem")).toBeNull();
  });

  it("sigla curta do catálogo não impede corrigir pelo radical (redes nerais)", async () => {
    await catalog("Redes neurais", "Núcleo NER");
    expect(await corrected("redes nerais")).toBe("redes neurais");
  });

  it("corrige dentro de token composto e preserva a pontuação", async () => {
    await catalog("Bolsa de Python", "Java");
    expect(await corrected("pyhton/java")).toBe("python/java");
    expect((await correctQuery(inst, "pyhton/java")).terms).toEqual(["python", "java"]);
  });

  it("5 letras: distância 2 só com as mesmas letras; primeira letra diferente só com distância 1 em 6+", async () => {
    await catalog("Bolsa", "Python", "Tecnologia");
    expect(await corrected("bulsu")).toBeNull();
    expect(await corrected("xython")).toBe("python");
    expect(await corrected("xythan")).toBeNull();
  });

  it("palavra entre aspas fica, a mesma palavra fora delas é corrigida", async () => {
    await catalog("Bolsa de Python");
    expect(await corrected('pyhton "pyhton"')).toBe('python "pyhton"');
    expect(await corrected('"pyhton" pyhton')).toBe('"pyhton" python');
    expect(await corrected("“pyhton” pyhton")).toBe("“pyhton” python");
  });

  it("troca a palavra em qualquer caixa, com pontuação, e só palavra inteira", async () => {
    await catalog("Bolsa de Python", "Programação");
    expect(await corrected("PYHTON Pyhton pyhton")).toBe("python python python");
    expect(await corrected("progamação PROGAMACAO")).toBe("programacao programacao");
    expect(await corrected("(pyhton), pyhton3")).toBe("(python), pyhton3");
  });

  it("parte de alias de tag com várias palavras é conhecida", async () => {
    await catalog("Machete", "Leaning");
    const tag = await mkTag("Aprendizado de máquina");
    await db.insert(tagAliases).values({ institutionId: inst, aliasSlug: "machine-learning", canonicalTagId: tag!.id });
    expect(await corrected("machine learning")).toBeNull();
  });

  it("cafezinho vira cafe", async () => {
    await catalog("Café com Ciência");
    expect(await corrected("cafezinho")).toBe("cafe");
  });

  it("frase mista: palavra existente fica, inclusive o acento nos termos", async () => {
    await catalog("Casa inteligente", "Iniciação científica");
    const r = await correctQuery(inst, "casinha inteligente científica");
    expect(r.corrected).toBe("casa inteligente científica");
    expect(r.terms).toEqual(["casa", "inteligente", "científica"]);
  });

  it("palavra existente nunca é corrigida", async () => {
    await catalog("Casa", "Estudo de caso", "Vizinho", "Caminho", "Carinho", "Cama", "Caro", "Vizo");
    for (const q of ["casa", "caso", "vizinho", "caminho", "carinho", "CASA"]) {
      expect(await correctQuery(inst, q)).toEqual(expect.objectContaining({ corrected: null }));
    }
  });

  it("palavra com o mesmo radical de uma do catálogo já casa pelo stemmer: não é correção", async () => {
    await catalog("Programa", "Bolsista", "Monitor", "Jogos", "Casa");
    for (const q of ["programar", "bolsistas", "monitores", "jogo", "casas"]) expect(await corrected(q), q).toBeNull();
  });

  it("aspas desligam a correção, também de parte da consulta", async () => {
    await catalog("Casa inteligente", "Bolsa de Python");
    expect(await corrected('"casinha"')).toBeNull();
    expect(await corrected('"pyhton" bolsa')).toBeNull();
    expect(await corrected("“casinha”")).toBeNull();
    expect((await correctQuery(inst, '"casinha inteligente"')).terms).toEqual(["casinha inteligente"]);
    expect(await corrected('"bolsa" pyhton')).toBe('"bolsa" python');
  });

  it("siglas e palavras curtas ficam intactas", async () => {
    await catalog("Bolsa de Python", "Casa");
    for (const q of ["ic", "pet", "pyt", "cas"]) expect(await corrected(q), q).toBeNull();
  });

  it("palavra com dígito ou símbolo nunca é corrigida", async () => {
    await catalog("Bolsa de Python", "Programação");
    for (const q of ["pyhton3", "pyh-ton", "pyhton++", "progamaçã0"]) expect(await corrected(q), q).toBeNull();
  });

  it("distância 1 para 4 letras, 2 para 5 ou mais; sem candidato mantém", async () => {
    await catalog("Casa", "Tecnologia");
    expect(await corrected("cosa")).toBe("casa");
    expect(await corrected("cxxa")).toBeNull();
    expect(await corrected("tecnolojja")).toBe("tecnologia");
    expect(await corrected("tecnoxxxia")).toBeNull();
  });

  it("empate de distância vai para a palavra mais frequente", async () => {
    await catalog("Pedra", "Pedro", "Pedro", "Pedro");
    expect(await corrected("pedru")).toBe("pedro");
  });

  it("palavra de sinônimo ou de alias de tag não é corrigida", async () => {
    await catalog("Código aberto", "Python");
    await db.insert(searchSynonyms).values({ institutionId: inst, term: "codego", canonical: "programacao" });
    expect(await corrected("codego")).toBeNull();
    const tag = await mkTag("Python");
    await db.insert(tagAliases).values({ institutionId: inst, aliasSlug: "pyhton", canonicalTagId: tag!.id });
    expect(await corrected("pyhton")).toBeNull();
  });

  it("stopword nem é corrigida nem vira correção", async () => {
    await catalog("Linha de montagem", "Para todos");
    expect(await corrected("minha")).toBeNull();
    expect(await corrected("pera")).toBeNull();
  });

  it("palavra só de processo oculto não vira correção", async () => {
    const p = await mkProject({ name: "Grupo" });
    await mkOpportunity(p.id, { title: "Criptografia", status: "UNDER_REVIEW" });
    await rebuildSearch(inst);
    expect(await corrected("criptografya")).toBeNull();
  });

  it("consulta sem palavra e palavra gigante não quebram", async () => {
    await catalog("Casa");
    expect(await correctQuery(inst, "!!!")).toEqual(expect.objectContaining({ corrected: null, terms: [] }));
    expect(await corrected("a".repeat(100))).toBeNull();
  });
});
