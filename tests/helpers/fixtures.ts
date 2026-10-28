import { eq } from "drizzle-orm";
import { db } from "@/db";
import { institutions, opportunities, projectMembers, projects, users } from "@/db/schema";
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

export async function mkProject(opts: { status?: ProjectStatus; institutionId?: string; name?: string } = {}) {
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
    })
    .returning();
  return project;
}

export async function addMember(projectId: string, userId: string, role: MemberRole) {
  const [member] = await db.insert(projectMembers).values({ projectId, userId, role }).returning();
  return member;
}

export async function mkOpportunity(projectId: string, overrides: Partial<typeof opportunities.$inferInsert> = {}) {
  const [project] = await db.select({ institutionId: projects.institutionId }).from(projects).where(eq(projects.id, projectId));
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
    .values({ slug: `outra-${uniq()}`, name: "Outra Instituição", shortName: "OUTRA", allowedEmailDomains: ["outra.edu.br"] })
    .returning();
  return inst;
}
