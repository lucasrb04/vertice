import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { logAudit } from "@/lib/security/audit";

/** Bane o usuário, derruba todas as sessões e audita, atomicamente. */
export async function banUser(userId: string, actorId: string, ipAddress: string | null = null): Promise<void> {
  await db.transaction(async (tx) => {
    const [target] = await tx
      .update(users)
      .set({ isBanned: true, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning({ institutionId: users.institutionId });
    if (!target) throw new Error("USER_NOT_FOUND");
    await tx.delete(sessions).where(eq(sessions.userId, userId));
    await logAudit(
      {
        institutionId: target.institutionId,
        actorUserId: actorId,
        action: "USER_BANNED",
        targetType: "USER",
        targetId: userId,
        ipAddress,
      },
      tx,
    );
  });
}
