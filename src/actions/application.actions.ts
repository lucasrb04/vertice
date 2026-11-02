"use server";

import { revalidatePath } from "next/cache";
import { moveApplications } from "@/lib/applications/board";
import { applyToOpportunity } from "@/lib/applications/service";
import { requireAuth } from "@/lib/auth/guards";
import type { MoveInput } from "@/lib/validation/application";
import { runAction, type ActionResult } from "./result";

export async function applyToOpportunityAction(input: unknown): Promise<ActionResult<{ opportunitySlug: string }>> {
  return runAction(async () => {
    const user = await requireAuth();
    const { opportunitySlug } = await applyToOpportunity(user, input as Parameters<typeof applyToOpportunity>[1]);
    revalidatePath("/minhas-candidaturas");
    return { opportunitySlug };
  });
}

export async function moveApplicationsAction(input: unknown): Promise<ActionResult<{ moved: number; skipped: number }>> {
  return runAction(async () => {
    const user = await requireAuth();
    const data = input as MoveInput;
    const { moved, skipped } = await moveApplications(user, data);
    revalidatePath(`/projetos/${data.projectId}/processos/${data.opportunityId}/candidatos`);
    return { moved: moved.length, skipped };
  });
}
