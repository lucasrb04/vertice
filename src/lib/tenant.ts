import { eq } from "drizzle-orm";
import { db } from "@/db";
import { type Institution, institutions } from "@/db/schema";
import { getEnv } from "@/env";

export class InstitutionNotSeededError extends Error {
  constructor(slug: string) {
    super(`Instituição "${slug}" não encontrada. Rode "pnpm db:seed".`);
    this.name = "InstitutionNotSeededError";
  }
}

let cached: Institution | undefined;

export async function getDefaultInstitution(): Promise<Institution> {
  if (cached) return cached;
  const slug = getEnv().DEFAULT_INSTITUTION_SLUG;
  const [inst] = await db.select().from(institutions).where(eq(institutions.slug, slug)).limit(1);
  if (!inst) throw new InstitutionNotSeededError(slug);
  cached = inst;
  return inst;
}

export function clearTenantCache(): void {
  cached = undefined;
}
