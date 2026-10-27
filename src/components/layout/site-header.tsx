import Link from "next/link";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { resolveActiveUser } from "@/lib/auth/guards";
import { UnauthorizedError } from "@/lib/auth/errors";
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
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="font-heading text-lg font-bold tracking-tight text-brand">
          Vértice
        </Link>
        {user ? (
          <div className="flex items-center gap-3">
            <span className="text-sm text-stone-600">{user.name}</span>
            <SignOutButton />
          </div>
        ) : (
          <Link href="/entrar" className="text-sm font-medium text-stone-800 hover:text-brand">
            Entrar com Google
          </Link>
        )}
      </div>
    </header>
  );
}
