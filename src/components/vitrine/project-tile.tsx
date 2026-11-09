import { projectInitials } from "@/lib/projects/initials";
import type { ProjectCategory } from "@/lib/projects/labels";
import { cn } from "@/lib/utils";

/** Cor de cada categoria: é o que faz os cards deixarem de parecer iguais (spec "Cor por categoria"). */
export const CATEGORY_COLORS: Record<ProjectCategory, { bg: string; ink: string }> = {
  SCIENTIFIC_INIT: { bg: "#dde8fb", ink: "#1d3f8f" },
  EXTENSION: { bg: "#dcefdf", ink: "#1e5a33" },
  SPECIAL_PROJECT: { bg: "#fde3cf", ink: "#8a3a05" },
  PET: { bg: "#ebe1fa", ink: "#4f2a8f" },
  JUNIOR_ENTERPRISE: { bg: "#d6f0ee", ink: "#0f5b56" },
  LAB_GROUP: { bg: "#fbdfe3", ink: "#8c2236" },
  OTHER: { bg: "#eee9df", ink: "#5a5348" },
};

const SIZES = {
  sm: "size-10 rounded-[10px] text-[0.7rem]",
  md: "size-12 rounded-xl text-[0.8rem] sm:size-[60px] sm:rounded-[14px] sm:text-base",
  lg: "size-16 rounded-2xl text-base sm:size-[72px] sm:text-lg",
} as const;

/** Quadrado do projeto: sigla (ou iniciais) na cor da categoria. Decorativo; o nome sempre aparece ao lado. */
export function ProjectTile({
  category,
  name,
  acronym,
  size = "md",
  className,
}: {
  category: ProjectCategory;
  name: string;
  acronym: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const label = projectInitials(name, acronym);
  const { bg, ink } = CATEGORY_COLORS[category];
  return (
    <span
      aria-hidden="true"
      style={{ backgroundColor: bg, color: ink }}
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden px-1 text-center font-heading leading-none font-extrabold tracking-[-0.01em] break-all",
        SIZES[size],
        // Siglas compridas (até 20 caracteres) encolhem para caber no quadrado.
        label.length > 4 && "text-[0.62rem] sm:text-[0.7rem]",
        className,
      )}
    >
      {label.length > 8 ? label.slice(0, 8) : label}
    </span>
  );
}
