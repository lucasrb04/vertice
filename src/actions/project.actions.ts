"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/guards";
import { archiveProject, createProjectWithOpportunity, updateProject } from "@/lib/projects/service";
import { getRequestIp } from "@/lib/security/audit";
import { TurnstileFailedError, verifyTurnstile } from "@/lib/security/turnstile";
import { type ActionResult, runAction } from "./result";

const turnstileTokenSchema = z.string().max(2048);

export async function createProjectWithOpportunityAction(input: {
  turnstileToken: string;
  project: unknown;
  opportunity: unknown;
}): Promise<ActionResult<{ projectId: string; opportunityId: string }>> {
  return runAction(async () => {
    const user = await requireAuth();
    const parsedToken = turnstileTokenSchema.safeParse(input?.turnstileToken);
    const token = parsedToken.success ? parsedToken.data : "";
    // Antes de qualquer escrita; o serviço não recebe o token.
    if (!(await verifyTurnstile(token, getRequestIp(await headers())))) throw new TurnstileFailedError();
    const { projectId, opportunityId } = await createProjectWithOpportunity(user, {
      project: input.project,
      opportunity: input.opportunity,
    });
    revalidatePath("/painel");
    revalidatePath("/publicar");
    return { projectId, opportunityId };
  });
}

export async function updateProjectAction(projectId: string, input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireAuth();
    await updateProject(user, projectId, input);
    revalidatePath(`/projetos/${projectId}`, "layout");
    revalidatePath("/painel");
    revalidatePath("/publicar");
  });
}

export async function archiveProjectAction(projectId: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireAuth();
    await archiveProject(user, projectId);
    revalidatePath(`/projetos/${projectId}`, "layout");
    revalidatePath("/painel");
    revalidatePath("/publicar");
  });
}
