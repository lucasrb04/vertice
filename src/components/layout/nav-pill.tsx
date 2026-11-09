"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isNavActive, type NavHref } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function NavPill({ href, label, className }: { href: NavHref; label: string; className?: string }) {
  const active = isNavActive(href, usePathname());
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex min-h-11 items-center rounded-xl border px-4 text-[0.95rem] font-semibold whitespace-nowrap transition-colors duration-150 ease-out",
        active
          ? "border-ipe bg-ipe text-ink hover:border-ipe-hover hover:bg-ipe-hover"
          : "border-line bg-surface text-ink hover:border-line-strong hover:bg-surface-2",
        className,
      )}
    >
      {label}
    </Link>
  );
}
