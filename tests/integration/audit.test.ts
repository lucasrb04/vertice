import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { runSeed } from "@/db/seed";
import { getRequestIp, logAudit } from "@/lib/security/audit";
import { getDefaultInstitution } from "@/lib/tenant";
import { resetDb } from "../helpers/db";

describe("logAudit", () => {
  beforeEach(resetDb);

  it("grava uma linha com os campos informados", async () => {
    await runSeed();
    const inst = await getDefaultInstitution();
    await logAudit({
      institutionId: inst.id,
      actorUserId: null,
      action: "USER_BANNED",
      targetType: "USER",
      metadata: { motivo: "x" },
      ipAddress: "1.2.3.4",
    });
    const rows = await db.select().from(auditLogs);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      institutionId: inst.id,
      actorUserId: null,
      action: "USER_BANNED",
      targetType: "USER",
      targetId: null,
      metadata: { motivo: "x" },
      ipAddress: "1.2.3.4",
    });
  });
});

describe("getRequestIp", () => {
  it("usa o primeiro item de x-forwarded-for", () => {
    expect(getRequestIp(new Headers({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" }))).toBe("9.9.9.9");
  });
  it("cai para x-real-ip", () => {
    expect(getRequestIp(new Headers({ "x-real-ip": "8.8.8.8" }))).toBe("8.8.8.8");
  });
  it("retorna null sem headers", () => {
    expect(getRequestIp(new Headers())).toBeNull();
  });
});
