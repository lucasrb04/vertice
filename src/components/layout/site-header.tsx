import Link from "next/link";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { UnauthorizedError } from "@/lib/auth/errors";
import { resolveActiveUser } from "@/lib/auth/guards";
import { getSessionUser } from "@/lib/auth/session";

async function getHeaderUser(): Promise<{ name: string } | null> {
  try {
    const user = await resolveActiveUser(await getSessionUser());
    return { name: user.name };
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
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <Link href="/publicar" className="text-sm font-medium whitespace-nowrap text-stone-800 hover:text-brand">
              Publicar processo
            </Link>
            <span className="hidden max-w-48 truncate text-sm text-stone-600 md:inline">{user.name}</span>
            <SignOutButton />
          </div>
        ) : (
          <Link href="/entrar" className="text-sm font-medium whitespace-nowrap text-stone-800 hover:text-brand">
            Entrar com Google
          </Link>
        )}
      </div>
    </header>
  );
}
