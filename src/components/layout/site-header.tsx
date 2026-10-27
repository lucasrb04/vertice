import Link from "next/link";

type SiteHeaderProps = {
  user: { name: string } | null;
};

export function SiteHeader({ user }: SiteHeaderProps) {
  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="font-heading text-lg font-bold text-brand">
          Vértice
        </Link>
        {user ? (
          <span className="text-sm text-stone-600">{user.name}</span>
        ) : null}
      </div>
    </header>
  );
}
