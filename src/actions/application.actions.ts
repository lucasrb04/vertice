"use server";

import { revalidatePath } from "next/cache";
import { applyToOpportunity } from "@/lib/applications/service";
import { requireAuth } from "@/lib/auth/guards";
import { runAction, type ActionResult } from "./result";

export async function applyToOpportunityAction(input: unknown): Promise<ActionResult<{ opportunitySlug: string }>> {
  return runAction(async () => {
    const user = await requireAuth();
    const { opportunitySlug } = await applyToOpportunity(user, input as Parameters<typeof applyToOpportunity>[1]);
    revalidatePath("/minhas-candidaturas");
    return { opportunitySlug };
  });
}
