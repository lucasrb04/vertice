"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/guards";
import { closeOpportunity, createOpportunity, updateOpportunity } from "@/lib/opportunities/service";
import { runAction, type ActionResult } from "./result";

/** Painel e páginas de edição/duplicação dos processos do projeto. */
function revalidateProject(projectId: string) {
  revalidatePath(`/projetos/${projectId}`, "layout");
}

export async function createOpportunityAction(
  projectId: string,
  input: unknown,
): Promise<ActionResult<{ opportunityId: string }>> {
  return runAction(async () => {
    const user = await requireAuth();
    const res = await createOpportunity(user, projectId, input);
    revalidateProject(projectId);
    return res;
  });
}

export async function updateOpportunityAction(
  projectId: string,
  opportunityId: string,
  input: unknown,
): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireAuth();
    await updateOpportunity(user, projectId, opportunityId, input);
    revalidateProject(projectId);
  });
}

export async function closeOpportunityAction(projectId: string, opportunityId: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireAuth();
    await closeOpportunity(user, projectId, opportunityId);
    revalidateProject(projectId);
  });
}
