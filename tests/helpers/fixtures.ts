import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  courses,
  institutions,
  opportunities,
  opportunityTags,
  projectMembers,
  projects,
  tags,
  users,
} from "@/db/schema";
import { getDefaultInstitution } from "@/lib/tenant";

type SystemRole = typeof users.$inferInsert.systemRole;
type ProjectStatus = typeof projects.$inferInsert.status;
type MemberRole = typeof projectMembers.$inferInsert.role;

let counter = 0;
const uniq = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;

export async function mkUser(
  email: string,
  opts: { systemRole?: SystemRole; isBanned?: boolean; institutionId?: string } = {},
) {
  const institutionId = opts.institutionId ?? (await getDefaultInstitution()).id;
  const [user] = await db
    .insert(users)
    .values({
      institutionId,
      name: email.split("@")[0],
      email,
      emailVerified: true,
      systemRole: opts.systemRole ?? "USER",
      isBanned: opts.isBanned ?? false,
    })
    .returning();
  return user;
}

export async function mkProject(
  opts: {
    status?: ProjectStatus;
    institutionId?: string;
    name?: string;
    acronym?: string | null;
    advisorName?: string | null;
    category?: typeof projects.$inferInsert.category;
    hasInstitutionalBadge?: boolean;
  } = {},
) {
  const institutionId = opts.institutionId ?? (await getDefaultInstitution()).id;
  const name = opts.name ?? `Projeto ${uniq()}`;
  const [project] = await db
    .insert(projects)
    .values({
      institutionId,
      slug: `projeto-${uniq()}`,
      name,
      shortDescription: "Projeto de teste.",
      category: "LAB_GROUP",
      contactEmail: "contato@unifei.edu.br",
      status: opts.status ?? "ACTIVE",
      acronym: opts.acronym ?? null,
      advisorName: opts.advisorName ?? null,
      hasInstitutionalBadge: opts.hasInstitutionalBadge ?? false,
      ...(opts.category ? { category: opts.category } : {}),
    })
    .returning();
  return project;
}

export async function addMember(projectId: string, userId: string, role: MemberRole) {
  const [member] = await db.insert(projectMembers).values({ projectId, userId, role }).returning();
  return member;
}

export async function mkOpportunity(projectId: string, overrides: Partial<typeof opportunities.$inferInsert> = {}) {
  const [project] = await db
    .select({ institutionId: projects.institutionId })
    .from(projects)
    .where(eq(projects.id, projectId));
  const [opp] = await db
    .insert(opportunities)
    .values({
      institutionId: project.institutionId,
      projectId,
      slug: `vaga-${uniq()}`,
      title: "Vaga de teste",
      description: "Descrição de teste.",
      externalUrl: "https://example.com/edital",
      deadlineAt: new Date(Date.now() + 14 * 24 * 3_600_000),
      ...overrides,
    })
    .returning();
  return opp;
}

export async function mkForeignInstitution() {
  const [inst] = await db
    .insert(institutions)
    .values({
      slug: `outra-${uniq()}`,
      name: "Outra Instituição",
      shortName: "OUTRA",
      allowedEmailDomains: ["outra.edu.br"],
    })
    .returning();
  return inst;
}

export async function mkTag(name: string, opts: { institutionId?: string; usageCount?: number } = {}) {
  const institutionId = opts.institutionId ?? (await getDefaultInstitution()).id;
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "-");
  const [existing] = await db
    .select()
    .from(tags)
    .where(and(eq(tags.institutionId, institutionId), eq(tags.normalizedSlug, slug)));
  if (existing) return existing;
  const [tag] = await db
    .insert(tags)
    .values({ institutionId, name, normalizedSlug: slug, usageCount: opts.usageCount ?? 1 })
    .returning();
  return tag;
}

export async function tagOpportunity(
  opportunityId: string,
  tagId: string,
  relationType: typeof opportunityTags.$inferInsert.relationType = "THEME",
) {
  await db.insert(opportunityTags).values({ opportunityId, tagId, relationType });
}

export async function mkCourse(code: string, name = `Curso ${code}`, institutionId?: string) {
  const inst = institutionId ?? (await getDefaultInstitution()).id;
  const [existing] = await db
    .select()
    .from(courses)
    .where(and(eq(courses.institutionId, inst), eq(courses.code, code)));
  if (existing) return existing;
  const [course] = await db.insert(courses).values({ institutionId: inst, code, name, institute: "TESTE" }).returning();
  return course;
}
