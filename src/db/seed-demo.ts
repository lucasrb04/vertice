import { pathToFileURL } from "node:url";
import { eq, inArray, sql } from "drizzle-orm";
import { closeDb, db } from "@/db";
import { courses, opportunities, opportunityTags, projectMembers, projects, tags, users } from "@/db/schema";
import { rebuildSearch } from "@/db/search-rebuild";
import { normalizeTagSlug } from "@/lib/search/tags";
import { getDefaultInstitution } from "@/lib/tenant";
import { deadlineFromDay, todayInSaoPaulo } from "@/lib/time";

export const DEMO_OWNER_EMAIL = "demo@unifei.edu.br";

type ProjectValues = typeof projects.$inferInsert;
type OpportunityValues = typeof opportunities.$inferInsert;
type TagRelation = (typeof opportunityTags.$inferInsert)["relationType"];

type DemoProject = Omit<ProjectValues, "institutionId" | "contactEmail"> & { slug: `demo-${string}` };

const DEMO_PROJECTS: DemoProject[] = [
  {
    slug: "demo-laboratorio-robotica",
    name: "Demo Laboratório de Robótica Móvel",
    acronym: "DLRM",
    shortDescription: "Grupo fictício de pesquisa em navegação autônoma e visão computacional.",
    description:
      "Projeto **fictício**, criado só para demonstrar a vitrine.\n\nO grupo trabalha com:\n\n- navegação autônoma em ambientes internos;\n- visão computacional embarcada;\n- simulação com ROS.\n\nMais detalhes na [página de exemplo](https://example.org/demo-robotica).",
    category: "SCIENTIFIC_INIT",
    institute: "IESTI",
    advisorName: "Prof.ª Demo Almeida",
    websiteUrl: "https://example.org/demo-robotica",
    instagramUrl: "https://www.instagram.com/demo.robotica",
    hasInstitutionalBadge: true,
    status: "ACTIVE",
  },
  {
    slug: "demo-equipe-off-road",
    name: "Demo Equipe de Veículos Off-Road",
    acronym: "DEOR",
    shortDescription: "Equipe fictícia de competição que projeta e constrói um protótipo off-road.",
    description: "Projeto **fictício**. A equipe divide o trabalho em suspensão, powertrain, eletrônica e gestão.",
    category: "SPECIAL_PROJECT",
    institute: "IMC",
    advisorName: "Prof. Demo Ribeiro",
    hasInstitutionalBadge: false,
    status: "ACTIVE",
  },
  {
    slug: "demo-extensao-digital",
    name: "Demo Extensão Digital",
    shortDescription: "Projeto de extensão fictício, já arquivado, de oficinas de informática.",
    category: "EXTENSION",
    institute: "IEPG",
    hasInstitutionalBadge: false,
    status: "ARCHIVED",
  },
];

type DemoOpportunity = Omit<
  OpportunityValues,
  "institutionId" | "projectId" | "deadlineAt" | "closedAt" | "targetCourseIds"
> & {
  slug: `demo-${string}`;
  projectSlug: DemoProject["slug"];
  /** Datas relativas a hoje, em dias; negativo é passado. */
  deadlineInDays: number;
  closedDaysAgo?: number;
  schedule?: { opens: number; interviews?: [number, number]; result?: number; activities?: number };
  courseCodes?: string[];
  tagNames?: Partial<Record<TagRelation, string[]>>;
};

const EDITAL = "https://example.org/demo-edital.pdf";

const DEMO_OPPORTUNITIES: DemoOpportunity[] = [
  {
    slug: "demo-bolsista-visao-computacional",
    projectSlug: "demo-laboratorio-robotica",
    title: "Demo Bolsista de visão computacional",
    description:
      "Processo **fictício** para demonstrar a página pública.\n\nAtividades:\n\n1. treinar modelos de detecção;\n2. integrar os modelos ao robô;\n3. escrever relatórios.\n\nO [edital de exemplo](https://example.org/demo-edital.pdf) traz os detalhes.",
    roleArea: "Visão computacional",
    externalUrl: EDITAL,
    scholarshipType: "PAID",
    fundingAgency: "Demo Fomento",
    scholarshipValueCents: 70_000,
    weeklyHours: 12,
    vacanciesCount: 2,
    minSemester: 3,
    maxSemester: 8,
    deadlineInDays: 21,
    schedule: { opens: -3, interviews: [24, 26], result: 30, activities: 45 },
    availabilityRequirement: "Terças e quintas à tarde",
    noOtherScholarship: true,
    courseCodes: ["CCO", "ECO", "ECA"],
    tagNames: {
      THEME: ["Inteligência Artificial", "Robótica"],
      DESIRED_SKILL: ["Python", "ROS"],
      DEVELOPED_SKILL: ["Redação Científica"],
    },
  },
  {
    slug: "demo-iniciacao-navegacao-autonoma",
    projectSlug: "demo-laboratorio-robotica",
    title: "Demo Iniciação científica em navegação autônoma",
    description: "Processo fictício com prazo curto, para mostrar o destaque de prazo próximo.",
    roleArea: "Navegação",
    externalUrl: EDITAL,
    scholarshipType: "BOTH",
    fundingAgency: "Demo Fomento",
    weeklyHours: 20,
    vacanciesCount: 1,
    minSemester: 5,
    deadlineInDays: 5,
    tagNames: { THEME: ["Robótica"], DESIRED_SKILL: ["C++", "ROS"] },
  },
  {
    slug: "demo-projetista-suspensao",
    projectSlug: "demo-equipe-off-road",
    title: "Demo Projetista de suspensão",
    description: "Processo fictício, voluntário e aberto a todos os cursos.",
    roleArea: "Suspensão",
    externalUrl: EDITAL,
    scholarshipType: "VOLUNTARY",
    weeklyHours: 8,
    vacanciesCount: 4,
    deadlineInDays: 30,
    tagNames: { THEME: ["Automobilística"], DESIRED_SKILL: ["SolidWorks"] },
  },
  {
    slug: "demo-abertura-futura",
    projectSlug: "demo-laboratorio-robotica",
    title: "Demo Abertura futura",
    description: "Processo fictício com inscrições que ainda vão abrir, para mostrar o selo de abertura.",
    roleArea: "Robótica",
    externalUrl: EDITAL,
    scholarshipType: "VOLUNTARY",
    weeklyHours: 6,
    vacanciesCount: 1,
    status: "OPEN",
    deadlineInDays: 30,
    schedule: { opens: 10 },
    tagNames: { THEME: ["Robótica"] },
  },
  {
    slug: "demo-eletronica-embarcada",
    projectSlug: "demo-equipe-off-road",
    title: "Demo Eletrônica embarcada",
    description: "Processo fictício já encerrado, para mostrar o aviso e os processos anteriores.",
    roleArea: "Eletrônica",
    externalUrl: EDITAL,
    scholarshipType: "VOLUNTARY",
    weeklyHours: 8,
    vacanciesCount: 2,
    status: "CLOSED",
    deadlineInDays: -5,
    closedDaysAgo: 10,
    tagNames: { THEME: ["Sistemas Embarcados"], DESIRED_SKILL: ["C", "Design de PCB"] },
  },
  {
    slug: "demo-monitor-oficinas",
    projectSlug: "demo-extensao-digital",
    title: "Demo Monitor de oficinas",
    description: "Processo fictício de um projeto arquivado.",
    externalUrl: EDITAL,
    scholarshipType: "VOLUNTARY",
    vacanciesCount: 3,
    status: "CLOSED",
    deadlineInDays: -40,
    closedDaysAgo: 40,
  },
];

/** Só host local: o seed cria dados fictícios e não pode apontar para um banco compartilhado. */
export function isLocalDatabaseUrl(url: string): boolean {
  try {
    return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** Popula a vitrine com dados fictícios. Exige `pnpm db:seed` antes; nunca roda em produção. */
export async function runDemoSeed(now: Date = new Date()): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("O seed de demonstração não roda em produção.");
  }
  if (!isLocalDatabaseUrl(process.env.DATABASE_URL ?? "")) {
    throw new Error("O seed de demonstração só roda contra um banco local.");
  }
  const institution = await getDefaultInstitution();
  const institutionId = institution.id;

  const dayIn = (days: number) => {
    const d = new Date(`${todayInSaoPaulo(now)}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };

  await db.transaction(async (tx) => {
    const [owner] = await tx
      .insert(users)
      .values({ institutionId, name: "Demo Vértice", email: DEMO_OWNER_EMAIL, emailVerified: true })
      .onConflictDoUpdate({ target: users.email, set: { name: "Demo Vértice" } })
      .returning({ id: users.id });

    const projectIds = new Map<string, string>();
    for (const project of DEMO_PROJECTS) {
      const values = { ...project, institutionId, contactEmail: DEMO_OWNER_EMAIL };
      const [row] = await tx
        .insert(projects)
        .values(values)
        .onConflictDoUpdate({
          target: [projects.institutionId, projects.slug],
          set: { ...values, updatedAt: now },
        })
        .returning({ id: projects.id });
      projectIds.set(project.slug, row!.id);
      await tx
        .insert(projectMembers)
        .values({ projectId: row!.id, userId: owner!.id, role: "OWNER" })
        .onConflictDoNothing();
    }

    const courseRows = await tx
      .select({ id: courses.id, code: courses.code })
      .from(courses)
      .where(eq(courses.institutionId, institutionId));
    const courseIdByCode = new Map(courseRows.map((c) => [c.code, c.id]));

    const tagRows = await tx
      .select({ id: tags.id, slug: tags.normalizedSlug })
      .from(tags)
      .where(eq(tags.institutionId, institutionId));
    const tagIdBySlug = new Map(tagRows.map((t) => [t.slug, t.id]));

    const usedTagIds = new Set<string>();
    for (const demo of DEMO_OPPORTUNITIES) {
      const { projectSlug, deadlineInDays, closedDaysAgo, schedule, courseCodes = [], tagNames = {}, ...fields } = demo;
      const values: OpportunityValues = {
        ...fields,
        institutionId,
        projectId: projectIds.get(projectSlug)!,
        deadlineAt: deadlineFromDay(dayIn(deadlineInDays)),
        closedAt: closedDaysAgo === undefined ? null : deadlineFromDay(dayIn(-closedDaysAgo)),
        targetCourseIds: courseCodes.map((code) => courseIdByCode.get(code)!),
        applicationsOpenOn: schedule ? dayIn(schedule.opens) : null,
        interviewStartsOn: schedule?.interviews ? dayIn(schedule.interviews[0]) : null,
        interviewEndsOn: schedule?.interviews ? dayIn(schedule.interviews[1]) : null,
        resultOn: schedule?.result === undefined ? null : dayIn(schedule.result),
        activitiesStartOn: schedule?.activities === undefined ? null : dayIn(schedule.activities),
      };
      const [row] = await tx
        .insert(opportunities)
        .values(values)
        .onConflictDoUpdate({
          target: [opportunities.institutionId, opportunities.slug],
          set: { ...values, updatedAt: now },
        })
        .returning({ id: opportunities.id });

      await tx.delete(opportunityTags).where(eq(opportunityTags.opportunityId, row!.id));
      const links = Object.entries(tagNames).flatMap(([relationType, names]) =>
        names.map((name) => ({
          opportunityId: row!.id,
          tagId: tagIdBySlug.get(normalizeTagSlug(name))!,
          relationType: relationType as TagRelation,
        })),
      );
      if (links.length > 0) await tx.insert(opportunityTags).values(links);
      for (const link of links) usedTagIds.add(link.tagId);
    }

    if (usedTagIds.size > 0) {
      await tx
        .update(tags)
        .set({
          usageCount: sql`(select count(distinct ot.opportunity_id)::int from opportunity_tags ot where ot.tag_id = ${tags.id})`,
        })
        .where(inArray(tags.id, [...usedTagIds]));
    }
  });

  await rebuildSearch(institutionId);
}

const isDirectRun =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  runDemoSeed()
    .then(() => console.log("Seed de demonstração concluído."))
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => closeDb());
}
