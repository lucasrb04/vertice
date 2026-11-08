import { eq } from "drizzle-orm";
import Link from "next/link";
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
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
        <div className="flex items-center gap-3 sm:gap-6">
          <Link href="/" className="font-heading text-lg font-bold tracking-tight text-brand">
            Vértice
          </Link>
          <Link href="/processos" className="text-sm font-medium text-stone-800 hover:text-brand">
            Processos
          </Link>
        </div>
        {user ? (
          <UserMenu user={user} />
        ) : (
          <Link href="/entrar" className="text-sm font-medium whitespace-nowrap text-stone-800 hover:text-brand">
            Entrar com Google
          </Link>
        )}
      </div>
    </header>
  );
}
