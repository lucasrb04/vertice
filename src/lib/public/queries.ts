import { and, asc, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { courses, opportunities, opportunityTags, projects, tags } from "@/db/schema";
import type { ProjectCategory, ScholarshipType } from "@/lib/projects/labels";
import { closedOnDate, isOpportunityOpen, openOpportunitySql } from "@/lib/opportunities/status";
import { defaultSort, type VitrineParams } from "./search-params";

export const PAGE_SIZE = 12;
export const ROW_LIMIT = 10;
const MAX_CARD_TAGS = 4;
const SIMILARITY_THRESHOLD = 0.4;

export type PublicCard = {
  slug: string;
  title: string;
  projectName: string;
  projectAcronym: string | null;
  projectSlug: string;
  category: ProjectCategory;
  verified: boolean;
  scholarshipType: ScholarshipType;
  fundingAgency: string | null;
  scholarshipValueCents: number | null;
  weeklyHours: number | null;
  minSemester: number | null;
  courseCount: number;
  deadlineAt: Date;
  isOpen: boolean;
  closedOn: Date | null;
  tags: string[];
};

/** Visível ao público: fora de revisão, em projeto ativo ou arquivado. Exige join com `projects`. */
export function publicOpportunitySql(): SQL {
  return sql`${opportunities.status} <> 'UNDER_REVIEW' AND ${projects.status} IN ('ACTIVE', 'ARCHIVED')`;
}

// ---------- busca ----------

const norm = (col: SQL | unknown) => sql`lower(unaccent(${col}))`;

/** Mesma normalização do SQL (sem acentos, minúsculas), usada para o termo do usuário. */
export function normalizeQuery(q: string): string {
  return q
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

const tagSimilarity = (q: string) => sql`coalesce((
  select max(word_similarity(${q}::text, lower(unaccent(t.name))))
  from opportunity_tags ot join tags t on t.id = ot.tag_id
  where ot.opportunity_id = ${opportunities.id}
), 0)`;

/**
 * Único ponto de verdade do predicado e da pontuação de busca; usado em itens e total.
 * Devolve `null` quando `q` normaliza para vazio (sem busca).
 */
function searchSql(rawQ: string): { where: SQL; score: SQL } | null {
  const q = normalizeQuery(rawQ);
  if (!q) return null;
  const like = `%${escapeLike(q)}%`;
  const ilike = (col: unknown) => sql`${norm(col)} LIKE ${like}`;
  const tagLike = sql`exists (
    select 1 from opportunity_tags ot join tags t on t.id = ot.tag_id
    where ot.opportunity_id = ${opportunities.id} and lower(unaccent(t.name)) LIKE ${like}
  )`;
  const simTitle = sql`word_similarity(${q}::text, ${norm(opportunities.title)})`;
  const simProject = sql`word_similarity(${q}::text, ${norm(projects.name)})`;
  const simTag = tagSimilarity(q);
  // Similaridade só vale com 4+ letras: termos curtos casam quase tudo (spec §5.4).
  const useSimilarity = (q.match(/[a-z]/g)?.length ?? 0) >= 4;
  const simClauses = useSimilarity
    ? sql`OR ${simTitle} > ${SIMILARITY_THRESHOLD} OR ${simProject} > ${SIMILARITY_THRESHOLD} OR ${simTag} > ${SIMILARITY_THRESHOLD}`
    : sql``;
  const where = sql`(
    ${ilike(opportunities.title)} OR ${ilike(opportunities.roleArea)} OR ${ilike(projects.name)}
    OR ${ilike(projects.acronym)} OR ${ilike(projects.advisorName)} OR ${ilike(opportunities.description)}
    OR ${tagLike}
    ${simClauses}
  )`;
  // Acerto exato (LIKE) vale mais que qualquer similaridade (máx. 1): sigla, área e orientador não têm similaridade.
  const exactBonus = sql`(case when ${ilike(opportunities.title)} OR ${ilike(opportunities.roleArea)} OR ${ilike(projects.name)}
    OR ${ilike(projects.acronym)} OR ${ilike(projects.advisorName)} OR ${tagLike} then 2 else 0 end)::float8`;
  const sim = useSimilarity ? sql`greatest(${simTitle}, ${simProject}, ${simTag})` : sql`0::float8`;
  return { where, score: sql`(${exactBonus} + ${sim})` };
}

function filtersSql(institutionId: string, p: VitrineParams, now: Date, search: ReturnType<typeof searchSql>): SQL {
  const conds: SQL[] = [eq(opportunities.institutionId, institutionId), publicOpportunitySql()];
  if (!p.includeClosed) conds.push(openOpportunitySql(now));
  if (search) conds.push(search.where);
  if (p.categories.length) conds.push(inArray(projects.category, p.categories));
  if (p.scholarship) {
    conds.push(inArray(opportunities.scholarshipType, [p.scholarship, "BOTH"]));
  }
  if (p.course) {
    conds.push(sql`(
      jsonb_array_length(${opportunities.targetCourseIds}) = 0
      OR ${opportunities.targetCourseIds} @> jsonb_build_array((
        select c.id::text from courses c where c.institution_id = ${institutionId} and c.code = ${p.course}
      ))
    )`);
  }
  for (const slug of p.tags) {
    conds.push(sql`exists (
      select 1 from opportunity_tags ot join tags t on t.id = ot.tag_id
      where ot.opportunity_id = ${opportunities.id} and t.institution_id = ${institutionId} and t.normalized_slug = ${slug}
    )`);
  }
  return and(...conds)!;
}

// ---------- cartões ----------

const popularity = sql`(${opportunities.viewsCount} + ${opportunities.externalClicksCount})`;

const cardColumns = {
  id: opportunities.id,
  slug: opportunities.slug,
  title: opportunities.title,
  projectName: projects.name,
  projectAcronym: projects.acronym,
  projectSlug: projects.slug,
  category: projects.category,
  verified: projects.hasInstitutionalBadge,
  scholarshipType: opportunities.scholarshipType,
  fundingAgency: opportunities.fundingAgency,
  scholarshipValueCents: opportunities.scholarshipValueCents,
  weeklyHours: opportunities.weeklyHours,
  minSemester: opportunities.minSemester,
  courseCount: sql<number>`jsonb_array_length(${opportunities.targetCourseIds})`.mapWith(Number),
  deadlineAt: opportunities.deadlineAt,
  status: opportunities.status,
  closedAt: opportunities.closedAt,
  projectStatus: projects.status,
};

const RELATION_ORDER = sql`case ot.relation_type when 'THEME' then 0 when 'DESIRED_SKILL' then 1 else 2 end`;

async function fetchCards(opts: {
  where: SQL;
  orderBy: SQL[];
  limit?: number;
  offset?: number;
  now: Date;
}): Promise<PublicCard[]> {
  let q = db
    .select(cardColumns)
    .from(opportunities)
    .innerJoin(projects, eq(projects.id, opportunities.projectId))
    .where(opts.where)
    .orderBy(...opts.orderBy)
    .$dynamic();
  if (opts.limit !== undefined) q = q.limit(opts.limit);
  if (opts.offset) q = q.offset(opts.offset);
  const rows = await q;
  if (rows.length === 0) return [];

  const { rows: tagRows } = await db.execute<{ opportunity_id: string; name: string }>(sql`
    select ot.opportunity_id, t.name
    from opportunity_tags ot join tags t on t.id = ot.tag_id
    where ot.opportunity_id in (${sql.join(rows.map((r) => sql`${r.id}`), sql`, `)})
    order by ${RELATION_ORDER}, t.name, t.id
  `);
  const byOpp = new Map<string, string[]>();
  for (const t of tagRows) {
    const list = byOpp.get(t.opportunity_id) ?? [];
    if (!list.includes(t.name) && list.length < MAX_CARD_TAGS) list.push(t.name);
    byOpp.set(t.opportunity_id, list);
  }

  return rows.map((r) => {
    const isOpen = isOpportunityOpen(r, r.projectStatus, opts.now);
    const closedOn = isOpen ? null : closedOnDate(r, opts.now);
    return {
      slug: r.slug,
      title: r.title,
      projectName: r.projectName,
      projectAcronym: r.projectAcronym,
      projectSlug: r.projectSlug,
      category: r.category,
      verified: r.verified,
      scholarshipType: r.scholarshipType,
      fundingAgency: r.fundingAgency,
      scholarshipValueCents: r.scholarshipValueCents,
      weeklyHours: r.weeklyHours,
      minSemester: r.minSemester,
      courseCount: r.courseCount,
      deadlineAt: r.deadlineAt,
      isOpen,
      closedOn,
      tags: byOpp.get(r.id) ?? [],
    };
  });
}

// ---------- /processos ----------

export async function searchOpportunities(
  institutionId: string,
  params: VitrineParams,
  now: Date = new Date(),
): Promise<{ items: PublicCard[]; total: number; page: number; pageCount: number }> {
  const search = searchSql(params.q);
  const where = filtersSql(institutionId, params, now, search);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)`.mapWith(Number) })
    .from(opportunities)
    .innerJoin(projects, eq(projects.id, opportunities.projectId))
    .where(where);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(params.page, 1), pageCount);

  const openRank = sql`case when ${openOpportunitySql(now)} then 0 else 1 end`;
  let sort = params.sort;
  if (sort === "relevance" && !search) sort = defaultSort("");
  const recent = [desc(opportunities.createdAt), asc(opportunities.id)];
  let order: SQL[];
  switch (sort) {
    case "deadline":
      order = [
        sql`case when ${openOpportunitySql(now)} then ${opportunities.deadlineAt} end asc nulls last`,
        desc(opportunities.deadlineAt),
        asc(opportunities.id),
      ];
      break;
    case "popular":
      order = [desc(popularity), ...recent];
      break;
    case "relevance":
      order = [sql`${search!.score} desc`, ...recent];
      break;
    default:
      order = recent;
  }

  const items = total
    ? await fetchCards({ where, orderBy: [openRank, ...order], limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE, now })
    : [];
  return { items, total, page, pageCount };
}

// ---------- home ----------

export async function listHomeRows(
  institutionId: string,
  now: Date = new Date(),
): Promise<{ openCount: number; recent: PublicCard[]; closing: PublicCard[]; popular: PublicCard[] }> {
  const where = and(eq(opportunities.institutionId, institutionId), publicOpportunitySql(), openOpportunitySql(now))!;
  const [{ openCount }] = await db
    .select({ openCount: sql<number>`count(*)`.mapWith(Number) })
    .from(opportunities)
    .innerJoin(projects, eq(projects.id, opportunities.projectId))
    .where(where);
  if (openCount === 0) return { openCount, recent: [], closing: [], popular: [] };

  const [recent, closing, popular] = await Promise.all([
    fetchCards({ where, orderBy: [desc(opportunities.createdAt), asc(opportunities.id)], limit: ROW_LIMIT, now }),
    fetchCards({ where, orderBy: [asc(opportunities.deadlineAt), asc(opportunities.id)], limit: ROW_LIMIT, now }),
    fetchCards({
      where: and(where, sql`${popularity} > 0`)!,
      orderBy: [desc(popularity), desc(opportunities.createdAt), asc(opportunities.id)],
      limit: ROW_LIMIT,
      now,
    }),
  ]);
  return { openCount, recent, closing, popular };
}

// ---------- detalhes ----------

export type TagRef = { slug: string; name: string };

export async function getPublicOpportunity(institutionId: string, slug: string, now: Date = new Date()) {
  const [row] = await db
    .select({
      opportunity: {
        id: opportunities.id,
        slug: opportunities.slug,
        title: opportunities.title,
        description: opportunities.description,
        roleArea: opportunities.roleArea,
        internalSelectionEnabled: opportunities.internalSelectionEnabled,
        externalUrl: opportunities.externalUrl,
        customQuestion: opportunities.customQuestion,
        scholarshipType: opportunities.scholarshipType,
        fundingAgency: opportunities.fundingAgency,
        scholarshipValueCents: opportunities.scholarshipValueCents,
        weeklyHours: opportunities.weeklyHours,
        vacanciesCount: opportunities.vacanciesCount,
        targetCourseIds: opportunities.targetCourseIds,
        minSemester: opportunities.minSemester,
        maxSemester: opportunities.maxSemester,
        deadlineAt: opportunities.deadlineAt,
        applicationsOpenOn: opportunities.applicationsOpenOn,
        interviewStartsOn: opportunities.interviewStartsOn,
        interviewEndsOn: opportunities.interviewEndsOn,
        resultOn: opportunities.resultOn,
        activitiesStartOn: opportunities.activitiesStartOn,
        availabilityRequirement: opportunities.availabilityRequirement,
        noOtherScholarship: opportunities.noOtherScholarship,
        status: opportunities.status,
        closedAt: opportunities.closedAt,
        createdAt: opportunities.createdAt,
        updatedAt: opportunities.updatedAt,
      },
      project: {
        slug: projects.slug,
        name: projects.name,
        acronym: projects.acronym,
        shortDescription: projects.shortDescription,
        category: projects.category,
        institute: projects.institute,
        advisorName: projects.advisorName,
        websiteUrl: projects.websiteUrl,
        instagramUrl: projects.instagramUrl,
        contactEmail: projects.contactEmail,
        verified: projects.hasInstitutionalBadge,
        status: projects.status,
      },
    })
    .from(opportunities)
    .innerJoin(projects, eq(projects.id, opportunities.projectId))
    .where(and(eq(opportunities.institutionId, institutionId), eq(opportunities.slug, slug), publicOpportunitySql()));
  if (!row) return null;

  const { opportunity, project } = row;
  const courseRows = opportunity.targetCourseIds.length
    ? await db
        .select({ code: courses.code, name: courses.name })
        .from(courses)
        .where(and(eq(courses.institutionId, institutionId), inArray(courses.id, opportunity.targetCourseIds)))
        .orderBy(asc(courses.name))
    : [];

  const tagRows = await db
    .select({ relation: opportunityTags.relationType, slug: tags.normalizedSlug, name: tags.name })
    .from(opportunityTags)
    .innerJoin(tags, eq(tags.id, opportunityTags.tagId))
    .where(eq(opportunityTags.opportunityId, opportunity.id))
    .orderBy(asc(tags.name), asc(tags.id));
  const tagGroups: Record<"THEME" | "DESIRED_SKILL" | "DEVELOPED_SKILL", TagRef[]> = {
    THEME: [],
    DESIRED_SKILL: [],
    DEVELOPED_SKILL: [],
  };
  for (const t of tagRows) tagGroups[t.relation].push({ slug: t.slug, name: t.name });

  const isOpen = isOpportunityOpen(opportunity, project.status, now);
  const closedOn = isOpen ? null : (closedOnDate(opportunity, now) ?? null);
  return { opportunity, project, courses: courseRows, tags: tagGroups, isOpen, closedOn };
}

export async function getPublicProject(institutionId: string, slug: string, now: Date = new Date()) {
  const [project] = await db
    .select({
      id: projects.id,
      slug: projects.slug,
      name: projects.name,
      acronym: projects.acronym,
      shortDescription: projects.shortDescription,
      description: projects.description,
      category: projects.category,
      institute: projects.institute,
      advisorName: projects.advisorName,
      websiteUrl: projects.websiteUrl,
      instagramUrl: projects.instagramUrl,
      contactEmail: projects.contactEmail,
      verified: projects.hasInstitutionalBadge,
      status: projects.status,
    })
    .from(projects)
    .where(and(eq(projects.institutionId, institutionId), eq(projects.slug, slug), inArray(projects.status, ["ACTIVE", "ARCHIVED"])));
  if (!project) return null;

  const where = and(
    eq(opportunities.institutionId, institutionId),
    eq(opportunities.projectId, project.id),
    publicOpportunitySql(),
  )!;
  const all = await fetchCards({
    where,
    orderBy: [asc(opportunities.deadlineAt), asc(opportunities.id)],
    now,
  });
  const open = all.filter((c) => c.isOpen);
  const closed = all
    .filter((c) => !c.isOpen)
    .sort((a, b) => (b.closedOn?.getTime() ?? 0) - (a.closedOn?.getTime() ?? 0));
  const { id: _id, ...publicProject } = project;
  void _id;
  return { project: publicProject, open, closed };
}

// ---------- filtros ----------

export async function listFilterOptions(
  institutionId: string,
): Promise<{ courses: { code: string; name: string }[]; tags: { slug: string; name: string }[] }> {
  const [courseRows, tagRows] = await Promise.all([
    db
      .select({ code: courses.code, name: courses.name })
      .from(courses)
      .where(eq(courses.institutionId, institutionId))
      .orderBy(asc(courses.name)),
    db
      .select({ slug: tags.normalizedSlug, name: tags.name })
      .from(opportunityTags)
      .innerJoin(tags, eq(tags.id, opportunityTags.tagId))
      .innerJoin(opportunities, eq(opportunities.id, opportunityTags.opportunityId))
      .innerJoin(projects, eq(projects.id, opportunities.projectId))
      .where(
        and(
          eq(opportunities.institutionId, institutionId),
          eq(tags.institutionId, institutionId),
          publicOpportunitySql(),
          openOpportunitySql(new Date()),
        ),
      )
      .groupBy(tags.id, tags.normalizedSlug, tags.name)
      .orderBy(sql`count(*) desc`, asc(tags.name))
      .limit(12),
  ]);
  return { courses: courseRows, tags: tagRows };
}
