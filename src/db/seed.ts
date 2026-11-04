import { pathToFileURL } from "node:url";
import { and, eq, sql } from "drizzle-orm";
import { closeDb, db } from "@/db";
import { courses, institutions, searchSynonyms, tags, users } from "@/db/schema";
import { rebuildSearch } from "@/db/search-rebuild";
import { COURSES, INSTITUTION, SYNONYMS, TAGS } from "@/db/seed-data";
import { getEnv } from "@/env";
import { normalizeTagSlug } from "@/lib/search/tags";

export async function runSeed(options: { initialAdminEmail?: string } = {}): Promise<void> {
  const adminEmail = (options.initialAdminEmail ?? getEnv().INITIAL_ADMIN_EMAIL)?.trim().toLowerCase();

  const institutionId = await db.transaction(async (tx) => {
    const [inst] = await tx
      .insert(institutions)
      .values(INSTITUTION)
      .onConflictDoUpdate({
        target: institutions.slug,
        set: {
          name: INSTITUTION.name,
          shortName: INSTITUTION.shortName,
          allowedEmailDomains: INSTITUTION.allowedEmailDomains,
        },
      })
      .returning({ id: institutions.id });

    await tx
      .insert(courses)
      .values(COURSES.map((c) => ({ ...c, institutionId: inst.id })))
      .onConflictDoUpdate({
        target: [courses.institutionId, courses.code],
        set: { name: sql`excluded.name`, institute: sql`excluded.institute` },
      });

    await tx
      .insert(tags)
      .values(
        TAGS.map((t) => ({
          institutionId: inst.id,
          name: t.name,
          normalizedSlug: normalizeTagSlug(t.name),
          category: t.category,
          isVerified: true,
        })),
      )
      .onConflictDoUpdate({
        target: [tags.institutionId, tags.normalizedSlug],
        set: { name: sql`excluded.name`, category: sql`excluded.category`, isVerified: true },
      });

    await tx
      .insert(searchSynonyms)
      .values(SYNONYMS.map((s) => ({ ...s, institutionId: inst.id })))
      .onConflictDoNothing();

    if (adminEmail) {
      await tx
        .update(users)
        .set({ systemRole: "SYSTEM_ADMIN", updatedAt: new Date() })
        .where(and(eq(users.email, adminEmail), eq(users.institutionId, inst.id)));
    }
    return inst.id;
  });

  await rebuildSearch(institutionId);
}

const isDirectRun = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  runSeed()
    .then(() => console.log("Seed concluído."))
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => closeDb());
}
