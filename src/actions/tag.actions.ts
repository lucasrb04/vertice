"use server";

import { z } from "zod";
import { requireAuth } from "@/lib/auth/guards";
import { searchTags } from "@/lib/tags/service";

const querySchema = z.string().trim().max(64);

/** Exige sessão (lança `UnauthorizedError` sem ela); consulta inválida devolve lista vazia. */
export async function searchTagsAction(query: string): Promise<Array<{ id: string; name: string }>> {
  const user = await requireAuth();
  const parsed = querySchema.safeParse(query);
  if (!parsed.success) return [];
  return searchTags(user.institutionId, parsed.data);
}
