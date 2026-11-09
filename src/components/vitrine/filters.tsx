import {
  Archive,
  ChevronDown,
  GraduationCap,
  type LucideIcon,
  Search,
  Shapes,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FiltersDisclosure } from "@/components/vitrine/filters-disclosure";
import type { ProjectCategory } from "@/lib/projects/labels";
import { CATEGORY_LABELS } from "@/lib/public/labels";
import { type VitrineParams, vitrineHref } from "@/lib/public/search-params";
import { PROJECT_CATEGORIES } from "@/lib/validation/project";
import { FilterSheetDone, FilterSheetHeader, FilterSheetPanel } from "./filter-sheet";
import { CATEGORY_COLORS } from "./project-tile";

export type FilterOptions = {
  courses: { code: string; name: string; institute: string }[];
  tags: { slug: string; name: string }[];
};

type Chip = { key: string; icon: LucideIcon; label: string; href: string };

/** Etiquetas de "Filtrando por": cada uma leva à mesma lista sem aquele filtro. */
export function activeChips(params: VitrineParams, options: FilterOptions): Chip[] {
  const chips: Chip[] = [];
  const tagName = (slug: string) => options.tags.find((t) => t.slug === slug)?.name ?? slug;
  const courseName = (code: string) => options.courses.find((c) => c.code === code)?.name ?? code;
  if (params.q)
    chips.push({ key: "q", icon: Search, label: `“${params.q}”`, href: vitrineHref(params, { q: "", exact: false }) });
  for (const c of params.categories) {
    chips.push({
      key: `category-${c}`,
      icon: Shapes,
      label: CATEGORY_LABELS[c],
      href: vitrineHref(params, { categories: params.categories.filter((x) => x !== c) }),
    });
  }
  if (params.scholarship) {
    chips.push({
      key: "scholarship",
      icon: Wallet,
      label: params.scholarship === "PAID" ? "Com bolsa" : "Voluntário",
      href: vitrineHref(params, { scholarship: null }),
    });
  }
  if (params.course) {
    chips.push({
      key: "course",
      icon: GraduationCap,
      label: courseName(params.course),
      href: vitrineHref(params, { course: null }),
    });
  }
  for (const slug of params.tags) {
    chips.push({
      key: `tag-${slug}`,
      icon: Sparkles,
      label: tagName(slug),
      href: vitrineHref(params, { tags: params.tags.filter((t) => t !== slug) }),
    });
  }
  if (params.includeClosed) {
    chips.push({
      key: "closed",
      icon: Archive,
      label: "Incluindo encerrados",
      href: vitrineHref(params, { includeClosed: false }),
    });
  }
  return chips;
}

function Group({
  icon: Icon,
  title,
  count,
  defaultOpen,
  children,
}: {
  icon: LucideIcon;
  title: string;
  count: number;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  return (
    <FiltersDisclosure defaultOpen={defaultOpen} className="group/grupo rounded-[14px] bg-surface-2">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2.5 rounded-[14px] px-4 py-3 text-[1.02rem] font-bold [&::-webkit-details-marker]:hidden">
        <Icon aria-hidden className="size-[18px]" />
        {title}
        {count > 0 && (
          <span className="min-w-[22px] rounded-[7px] bg-ipe px-1.5 text-center text-[0.8rem] tabular-nums">
            {count}
            <span className="sr-only"> marcados</span>
          </span>
        )}
        <ChevronDown
          aria-hidden
          className="ml-auto size-[18px] transition-transform duration-200 group-open/grupo:rotate-180"
        />
      </summary>
      <div className="px-4 pb-4">{children}</div>
    </FiltersDisclosure>
  );
}

const checkRow = "flex min-h-[38px] cursor-pointer items-center gap-2.5 text-[0.97rem]";
const nativeCheck = "size-[18px] shrink-0 accent-ink";

/**
 * Painel de filtros do formulário GET da lista. Os nomes dos campos são os parâmetros da URL; as tags
 * repetem `tags=` (o parser aceita também a forma separada por vírgula).
 */
export function Filters({
  params,
  options,
  categoryCounts,
  total,
}: {
  params: VitrineParams;
  options: FilterOptions;
  categoryCounts: Record<ProjectCategory, number>;
  total: number;
}) {
  // Tags da URL fora das 12 mais usadas continuam marcadas, para não sumirem ao reaplicar.
  const known = new Set(options.tags.map((t) => t.slug));
  const tagList = [...options.tags, ...params.tags.filter((s) => !known.has(s)).map((slug) => ({ slug, name: slug }))];
  const courseKnown = !params.course || options.courses.some((c) => c.code === params.course);
  const institutes = [...new Set(options.courses.map((c) => c.institute))];
  const chips = activeChips(params, options);
  // "Outro" só aparece quando tem processo ou está marcado.
  const categories = PROJECT_CATEGORIES.filter(
    (c) => c !== "OTHER" || categoryCounts.OTHER > 0 || params.categories.includes(c),
  );

  return (
    <FilterSheetPanel footer={<FilterSheetDone total={total} />}>
      <FilterSheetHeader clearHref={chips.length > 0 ? "/" : null} />
      <div className="grid gap-2.5 overflow-y-auto p-4">
        {chips.length > 0 && (
          <section aria-labelledby="filtrando-por" className="rounded-[14px] bg-rosa-soft p-4">
            <h3 id="filtrando-por" className="mb-2.5 font-sans text-base font-bold tracking-normal text-rosa-ink">
              Filtrando por
            </h3>
            <ul className="flex flex-wrap gap-2">
              {chips.map(({ key, icon: Icon, label, href }) => (
                <li
                  key={key}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-[9px] bg-surface py-1 pr-1 pl-2.5 text-[0.92rem] font-medium"
                >
                  <Icon aria-hidden className="size-[15px] shrink-0" />
                  <span className="min-w-0 truncate">{label}</span>
                  {/* <a> comum: recarrega e zera os campos não controlados. */}
                  <a
                    href={href}
                    aria-label={`Remover ${label}`}
                    className="inline-flex shrink-0 rounded-md p-0.5 text-ink-3 hover:bg-surface-2 hover:text-ink"
                  >
                    <X aria-hidden className="size-[15px]" />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        <Group icon={Shapes} title="Categoria" count={params.categories.length} defaultOpen>
          <fieldset>
            <legend className="sr-only">Categoria</legend>
            {categories.map((c) => (
              <label key={c} className={checkRow}>
                <input
                  type="checkbox"
                  name="category"
                  value={c}
                  defaultChecked={params.categories.includes(c)}
                  className={nativeCheck}
                />
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-[3px]"
                  style={{ backgroundColor: CATEGORY_COLORS[c].ink }}
                />
                <span className="min-w-0">{CATEGORY_LABELS[c]}</span>
                <span className="ml-auto text-[0.88rem] text-ink-3 tabular-nums">
                  {categoryCounts[c]}
                  <span className="sr-only"> processos</span>
                </span>
              </label>
            ))}
          </fieldset>
        </Group>

        <Group icon={Wallet} title="Bolsa" count={params.scholarship ? 1 : 0} defaultOpen>
          <fieldset className="grid grid-cols-3 gap-1.5">
            <legend className="sr-only">Bolsa</legend>
            {[
              { value: "", label: "Qualquer" },
              { value: "PAID", label: "Com bolsa" },
              { value: "VOLUNTARY", label: "Voluntário" },
            ].map((o) => (
              <label key={o.value} className="relative">
                <input
                  type="radio"
                  name="scholarship"
                  value={o.value}
                  defaultChecked={(params.scholarship ?? "") === o.value}
                  className="peer absolute inset-0 m-0 cursor-pointer opacity-0"
                />
                <span className="grid min-h-10 place-items-center rounded-[10px] border border-line bg-surface px-1 text-[0.9rem] font-semibold whitespace-nowrap peer-checked:border-ink peer-checked:bg-ink peer-checked:text-white peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink">
                  {o.label}
                </span>
              </label>
            ))}
          </fieldset>
        </Group>

        <Group icon={GraduationCap} title="Curso" count={params.course ? 1 : 0} defaultOpen={!!params.course}>
          <select
            id="filtro-curso"
            name="course"
            aria-label="Curso"
            defaultValue={params.course ?? ""}
            className="h-11 w-full min-w-0 rounded-[10px] border border-line bg-surface px-3 text-base text-ink hover:border-line-strong"
          >
            <option value="">Todos os cursos</option>
            {!courseKnown && <option value={params.course!}>{params.course}</option>}
            {institutes.map((inst) => (
              <optgroup key={inst} label={inst}>
                {options.courses
                  .filter((c) => c.institute === inst)
                  .map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </Group>

        {tagList.length > 0 && (
          <Group icon={Sparkles} title="Habilidades" count={params.tags.length} defaultOpen={params.tags.length > 0}>
            <fieldset className="flex flex-wrap gap-1.5">
              <legend className="sr-only">Habilidades</legend>
              {tagList.map((t) => (
                <label key={t.slug} className="relative max-w-full">
                  <input
                    type="checkbox"
                    name="tags"
                    value={t.slug}
                    defaultChecked={params.tags.includes(t.slug)}
                    className="peer absolute inset-0 m-0 cursor-pointer opacity-0"
                  />
                  <span className="block max-w-full truncate rounded-full border border-line bg-surface px-3 py-1 text-[0.9rem] font-medium peer-checked:border-ink peer-checked:bg-ink peer-checked:text-white peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink">
                    {t.name}
                  </span>
                </label>
              ))}
            </fieldset>
          </Group>
        )}

        <label className={`${checkRow} px-1.5 pt-1`}>
          <input
            type="checkbox"
            name="encerrados"
            value="1"
            defaultChecked={params.includeClosed}
            className={nativeCheck}
          />
          Incluir encerrados
        </label>

        <Button type="submit" variant="outline" className="w-full in-data-js:hidden">
          Aplicar
        </Button>
      </div>
    </FilterSheetPanel>
  );
}
