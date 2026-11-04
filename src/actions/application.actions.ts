"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { moveApplications } from "@/lib/applications/board";
import { applyToOpportunity } from "@/lib/applications/service";
import { requireAuth } from "@/lib/auth/guards";
import { notifyApplicationReceived, notifyStatusChanged } from "@/lib/email/notify";
import type { MoveInput } from "@/lib/validation/application";
import { type ActionResult, runAction } from "./result";

export async function applyToOpportunityAction(input: unknown): Promise<ActionResult<{ opportunitySlug: string }>> {
  return runAction(async () => {
    const user = await requireAuth();
    const { applicationId, opportunitySlug } = await applyToOpportunity(
      user,
      input as Parameters<typeof applyToOpportunity>[1],
    );
    // Depois do commit e da resposta; a falha do envio não desfaz a candidatura.
    after(async () => {
      try {
        await notifyApplicationReceived(applicationId);
      } catch {
        console.error("[email] falha ao enviar a confirmação de candidatura");
      }
    });
    revalidatePath("/minhas-candidaturas");
    return { opportunitySlug };
  });
}

export async function moveApplicationsAction(
  input: unknown,
): Promise<ActionResult<{ moved: number; skipped: number }>> {
  return runAction(async () => {
    const user = await requireAuth();
    const data = input as MoveInput;
    const { moved, skipped } = await moveApplications(user, data);
    revalidatePath(`/projetos/${data.projectId}/processos/${data.opportunityId}/candidatos`);
    if (moved.length > 0) {
      after(async () => {
        try {
          await notifyStatusChanged(moved);
        } catch {
          console.error("[email] falha ao enviar os avisos de mudança de etapa");
        }
      });
    }
    return { moved: moved.length, skipped };
  });
}
