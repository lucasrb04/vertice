import { beforeEach, describe, expect, it } from "vitest";
import { runSeed } from "@/db/seed";
import { getDefaultInstitution, InstitutionNotSeededError } from "@/lib/tenant";
import { resetDb } from "../helpers/db";

describe("getDefaultInstitution", () => {
  beforeEach(resetDb);

  it("lança InstitutionNotSeededError sem seed", async () => {
    await expect(getDefaultInstitution()).rejects.toBeInstanceOf(InstitutionNotSeededError);
  });

  it("retorna a instituição do seed", async () => {
    await runSeed();
    expect((await getDefaultInstitution()).slug).toBe("unifei-itajuba");
  });

  it("não devolve instituição em cache depois de resetDb", async () => {
    await runSeed();
    await getDefaultInstitution();
    await resetDb();
    await expect(getDefaultInstitution()).rejects.toBeInstanceOf(InstitutionNotSeededError);
  });
});
