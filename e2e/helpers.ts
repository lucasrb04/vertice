import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { institutions, opportunities, projects } from "../src/db/schema";
import { assertTestDatabase } from "../src/db/test-db-guard";

// O processo do Playwright não tem o ambiente do servidor: conecta direto no banco de .env.test.
const testEnv = parseEnv(readFileSync(".env.test", "utf8"));
assertTestDatabase(testEnv.NODE_ENV ?? "", testEnv.DATABASE_URL ?? "");

// O worker do Playwright é reaproveitado entre arquivos: cada `afterAll` fecha o pool e o próximo recria.
let pool: Pool | null = null;
let dbInstance: ReturnType<typeof drizzle> | null = null;
function getDb() {
  if (!pool || !dbInstance) {
    pool = new Pool({ connectionString: testEnv.DATABASE_URL });
    dbInstance = drizzle(pool);
  }
  return dbInstance;
}

const DAY_MS = 24 * 3_600_000;

export const daysFromNow = (days: number) => new Date(Date.now() + days * DAY_MS);

type ProjectValues = typeof projects.$inferInsert;
type OpportunityValues = typeof opportunities.$inferInsert;

export type ProcessInput = Partial<Omit<OpportunityValues, "title">> & {
  title: string;
  project?: Partial<ProjectValues>;
};

async function institutionId(): Promise<string> {
  const [inst] = await getDb()
    .select({ id: institutions.id })
    .from(institutions)
    .where(eq(institutions.slug, testEnv.DEFAULT_INSTITUTION_SLUG ?? ""));
  if (!inst) throw new Error("Instituição padrão ausente no banco de teste.");
  return inst.id;
}

/** Insere um projeto ativo com um processo aberto; `overrides` ajustam qualquer coluna. */
export async function insertProcess({ project: projectOverrides, ...overrides }: ProcessInput) {
  const instId = await institutionId();
  const suffix = randomUUID().slice(0, 8);
  const [project] = await getDb()
    .insert(projects)
    .values({
      institutionId: instId,
      slug: `projeto-e2e-${suffix}`,
      name: `Projeto ${suffix}`,
      shortDescription: "Projeto de teste.",
      category: "LAB_GROUP",
      contactEmail: "contato@unifei.edu.br",
      status: "ACTIVE",
      ...projectOverrides,
    })
    .returning();
  const [opportunity] = await getDb()
    .insert(opportunities)
    .values({
      institutionId: instId,
      projectId: project!.id,
      slug: `processo-e2e-${suffix}`,
      description: "Descrição de teste.",
      externalUrl: "https://unifei.edu.br/edital.pdf",
      deadlineAt: daysFromNow(14),
      ...overrides,
    })
    .returning();
  return { project: project!, opportunity: opportunity! };
}

/** Acrescenta um processo a um projeto já criado por `insertProcess`. */
export async function addProcess(projectId: string, overrides: Omit<ProcessInput, "project">) {
  const instId = await institutionId();
  const [opportunity] = await getDb()
    .insert(opportunities)
    .values({
      institutionId: instId,
      projectId,
      slug: `processo-e2e-${randomUUID().slice(0, 8)}`,
      description: "Descrição de teste.",
      externalUrl: "https://unifei.edu.br/edital.pdf",
      deadlineAt: daysFromNow(14),
      ...overrides,
    })
    .returning();
  return opportunity!;
}

/** Remove todos os processos, para testes que dependem da vitrine vazia ou de uma ordem exata. */
export async function clearOpportunities(): Promise<void> {
  await getDb().delete(opportunities);
}

/** Contadores de telemetria de um processo. */
export async function opportunityCounters(id: string) {
  const [row] = await getDb()
    .select({ views: opportunities.viewsCount, clicks: opportunities.externalClicksCount })
    .from(opportunities)
    .where(eq(opportunities.id, id));
  return row!;
}

export async function closeTestDb(): Promise<void> {
  const closing = pool;
  pool = null;
  dbInstance = null;
  await closing?.end();
}
