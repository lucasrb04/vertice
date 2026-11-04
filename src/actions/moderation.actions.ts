"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/guards";
import { dismissReports, hideTarget, restoreTarget } from "@/lib/moderation/service";
import { getRequestIp } from "@/lib/security/audit";
import type { ModerationActionInput } from "@/lib/validation/moderation";
import { runAction, type ActionResult } from "./result";

const SERVICES = { hide: hideTarget, restore: restoreTarget, dismiss: dismissReports } as const;
const DONE = {
  hide: "Item ocultado.",
  restore: "Item restaurado.",
  dismiss: "Denúncias descartadas.",
} as const;

export type ModerationActionKind = keyof typeof SERVICES;

/** O serviço autoriza o admin e valida o motivo; aqui só se escolhe a ação e se passa o IP. */
export async function moderationAction(
  kind: ModerationActionKind,
  input: ModerationActionInput,
): Promise<ActionResult<{ message: string }>> {
  return runAction(async () => {
    const service = Object.hasOwn(SERVICES, kind) ? SERVICES[kind] : null;
    if (!service) throw new Error("Ação de moderação desconhecida.");
    const user = await requireAuth();
    await service(user, input, { ipAddress: getRequestIp(await headers()) });
    revalidatePath("/admin");
    return { message: DONE[kind] };
  });
}
