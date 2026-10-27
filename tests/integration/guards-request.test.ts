import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, projectMembers, projects, users } from "@/db/schema";
import { runSeed } from "@/db/seed";
import { getDefaultInstitution } from "@/lib/tenant";
import { NotFoundError, UnauthorizedError } from "@/lib/auth/errors";
import { resetDb } from "../helpers/db";

// Os wrappers de request dependem do runtime do Next: substituímos só as bordas
// (headers(), sessão crua e redirect/notFound), o resto roda contra o Postgres de teste.
const state = vi.hoisted(() => ({
  sessionUserId: null as string | null,
  headers: new Headers({ "x-forwarded-for": "10.0.0.9" }),
}));

vi.mock("next/headers", () => ({ headers: async () => state.headers }));
vi.mock("@/lib/auth/session", () => ({
  getSessionUser: async () => (state.sessionUserId ? { id: state.sessionUserId } : null),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND_PAGE");
  },
}));

const { requireProjectRolePage, requireSystemAdmin, requireSystemAdminPage } = await import("@/lib/auth/guards");

async function mkUser(institutionId: string, email: string, systemRole: "USER" | "SYSTEM_ADMIN" = "USER") {
  const [u] = await db
    .insert(users)
    .values({ institutionId, name: email, email, emailVerified: true, systemRole })
    .returning();
  return u!;
}

async function setup() {
  const inst = await getDefaultInstitution();
  const owner = await mkUser(inst.id, "owner@unifei.edu.br");
  const outsider = await mkUser(inst.id, "outsider@unifei.edu.br");
  const sysadmin = await mkUser(inst.id, "sysadmin@unifei.edu.br", "SYSTEM_ADMIN");
  const [project] = await db
    .insert(projects)
    .values({
      institutionId: inst.id,
      slug: "proj",
      name: "proj",
      shortDescription: "d",
      category: "SCIENTIFIC_INIT",
      contactEmail: "c@unifei.edu.br",
    })
    .returning();
  await db.insert(projectMembers).values({ projectId: project!.id, userId: owner.id, role: "OWNER" });
  return { inst, owner, outsider, sysadmin, project: project! };
}

type Fx = Awaited<ReturnType<typeof setup>>;

describe("guards de request", () => {
  let fx: Fx;
  beforeEach(async () => {
    await resetDb();
    await runSeed();
    fx = await setup();
    state.sessionUserId = null;
  });

  describe("requireSystemAdmin (Server Actions / route handlers)", () => {
    it("SYSTEM_ADMIN passa sem auditoria", async () => {
      state.sessionUserId = fx.sysadmin.id;
      await expect(requireSystemAdmin("/admin/x")).resolves.toMatchObject({ id: fx.sysadmin.id });
      expect(await db.select().from(auditLogs)).toHaveLength(0);
    });

    it("usuário comum: NotFoundError e 1 ADMIN_ACCESS_DENIED com path e IP", async () => {
      state.sessionUserId = fx.owner.id;
      await expect(requireSystemAdmin("/admin/x")).rejects.toBeInstanceOf(NotFoundError);
      const logs = await db.select().from(auditLogs);
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        action: "ADMIN_ACCESS_DENIED",
        actorUserId: fx.owner.id,
        metadata: { path: "/admin/x" },
        ipAddress: "10.0.0.9",
      });
    });

    it("sem sessão: UnauthorizedError(NO_SESSION) e nenhuma auditoria", async () => {
      await expect(requireSystemAdmin("/admin/x")).rejects.toMatchObject({ reason: "NO_SESSION" });
      await expect(requireSystemAdmin("/admin/x")).rejects.toBeInstanceOf(UnauthorizedError);
      expect(await db.select().from(auditLogs)).toHaveLength(0);
    });

    it("admin banido: UnauthorizedError(BANNED) e nenhuma auditoria", async () => {
      await db.update(users).set({ isBanned: true }).where(eq(users.id, fx.sysadmin.id));
      state.sessionUserId = fx.sysadmin.id;
      await expect(requireSystemAdmin("/admin/x")).rejects.toMatchObject({ reason: "BANNED" });
      expect(await db.select().from(auditLogs)).toHaveLength(0);
    });
  });

  describe("requireSystemAdminPage", () => {
    it("sem sessão e usuário comum caem no mesmo notFound()", async () => {
      await expect(requireSystemAdminPage("/admin")).rejects.toThrow("NOT_FOUND_PAGE");
      state.sessionUserId = fx.owner.id;
      await expect(requireSystemAdminPage("/admin")).rejects.toThrow("NOT_FOUND_PAGE");
      expect(await db.select().from(auditLogs)).toHaveLength(1);
    });
  });

  describe("requireProjectRolePage", () => {
    it("membro com papel passa", async () => {
      state.sessionUserId = fx.owner.id;
      const access = await requireProjectRolePage(fx.project.id, ["OWNER"]);
      expect(access.membership?.role).toBe("OWNER");
    });

    it("sem sessão redireciona para /entrar", async () => {
      await expect(requireProjectRolePage(fx.project.id, ["OWNER"])).rejects.toThrow("REDIRECT:/entrar");
    });

    it("banido redireciona para /entrar?error=ACCOUNT_SUSPENDED", async () => {
      await db.update(users).set({ isBanned: true }).where(eq(users.id, fx.owner.id));
      state.sessionUserId = fx.owner.id;
      await expect(requireProjectRolePage(fx.project.id, ["OWNER"])).rejects.toThrow(
        "REDIRECT:/entrar?error=ACCOUNT_SUSPENDED",
      );
    });

    it("não-membro e projeto inexistente caem no mesmo notFound()", async () => {
      state.sessionUserId = fx.outsider.id;
      await expect(requireProjectRolePage(fx.project.id, ["OWNER"])).rejects.toThrow("NOT_FOUND_PAGE");
      await expect(requireProjectRolePage("00000000-0000-4000-8000-000000000000", ["OWNER"])).rejects.toThrow(
        "NOT_FOUND_PAGE",
      );
    });

    it("SYSTEM_ADMIN passa e registra ADMIN_MAINTENANCE_ACCESS com o IP da requisição", async () => {
      state.sessionUserId = fx.sysadmin.id;
      const access = await requireProjectRolePage(fx.project.id, ["OWNER"]);
      expect(access.membership).toBeNull();
      const logs = await db.select().from(auditLogs);
      expect(logs[0]).toMatchObject({ action: "ADMIN_MAINTENANCE_ACCESS", ipAddress: "10.0.0.9" });
    });
  });
});
