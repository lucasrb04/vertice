import { beforeEach, describe, expect, it } from "vitest";
import { runSeed } from "@/db/seed";
import { authorizeProjectRole } from "@/lib/auth/guards";
import { ALL_ROLES, effectiveMembership, projectCapabilities } from "@/lib/projects/permissions";
import { resetDb } from "../helpers/db";
import { addMember, mkProject, mkUser } from "../helpers/fixtures";

beforeEach(async () => {
  await resetDb();
  await runSeed();
});

describe("effectiveMembership", () => {
  it("devolve a membership do guard para usuário comum", async () => {
    const user = await mkUser("rev@unifei.edu.br");
    const project = await mkProject();
    await addMember(project.id, user.id, "REVIEWER");
    const access = await authorizeProjectRole(user, project.id, ALL_ROLES);
    expect(await effectiveMembership(access)).toEqual({ role: "REVIEWER" });
  });

  it("SYSTEM_ADMIN: membership real quando existe, null quando não", async () => {
    const admin = await mkUser("sysadmin@unifei.edu.br", { systemRole: "SYSTEM_ADMIN" });
    const own = await mkProject();
    const other = await mkProject();
    await addMember(own.id, admin.id, "OWNER");

    const ownAccess = await authorizeProjectRole(admin, own.id, ALL_ROLES);
    expect(ownAccess.membership).toBeNull(); // o guard não consulta project_members para SYSTEM_ADMIN
    expect(await effectiveMembership(ownAccess)).toEqual({ role: "OWNER" });

    const otherAccess = await authorizeProjectRole(admin, other.id, ALL_ROLES);
    expect(await effectiveMembership(otherAccess)).toBeNull();
  });
});

describe("projectCapabilities", () => {
  it("segue a tabela de papéis em projeto ACTIVE", () => {
    expect(projectCapabilities("ACTIVE", { role: "OWNER" })).toEqual({
      canEdit: true,
      canManageMembers: true,
      canLeave: false,
    });
    expect(projectCapabilities("ACTIVE", { role: "ADMIN" })).toEqual({
      canEdit: true,
      canManageMembers: false,
      canLeave: true,
    });
    expect(projectCapabilities("ACTIVE", { role: "REVIEWER" })).toEqual({
      canEdit: false,
      canManageMembers: false,
      canLeave: true,
    });
  });

  it("sem membership ou com projeto não-ACTIVE, nenhuma ação", () => {
    const none = { canEdit: false, canManageMembers: false, canLeave: false };
    expect(projectCapabilities("ACTIVE", null)).toEqual(none);
    for (const status of ["ARCHIVED", "SUSPENDED", "UNDER_REVIEW"] as const) {
      expect(projectCapabilities(status, { role: "OWNER" })).toEqual(none);
    }
  });
});
