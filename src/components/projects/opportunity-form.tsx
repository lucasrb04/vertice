"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createOpportunityAction, updateOpportunityAction } from "@/actions/opportunity.actions";
import type { ActionResult } from "@/actions/result";
import { TagCombobox } from "@/components/tags/tag-combobox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { INTERNAL_SELECTION_AVAILABLE } from "@/lib/opportunities/features";
import { deadlineLabel, SCHOLARSHIP_LABELS, type ProjectCategory, type ScholarshipType } from "@/lib/projects/labels";
import { todayInSaoPaulo } from "@/lib/time";
import { TAG_GROUPS, type OpportunityFormValues, type TagGroup, type TagRef } from "@/lib/validation/opportunity";
import { Field, FormMessage } from "./field";
import { errorsFor, type FieldErrors } from "./form-errors";

export type Course = { id: string; code: string; name: string };

const TAG_GROUP_LABELS: Record<TagGroup, string> = {
  THEME: "Tema",
  DESIRED_SKILL: "Desejável",
  DEVELOPED_SKILL: "O que vai aprender",
};

/** Presets por categoria (spec §6.4 / PRD RF04.2): só sugestões. */
const ROLE_AREA_SUGGESTIONS: Partial<Record<ProjectCategory, string[]>> = {
  SPECIAL_PROJECT: ["Elétrica", "Mecânica", "Software", "Gestão", "Marketing"],
};
const FUNDING_SUGGESTIONS: Partial<Record<ProjectCategory, string[]>> = {
  SCIENTIFIC_INIT: ["PIBIC", "FAPEMIG", "CNPq"],
};

type DayField = "deadline" | "applicationsOpenOn" | "interviewStartsOn" | "interviewEndsOn" | "resultOn" | "activitiesStartOn";

type OpportunityDraft = {
  title: string;
  description: string;
  roleArea: string;
  vacanciesCount: string;
  externalUrl: string;
  internalSelectionEnabled: boolean;
  scholarshipType: ScholarshipType;
  fundingAgency: string;
  scholarshipValue: string;
  weeklyHours: string;
  targetCourseIds: string[];
  minSemester: string;
  availabilityRequirement: string;
  noOtherScholarship: boolean;
  tags: Record<TagGroup, TagRef[]>;
} & Record<DayField, string>;

const str = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(v));

function toDraft(v: OpportunityFormValues | undefined): OpportunityDraft {
  return {
    title: str(v?.title),
    description: str(v?.description),
    roleArea: str(v?.roleArea),
    vacanciesCount: str(v?.vacanciesCount ?? 1),
    deadline: str(v?.deadline),
    externalUrl: str(v?.externalUrl),
    internalSelectionEnabled: v?.internalSelectionEnabled ?? false,
    scholarshipType: v?.scholarshipType ?? "VOLUNTARY",
    fundingAgency: str(v?.fundingAgency),
    scholarshipValue: str(v?.scholarshipValue),
    weeklyHours: str(v?.weeklyHours),
    applicationsOpenOn: str(v?.applicationsOpenOn),
    interviewStartsOn: str(v?.interviewStartsOn),
    interviewEndsOn: str(v?.interviewEndsOn),
    resultOn: str(v?.resultOn),
    activitiesStartOn: str(v?.activitiesStartOn),
    targetCourseIds: v?.targetCourseIds ?? [],
    minSemester: str(v?.minSemester),
    availabilityRequirement: str(v?.availabilityRequirement),
    noOtherScholarship: v?.noOtherScholarship ?? false,
    tags: {
      THEME: v?.tags?.THEME ?? [],
      DESIRED_SKILL: v?.tags?.DESIRED_SKILL ?? [],
      DEVELOPED_SKILL: v?.tags?.DEVELOPED_SKILL ?? [],
    },
  };
}

const num = (v: string) => (v.trim() === "" ? null : Number(v));

function toValues(d: OpportunityDraft): OpportunityFormValues {
  return {
    ...d,
    vacanciesCount: num(d.vacanciesCount) ?? undefined,
    weeklyHours: num(d.weeklyHours),
    minSemester: num(d.minSemester),
  };
}

const KNOWN_FIELDS = new Set<string>([...Object.keys(toDraft(undefined)), "scholarshipValueCents"]);

function Block({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-stone-200 bg-white p-5">
      <h2 className="text-base font-semibold tracking-tight text-stone-900">{title}</h2>
      {description && <p className="mt-1 text-sm text-stone-600">{description}</p>}
      <div className="mt-4 grid gap-5 sm:grid-cols-6">{children}</div>
    </section>
  );
}

function OptionalBlock({ title, open, children }: { title: string; open: boolean; children: ReactNode }) {
  return (
    <details open={open || undefined} className="group rounded-lg border border-stone-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 select-none">
        <span className="text-base font-semibold tracking-tight text-stone-900">{title}</span>
        <span className="text-xs text-stone-500">
          opcional <span className="font-mono group-open:hidden">+</span>
          <span className="hidden font-mono group-open:inline">−</span>
        </span>
      </summary>
      <div className="grid gap-5 border-t border-stone-200 p-5 sm:grid-cols-6">{children}</div>
    </details>
  );
}

/**
 * Formulário de processo seletivo (spec §6.4). Sem `onSubmit`, chama a action conforme `mode` e
 * volta ao painel do projeto; com `onSubmit` (wizard), quem chama decide o envio.
 */
export function OpportunityForm({
  mode,
  projectId,
  opportunityId,
  courses,
  category,
  initialValues,
  initialTagNames,
  onSubmit,
  submitLabel,
  submitDisabled = false,
  actions,
  children,
}: {
  mode: "create" | "edit" | "duplicate";
  projectId?: string;
  opportunityId?: string;
  courses: Course[];
  category?: ProjectCategory | "";
  initialValues?: OpportunityFormValues;
  initialTagNames?: Record<string, string>;
  onSubmit?: (values: OpportunityFormValues) => Promise<ActionResult<unknown>>;
  submitLabel?: string;
  submitDisabled?: boolean;
  /** Botões extras ao lado do envio (ex.: "Voltar" no wizard). */
  actions?: ReactNode;
  /** Conteúdo antes dos botões (ex.: Turnstile). */
  children?: ReactNode;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(() => toDraft(initialValues));
  const [scholarshipTouched, setScholarshipTouched] = useState(initialValues !== undefined);
  const [presetCategory, setPresetCategory] = useState<ProjectCategory | "" | undefined>(undefined);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [specificCourses, setSpecificCourses] = useState(draft.targetCourseIds.length > 0);

  // Preset de IC: "Com bolsa", só enquanto a modalidade não foi escolhida.
  if (category !== presetCategory) {
    setPresetCategory(category);
    if (category === "SCIENTIFIC_INIT" && !scholarshipTouched && draft.scholarshipType === "VOLUNTARY") {
      setDraft((d) => ({ ...d, scholarshipType: "PAID" }));
    }
  }

  const set = <K extends keyof OpportunityDraft>(key: K, v: OpportunityDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: v }));
  const text =
    (key: { [K in keyof OpportunityDraft]: OpportunityDraft[K] extends string ? K : never }[keyof OpportunityDraft]) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      set(key, e.target.value as never);
  const err = (field: string) => errorsFor(errors, field);
  const hasErr = (...fields: string[]) => fields.some((f) => err(f).length > 0);

  const today = todayInSaoPaulo();
  const requiresFutureDeadline = mode !== "edit";
  const roleSuggestions = category ? ROLE_AREA_SUGGESTIONS[category] : undefined;
  const fundingSuggestions = category ? FUNDING_SUGGESTIONS[category] : undefined;
  const otherErrors = Object.entries(errors)
    .filter(([key]) => !KNOWN_FIELDS.has(key.split(".")[0]!))
    .flatMap(([, m]) => m);

  async function defaultSubmit(values: OpportunityFormValues): Promise<ActionResult<unknown>> {
    if (!projectId) throw new Error("projectId é obrigatório sem onSubmit");
    if (mode === "edit") {
      if (!opportunityId) throw new Error("opportunityId é obrigatório na edição");
      return updateOpportunityAction(projectId, opportunityId, values);
    }
    return createOpportunityAction(projectId, values);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setMessage(null);
    const values = toValues({ ...draft, targetCourseIds: specificCourses ? draft.targetCourseIds : [] });
    let res: ActionResult<unknown>;
    try {
      res = onSubmit ? await onSubmit(values) : await defaultSubmit(values);
    } catch {
      res = { ok: false, error: "RULE", message: "Não foi possível salvar agora. Tente de novo." };
    }
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      setMessage(res.message);
      setPending(false);
      return;
    }
    setErrors({});
    // Em sucesso o envio continua "pendente" até a navegação, para evitar clique duplo.
    if (!onSubmit && projectId) {
      router.push(`/projetos/${projectId}`);
      router.refresh();
    }
  }

  const toggleCourse = (id: string, checked: boolean) =>
    set(
      "targetCourseIds",
      checked ? [...draft.targetCourseIds, id] : draft.targetCourseIds.filter((c) => c !== id),
    );

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <Block title="Essencial">
        <Field label="Título do processo" errors={err("title")} className="sm:col-span-6">
          {(p) => (
            <Input
              {...p}
              value={draft.title}
              onChange={text("title")}
              maxLength={160}
              placeholder="Ex.: Processo seletivo 2026/2"
            />
          )}
        </Field>
        <Field
          label="Descrição das atividades"
          hint="Aceita Markdown simples. Links precisam começar com https://"
          errors={err("description")}
          className="sm:col-span-6"
        >
          {(p) => (
            <Textarea {...p} value={draft.description} onChange={text("description")} maxLength={5000} rows={5} />
          )}
        </Field>
        <Field
          label="Área/função"
          optional
          hint={roleSuggestions ? `Sugestões: ${roleSuggestions.join(", ")}` : undefined}
          errors={err("roleArea")}
          className="sm:col-span-4"
        >
          {(p) => (
            <>
              <Input
                {...p}
                value={draft.roleArea}
                onChange={text("roleArea")}
                maxLength={80}
                list={roleSuggestions ? `${p.id}-list` : undefined}
              />
              {roleSuggestions && (
                <datalist id={`${p.id}-list`}>
                  {roleSuggestions.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              )}
            </>
          )}
        </Field>
        <Field label="Número de vagas" errors={err("vacanciesCount")} className="sm:col-span-2">
          {(p) => (
            <Input
              {...p}
              type="number"
              inputMode="numeric"
              min={1}
              max={99}
              value={draft.vacanciesCount}
              onChange={text("vacanciesCount")}
              className="font-mono"
            />
          )}
        </Field>
        <Field
          label="Prazo final de inscrição"
          hint={
            draft.deadline
              ? deadlineLabel(draft.deadline)
              : "As inscrições encerram às 23h59 (horário de Brasília) do dia escolhido."
          }
          errors={err("deadline")}
          className="sm:col-span-3"
        >
          {(p) => (
            <Input
              {...p}
              type="date"
              value={draft.deadline}
              onChange={text("deadline")}
              min={requiresFutureDeadline ? today : undefined}
              className="font-mono"
            />
          )}
        </Field>
      </Block>

      <Block title="Como se inscrever" description="Informe pelo menos um canal de inscrição.">
        <Field label="Link do edital ou formulário" errors={err("externalUrl")} className="sm:col-span-6">
          {(p) => (
            <Input
              {...p}
              type="url"
              inputMode="url"
              value={draft.externalUrl}
              onChange={text("externalUrl")}
              maxLength={500}
              placeholder="https://"
            />
          )}
        </Field>
        <div className="space-y-1.5 sm:col-span-6">
          <div className="flex items-center gap-2">
            <Checkbox
              id="internal-selection"
              checked={draft.internalSelectionEnabled}
              onCheckedChange={(c) => set("internalSelectionEnabled", c === true)}
              disabled={!INTERNAL_SELECTION_AVAILABLE}
              aria-invalid={hasErr("internalSelectionEnabled") || undefined}
              aria-describedby={hasErr("internalSelectionEnabled") ? "internal-selection-error" : undefined}
            />
            <Label htmlFor="internal-selection" className="text-stone-800">
              Seleção pela plataforma
            </Label>
            {!INTERNAL_SELECTION_AVAILABLE && (
              <Badge variant="outline" className="rounded-md border-stone-200 bg-stone-100 font-mono text-stone-700">
                Em breve
              </Badge>
            )}
          </div>
          {hasErr("internalSelectionEnabled") && (
            <p id="internal-selection-error" className="text-sm text-red-700">
              {err("internalSelectionEnabled").join(" ")}
            </p>
          )}
        </div>
      </Block>

      <Block title="Bolsa e dedicação">
        <fieldset className="space-y-2 sm:col-span-6">
          <legend className="text-sm font-medium text-stone-800">Modalidade</legend>
          <div className="flex flex-wrap gap-4">
            {(Object.keys(SCHOLARSHIP_LABELS) as ScholarshipType[]).map((t) => (
              <label key={t} className="flex items-center gap-2 text-sm text-stone-800">
                <input
                  type="radio"
                  name="scholarshipType"
                  value={t}
                  checked={draft.scholarshipType === t}
                  onChange={() => {
                    setScholarshipTouched(true);
                    set("scholarshipType", t);
                  }}
                  className="size-4 accent-brand"
                />
                {SCHOLARSHIP_LABELS[t]}
              </label>
            ))}
          </div>
          {err("scholarshipType").length > 0 && (
            <p className="text-sm text-red-700">{err("scholarshipType").join(" ")}</p>
          )}
        </fieldset>
        <Field
          label="Agência de fomento"
          optional
          hint={fundingSuggestions ? `Sugestões: ${fundingSuggestions.join(", ")}` : undefined}
          errors={err("fundingAgency")}
          className="sm:col-span-2"
        >
          {(p) => (
            <>
              <Input
                {...p}
                value={draft.fundingAgency}
                onChange={text("fundingAgency")}
                maxLength={64}
                list={fundingSuggestions ? `${p.id}-list` : undefined}
              />
              {fundingSuggestions && (
                <datalist id={`${p.id}-list`}>
                  {fundingSuggestions.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              )}
            </>
          )}
        </Field>
        <Field
          label="Valor mensal (R$)"
          optional
          errors={[...err("scholarshipValue"), ...err("scholarshipValueCents")]}
          className="sm:col-span-2"
        >
          {(p) => (
            <Input
              {...p}
              inputMode="decimal"
              value={draft.scholarshipValue}
              onChange={text("scholarshipValue")}
              placeholder="700,00"
              className="font-mono"
            />
          )}
        </Field>
        <Field
          label="Carga horária semanal (h)"
          optional
          hint="Entre 4 e 20 horas."
          errors={err("weeklyHours")}
          className="sm:col-span-2"
        >
          {(p) => (
            <Input
              {...p}
              type="number"
              inputMode="numeric"
              min={4}
              max={20}
              value={draft.weeklyHours}
              onChange={text("weeklyHours")}
              className="font-mono"
            />
          )}
        </Field>
      </Block>

      <OptionalBlock
        title="Cronograma"
        open={hasErr("applicationsOpenOn", "interviewStartsOn", "interviewEndsOn", "resultOn", "activitiesStartOn")}
      >
        {(
          [
            ["applicationsOpenOn", "Abertura das inscrições"],
            ["interviewStartsOn", "Entrevista/dinâmica: início"],
            ["interviewEndsOn", "Entrevista/dinâmica: fim"],
            ["resultOn", "Resultado"],
            ["activitiesStartOn", "Início das atividades"],
          ] as const
        ).map(([key, label]) => (
          <Field key={key} label={label} errors={err(key)} className="sm:col-span-3">
            {(p) => <Input {...p} type="date" value={draft[key]} onChange={text(key)} className="font-mono" />}
          </Field>
        ))}
      </OptionalBlock>

      <OptionalBlock
        title="Requisitos"
        open={hasErr("targetCourseIds", "minSemester", "availabilityRequirement", "noOtherScholarship")}
      >
        <fieldset className="space-y-2 sm:col-span-6">
          <legend className="text-sm font-medium text-stone-800">Cursos elegíveis</legend>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-stone-800">
              <input
                type="radio"
                name="courseScope"
                checked={!specificCourses}
                onChange={() => setSpecificCourses(false)}
                className="size-4 accent-brand"
              />
              Todos os cursos
            </label>
            <label className="flex items-center gap-2 text-sm text-stone-800">
              <input
                type="radio"
                name="courseScope"
                checked={specificCourses}
                onChange={() => setSpecificCourses(true)}
                className="size-4 accent-brand"
              />
              Cursos específicos
            </label>
          </div>
          {specificCourses && (
            <ul className="grid max-h-64 gap-2 overflow-y-auto rounded-lg border border-stone-200 p-3 sm:grid-cols-2">
              {courses.map((c) => {
                const id = `course-${c.id}`;
                return (
                  <li key={c.id} className="flex items-center gap-2">
                    <Checkbox
                      id={id}
                      checked={draft.targetCourseIds.includes(c.id)}
                      onCheckedChange={(v) => toggleCourse(c.id, v === true)}
                    />
                    <Label htmlFor={id} className="font-normal text-stone-700">
                      <span className="font-mono text-xs text-stone-500">{c.code}</span> {c.name}
                    </Label>
                  </li>
                );
              })}
            </ul>
          )}
          {err("targetCourseIds").length > 0 && (
            <p className="text-sm text-red-700">{err("targetCourseIds").join(" ")}</p>
          )}
        </fieldset>
        <Field label="Período mínimo" optional errors={err("minSemester")} className="sm:col-span-2">
          {(p) => (
            <Input
              {...p}
              type="number"
              inputMode="numeric"
              min={1}
              max={12}
              value={draft.minSemester}
              onChange={text("minSemester")}
              className="font-mono"
            />
          )}
        </Field>
        <Field
          label="Disponibilidade de horário"
          optional
          errors={err("availabilityRequirement")}
          className="sm:col-span-4"
        >
          {(p) => (
            <Input
              {...p}
              value={draft.availabilityRequirement}
              onChange={text("availabilityRequirement")}
              maxLength={200}
              placeholder="Ex.: tardes livres às terças e quintas"
            />
          )}
        </Field>
        <div className="flex items-center gap-2 sm:col-span-6">
          <Checkbox
            id="no-other-scholarship"
            checked={draft.noOtherScholarship}
            onCheckedChange={(c) => set("noOtherScholarship", c === true)}
          />
          <Label htmlFor="no-other-scholarship" className="font-normal text-stone-800">
            Não pode acumular com outra bolsa
          </Label>
        </div>
      </OptionalBlock>

      <OptionalBlock title="Tags" open={hasErr("tags")}>
        {TAG_GROUPS.map((g) => (
          <div key={g} className="sm:col-span-6">
            <TagCombobox
              label={TAG_GROUP_LABELS[g]}
              value={draft.tags[g]}
              onChange={(refs) => set("tags", { ...draft.tags, [g]: refs })}
              tagNames={initialTagNames}
              errors={err(`tags.${g}`)}
            />
          </div>
        ))}
      </OptionalBlock>

      {children}

      <div className="space-y-3">
        <FormMessage message={message} />
        {otherErrors.length > 0 && (
          <ul className="list-disc pl-5 text-sm text-red-700">
            {otherErrors.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {actions}
          <Button type="submit" size="lg" disabled={pending || submitDisabled} className="px-4">
            {pending ? "Enviando…" : (submitLabel ?? (mode === "edit" ? "Salvar alterações" : "Publicar processo"))}
          </Button>
        </div>
      </div>
    </form>
  );
}
