import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, sessions, users } from "@/db/schema";
import { runSeed } from "@/db/seed";
import { banUser } from "@/lib/auth/ban";
import { beforeSessionCreate } from "@/lib/auth/hooks";
import { createTestSession } from "@/lib/auth/test-auth";
import { resetDb } from "../helpers/db";

describe("banUser", () => {
  beforeEach(async () => {
    await resetDb();
    await runSeed();
  });

  it("banUser marca isBanned, apaga todas as sessões e grava USER_BANNED com actor", async () => {
    const target = await createTestSession({ email: "alvo@unifei.edu.br", name: "Alvo" });
    await createTestSession({ email: "alvo@unifei.edu.br", name: "Alvo" });
    const actor = await createTestSession({ email: "adm@unifei.edu.br", name: "Adm" });
    expect(await db.select().from(sessions).where(eq(sessions.userId, target.userId))).toHaveLength(2);

    await banUser(target.userId, actor.userId, "10.0.0.3");

    const [u] = await db.select().from(users).where(eq(users.id, target.userId));
    expect(u!.isBanned).toBe(true);
    expect(await db.select().from(sessions).where(eq(sessions.userId, target.userId))).toHaveLength(0);
    expect(await db.select().from(sessions).where(eq(sessions.userId, actor.userId))).toHaveLength(1);
    const logs = await db.select().from(auditLogs);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      action: "USER_BANNED",
      actorUserId: actor.userId,
      targetType: "USER",
      targetId: target.userId,
      ipAddress: "10.0.0.3",
      institutionId: u!.institutionId,
    });
  });

  it("depois de banUser, beforeSessionCreate recusa com ACCOUNT_SUSPENDED", async () => {
    const target = await createTestSession({ email: "alvo@unifei.edu.br", name: "Alvo" });
    await banUser(target.userId, target.userId);
    await expect(beforeSessionCreate({ userId: target.userId })).rejects.toMatchObject({
      code: "ACCOUNT_SUSPENDED",
    });
  });
});
