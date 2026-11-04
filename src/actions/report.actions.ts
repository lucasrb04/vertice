"use server";

import { after } from "next/server";
import { requireAuth } from "@/lib/auth/guards";
import { notifyReviewAlert } from "@/lib/email/notify";
import { REPORT_RECEIVED, reportTarget } from "@/lib/moderation/reports";
import type { ReportInput } from "@/lib/validation/moderation";
import { runAction, type ActionResult } from "./result";

/** A resposta não diz se a denúncia é nova, repetida ou se o alvo existe (spec §4). */
export async function reportAction(input: unknown): Promise<ActionResult<{ message: string }>> {
  return runAction(async () => {
    const user = await requireAuth();
    const result = await reportTarget(user, input as ReportInput);
    if (result.autoHidden) {
      // Depois do commit e da resposta; a falha do envio não desfaz a revisão.
      after(async () => {
        try {
          await notifyReviewAlert(result);
        } catch {
          console.error("[email] falha ao enviar o aviso de revisão automática");
        }
      });
    }
    return { message: REPORT_RECEIVED };
  });
}
