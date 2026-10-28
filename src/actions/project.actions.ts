"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireAuth } from "@/lib/auth/guards";
import { archiveProject, createProjectWithOpportunity, updateProject } from "@/lib/projects/service";
import { getRequestIp } from "@/lib/security/audit";
import { TurnstileFailedError, verifyTurnstile } from "@/lib/security/turnstile";
import { runAction, type ActionResult } from "./result";

export async function createProjectWithOpportunityAction(input: {
  turnstileToken: string;
  project: unknown;
  opportunity: unknown;
}): Promise<ActionResult<{ projectId: string }>> {
  return runAction(async () => {
    const user = await requireAuth();
    const token = typeof input?.turnstileToken === "string" ? input.turnstileToken : "";
    // Antes de qualquer escrita; o serviço não recebe o token.
    if (!(await verifyTurnstile(token, getRequestIp(await headers())))) throw new TurnstileFailedError();
    const { projectId } = await createProjectWithOpportunity(user, {
      project: input.project,
      opportunity: input.opportunity,
    });
    revalidatePath("/meus-projetos");
    return { projectId };
  });
}

export async function updateProjectAction(projectId: string, input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireAuth();
    await updateProject(user, projectId, input);
    revalidatePath(`/meus-projetos/${projectId}`);
  });
}

export async function archiveProjectAction(projectId: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireAuth();
    await archiveProject(user, projectId);
    revalidatePath("/meus-projetos");
    revalidatePath(`/meus-projetos/${projectId}`);
  });
}
