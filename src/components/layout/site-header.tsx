import { eq } from "drizzle-orm";
import Link from "next/link";
import { Brand } from "@/components/layout/brand";
import { NavPill } from "@/components/layout/nav-pill";
import { Shell } from "@/components/layout/shell";
import { UserMenu, type UserMenuUser } from "@/components/layout/user-menu";
import { db } from "@/db";
import { users } from "@/db/schema";
import { UnauthorizedError } from "@/lib/auth/errors";
import { resolveActiveUser } from "@/lib/auth/guards";
import { getSessionUser } from "@/lib/auth/session";

async function getHeaderUser(): Promise<UserMenuUser | null> {
  try {
    const user = await resolveActiveUser(await getSessionUser());
    // A foto do Google só serve ao avatar; fica fora do AuthUser que os guards usam.
    const [row] = await db.select({ image: users.image }).from(users).where(eq(users.id, user.id)).limit(1);
    return { name: user.name, email: user.email, image: row?.image ?? null, systemRole: user.systemRole };
  } catch (err) {
    if (err instanceof UnauthorizedError) return null;
    throw err;
  }
}

export async function SiteHeader() {
  const user = await getHeaderUser();
  return (
    <header className="pt-3 sm:pt-5">
      <Shell>
        <div className="flex min-h-[68px] items-center gap-2 rounded-2xl bg-surface py-2.5 pr-2.5 pl-3.5 shadow-card sm:gap-3 sm:rounded-[20px] sm:px-4">
          <Brand className="mr-auto sm:mr-3" />
          <nav aria-label="Principal" className="hidden items-center gap-2 sm:flex sm:flex-1">
            <NavPill href="/" label="Processos" />
            {/* Para todos: quem publica pesa igual a quem procura. Sem sessão, /publicar leva ao login e volta. */}
            <NavPill href="/publicar" label="Publicar processo" className={user ? "hidden min-[1100px]:inline-flex" : undefined} />
          </nav>
          {user ? (
            <div className="flex items-center gap-2">
              <NavPill href="/minhas-candidaturas" label="Minhas candidaturas" className="hidden min-[1100px]:inline-flex" />
              <NavPill href="/painel" label="Painel" className="hidden min-[1100px]:inline-flex" />
              <UserMenu user={user} />
            </div>
          ) : (
            <Link
              href="/entrar"
              className="inline-flex min-h-11 items-center rounded-xl border border-line bg-surface px-4 text-[0.95rem] font-semibold whitespace-nowrap hover:border-line-strong hover:bg-surface-2"
            >
              Entrar
            </Link>
          )}
        </div>
      </Shell>
    </header>
  );
}
