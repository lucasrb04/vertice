import { Button } from "@/components/ui/button";
import { FiltersDisclosure } from "@/components/vitrine/filters-disclosure";
import { CATEGORY_LABELS, SCHOLARSHIP_LABELS } from "@/lib/public/labels";
import type { VitrineParams } from "@/lib/public/search-params";
import { PROJECT_CATEGORIES } from "@/lib/validation/project";

type Options = {
  courses: { code: string; name: string }[];
  tags: { slug: string; name: string }[];
};

const fieldset = "min-w-0 space-y-1.5";
const legend = "mb-1.5 text-xs font-medium tracking-wide text-stone-500 uppercase";
const row = "flex min-h-7 items-center gap-2 text-sm text-stone-700";
const control = "size-4 shrink-0 accent-brand";

/**
 * Campos do formulário GET de /processos. Os nomes são os parâmetros da URL; as tags repetem
 * `tags=` (o parser aceita também a forma separada por vírgula).
 */
export function Filters({ params, options }: { params: VitrineParams; options: Options }) {
  // Tags da URL fora das 12 mais usadas continuam marcadas, para não sumirem ao reaplicar.
  const known = new Set(options.tags.map((t) => t.slug));
  const tagList = [...options.tags, ...params.tags.filter((s) => !known.has(s)).map((slug) => ({ slug, name: slug }))];
  const active =
    params.categories.length > 0 ||
    !!params.scholarship ||
    !!params.course ||
    params.tags.length > 0 ||
    params.includeClosed;
  const courseKnown = !params.course || options.courses.some((c) => c.code === params.course);

  return (
    <FiltersDisclosure
      defaultOpen={active}
      className="group rounded-lg border border-stone-200 bg-white lg:border-0 lg:bg-transparent lg:[&::details-content]:block lg:[&::details-content]:[content-visibility:visible]"
    >
      <summary className="flex min-h-11 cursor-pointer items-center justify-between px-4 text-sm font-medium text-stone-900 supports-[selector(::details-content)]:lg:hidden">
        Filtros
      </summary>
      <div className="space-y-5 border-t border-stone-200 p-4 lg:border-0 lg:p-0">
        <fieldset className={fieldset}>
          <legend className={legend}>Categoria</legend>
          {PROJECT_CATEGORIES.map((c) => (
            <label key={c} className={row}>
              <input
                type="checkbox"
                name="category"
                value={c}
                defaultChecked={params.categories.includes(c)}
                className={control}
              />
              {CATEGORY_LABELS[c]}
            </label>
          ))}
        </fieldset>

        <fieldset className={fieldset}>
          <legend className={legend}>Bolsa</legend>
          {[
            { value: "", label: "Qualquer" },
            { value: "PAID", label: SCHOLARSHIP_LABELS.PAID },
            { value: "VOLUNTARY", label: SCHOLARSHIP_LABELS.VOLUNTARY },
          ].map((o) => (
            <label key={o.value} className={row}>
              <input
                type="radio"
                name="scholarship"
                value={o.value}
                defaultChecked={(params.scholarship ?? "") === o.value}
                className={control}
              />
              {o.label}
            </label>
          ))}
        </fieldset>

        <div className={fieldset}>
          <label htmlFor="filtro-curso" className={`${legend} block`}>
            Curso
          </label>
          <select
            id="filtro-curso"
            name="course"
            defaultValue={params.course ?? ""}
            className="h-9 w-full min-w-0 rounded-md border border-stone-200 bg-white px-2 text-sm text-stone-800"
          >
            <option value="">Todos os cursos</option>
            {!courseKnown && <option value={params.course!}>{params.course}</option>}
            {options.courses.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {tagList.length > 0 && (
          <fieldset className={fieldset}>
            <legend className={legend}>Habilidades</legend>
            {tagList.map((t) => (
              <label key={t.slug} className={row}>
                <input
                  type="checkbox"
                  name="tags"
                  value={t.slug}
                  defaultChecked={params.tags.includes(t.slug)}
                  className={control}
                />
                <span className="min-w-0 truncate font-mono text-xs">{t.name}</span>
              </label>
            ))}
          </fieldset>
        )}

        <label className={row}>
          <input
            type="checkbox"
            name="encerrados"
            value="1"
            defaultChecked={params.includeClosed}
            className={control}
          />
          Incluir encerrados
        </label>

        <Button type="submit" variant="outline" className="w-full in-data-js:hidden">
          Aplicar
        </Button>
      </div>
    </FiltersDisclosure>
  );
}
