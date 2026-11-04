import { and, asc, desc, eq, ilike, inArray, like, or, sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { opportunityTags, tagAliases, tags } from "@/db/schema";
import { NotFoundError } from "@/lib/auth/errors";
import { RateLimitError, ValidationError } from "@/lib/domain-errors";
import { normalizeTagSlug } from "@/lib/search/tags";
import { tagCreationLimiter } from "@/lib/security/rate-limit";
import { TAG_GROUPS, type TagRef } from "@/lib/validation/opportunity";

export const TAG_RATE_LIMIT = "Você criou muitas tags novas na última hora. Tente de novo mais tarde.";

export type TagGroups = Record<(typeof TAG_GROUPS)[number], TagRef[]>;

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

export async function searchTags(
  institutionId: string,
  query: string,
  limit = 10,
): Promise<Array<{ id: string; name: string }>> {
  const q = query.trim();
  if (!q) return [];
  const slug = normalizeTagSlug(q);
  const match = or(
    ilike(tags.name, `%${escapeLike(q)}%`),
    slug ? like(tags.normalizedSlug, `${escapeLike(slug)}%`) : undefined,
  );
  return db
    .select({ id: tags.id, name: tags.name })
    .from(tags)
    .where(and(eq(tags.institutionId, institutionId), match))
    .orderBy(desc(tags.usageCount), asc(tags.name))
    .limit(limit);
}

export async function syncOpportunityTags(
  tx: Tx,
  ctx: { institutionId: string; userId: string; opportunityId: string },
  groups: TagGroups,
): Promise<void> {
  const { institutionId, userId, opportunityId } = ctx;

  // 1. Coleta ids e nomes (por slug normalizado) de todos os grupos.
  const refIds = new Set<string>();
  const nameBySlug = new Map<string, string>();
  for (const group of TAG_GROUPS) {
    for (const ref of groups[group]) {
      if ("id" in ref) {
        refIds.add(ref.id);
      } else {
        const slug = normalizeTagSlug(ref.name);
        if (!slug) throw new ValidationError({ tags: ["Tag inválida."] });
        if (!nameBySlug.has(slug)) nameBySlug.set(slug, ref.name.trim());
      }
    }
  }

  // 2. Ids precisam pertencer à instituição.
  if (refIds.size > 0) {
    const found = await tx
      .select({ id: tags.id })
      .from(tags)
      .where(and(eq(tags.institutionId, institutionId), inArray(tags.id, [...refIds])));
    if (found.length !== refIds.size) throw new NotFoundError();
  }

  // 3. Resolve slugs: tag existente, alias ou nova.
  const slugToId = new Map<string, string>();
  const slugs = [...nameBySlug.keys()];
  if (slugs.length > 0) {
    const existing = await tx
      .select({ id: tags.id, slug: tags.normalizedSlug })
      .from(tags)
      .where(and(eq(tags.institutionId, institutionId), inArray(tags.normalizedSlug, slugs)));
    for (const row of existing) slugToId.set(row.slug, row.id);

    const missing = slugs.filter((s) => !slugToId.has(s));
    if (missing.length > 0) {
      const aliases = await tx
        .select({ slug: tagAliases.aliasSlug, id: tagAliases.canonicalTagId })
        .from(tagAliases)
        .where(and(eq(tagAliases.institutionId, institutionId), inArray(tagAliases.aliasSlug, missing)));
      for (const row of aliases) slugToId.set(row.slug, row.id);
    }

    const toCreate = slugs.filter((s) => !slugToId.has(s));
    if (toCreate.length > 0) {
      if (!tagCreationLimiter.consume(userId, toCreate.length)) throw new RateLimitError(TAG_RATE_LIMIT);
      for (const slug of toCreate) {
        const name = nameBySlug.get(slug)!;
        const [created] = await tx
          .insert(tags)
          .values({
            institutionId,
            name,
            normalizedSlug: slug,
            category: "TOPIC",
            isVerified: false,
            createdByUserId: userId,
          })
          .onConflictDoNothing({ target: [tags.institutionId, tags.normalizedSlug] })
          .returning({ id: tags.id });
        if (created) {
          slugToId.set(slug, created.id);
        } else {
          // Criada em paralelo por outra transação: reutiliza.
          const [row] = await tx
            .select({ id: tags.id })
            .from(tags)
            .where(and(eq(tags.institutionId, institutionId), eq(tags.normalizedSlug, slug)));
          if (!row) throw new NotFoundError();
          slugToId.set(slug, row.id);
        }
      }
    }
  }

  // 4. Monta linhas finais, deduplicadas por grupo.
  const rows: Array<{ opportunityId: string; tagId: string; relationType: (typeof TAG_GROUPS)[number] }> = [];
  for (const group of TAG_GROUPS) {
    const ids = new Set<string>();
    for (const ref of groups[group]) {
      ids.add("id" in ref ? ref.id : slugToId.get(normalizeTagSlug(ref.name))!);
    }
    for (const tagId of ids) rows.push({ opportunityId, tagId, relationType: group });
  }

  // 5. Substitui linhas e ajusta usage_count pela diferença de tags distintas.
  const before = new Set(
    (
      await tx
        .select({ tagId: opportunityTags.tagId })
        .from(opportunityTags)
        .where(eq(opportunityTags.opportunityId, opportunityId))
    ).map((r) => r.tagId),
  );
  const after = new Set(rows.map((r) => r.tagId));

  await tx.delete(opportunityTags).where(eq(opportunityTags.opportunityId, opportunityId));
  if (rows.length > 0) await tx.insert(opportunityTags).values(rows);

  const added = [...after].filter((id) => !before.has(id));
  const removed = [...before].filter((id) => !after.has(id));
  if (added.length > 0) {
    await tx
      .update(tags)
      .set({ usageCount: sql`${tags.usageCount} + 1` })
      .where(inArray(tags.id, added));
  }
  if (removed.length > 0) {
    await tx
      .update(tags)
      .set({ usageCount: sql`GREATEST(${tags.usageCount} - 1, 0)` })
      .where(inArray(tags.id, removed));
  }
}
