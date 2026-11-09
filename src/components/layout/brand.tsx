import Link from "next/link";
import { cn } from "@/lib/utils";

/** Quadrado amarelo com o "V" e o ponto no vértice; o mesmo desenho do favicon (`src/app/icon.svg`). */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 34 34" aria-hidden="true" className={cn("size-[34px] shrink-0", className)}>
      <rect width="34" height="34" rx="10" fill="var(--ipe)" />
      <path
        d="M9 10 L17 25 L25 10"
        fill="none"
        stroke="var(--ink)"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="17" cy="25" r="2.6" fill="var(--ink)" />
    </svg>
  );
}

export function Brand({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="Vértice, início"
      className={cn("flex shrink-0 items-center gap-2.5 rounded-xl", className)}
    >
      <BrandMark />
      <span className="font-heading text-[1.4rem] leading-none font-extrabold tracking-[-0.03em] text-ink">
        vértice
      </span>
    </Link>
  );
}
