"use client";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORY_LABELS, type ProjectCategory } from "@/lib/projects/labels";
import { PROJECT_CATEGORIES, type ProjectFormValues } from "@/lib/validation/project";
import { Field } from "./field";
import { errorsFor, type FieldErrors } from "./form-errors";

/** Estado editável do passo 1: tudo string; categoria vazia até a escolha. */
export type ProjectDraft = {
  name: string;
  acronym: string;
  category: ProjectCategory | "";
  institute: string;
  advisorName: string;
  shortDescription: string;
  description: string;
  contactEmail: string;
  websiteUrl: string;
  instagramUrl: string;
};

export const EMPTY_PROJECT: ProjectDraft = {
  name: "",
  acronym: "",
  category: "",
  institute: "",
  advisorName: "",
  shortDescription: "",
  description: "",
  contactEmail: "",
  websiteUrl: "",
  instagramUrl: "",
};

/** Envia o rascunho como está; o servidor normaliza vazios e valida tudo. */
export function toProjectFormValues(draft: ProjectDraft): ProjectFormValues {
  return { ...draft, category: draft.category as ProjectCategory };
}

export function ProjectFields({
  values,
  onChange,
  errors,
}: {
  values: ProjectDraft;
  onChange: (next: ProjectDraft) => void;
  errors?: FieldErrors;
}) {
  const set =
    <K extends keyof ProjectDraft>(key: K) =>
    (v: ProjectDraft[K]) =>
      onChange({ ...values, [key]: v });
  const text =
    (key: Exclude<keyof ProjectDraft, "category">) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      set(key)(e.target.value);
  const isIC = values.category === "SCIENTIFIC_INIT";

  return (
    <div className="grid gap-5 sm:grid-cols-6">
      <Field label="Nome do projeto" errors={errorsFor(errors, "name")} className="sm:col-span-4">
        {(p) => <Input {...p} value={values.name} onChange={text("name")} maxLength={140} required />}
      </Field>
      <Field label="Sigla" optional errors={errorsFor(errors, "acronym")} className="sm:col-span-2">
        {(p) => <Input {...p} value={values.acronym} onChange={text("acronym")} maxLength={20} />}
      </Field>
      <Field label="Categoria" errors={errorsFor(errors, "category")} className="sm:col-span-3">
        {(p) => (
          <Select value={values.category} onValueChange={(v) => set("category")(v as ProjectCategory)}>
            <SelectTrigger {...p} className="w-full bg-white">
              <SelectValue placeholder="Escolha a categoria" />
            </SelectTrigger>
            <SelectContent>
              {PROJECT_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Field>
      <Field label="Instituto/Departamento" optional errors={errorsFor(errors, "institute")} className="sm:col-span-3">
        {(p) => (
          <Input {...p} value={values.institute} onChange={text("institute")} maxLength={32} placeholder="Ex.: IESTI" />
        )}
      </Field>
      <Field
        label="Professor orientador / coordenador"
        optional={!isIC}
        highlight={isIC}
        hint={isIC ? "Em iniciação científica, informe o professor orientador." : undefined}
        errors={errorsFor(errors, "advisorName")}
        className="sm:col-span-6"
      >
        {(p) => <Input {...p} value={values.advisorName} onChange={text("advisorName")} maxLength={120} />}
      </Field>
      <Field
        label="Descrição curta"
        hint={<span className="font-mono">{values.shortDescription.length}/280</span>}
        errors={errorsFor(errors, "shortDescription")}
        className="sm:col-span-6"
      >
        {(p) => (
          <Textarea
            {...p}
            value={values.shortDescription}
            onChange={text("shortDescription")}
            maxLength={280}
            rows={2}
            required
          />
        )}
      </Field>
      <Field
        label="Descrição longa"
        optional
        hint="Aceita Markdown simples. Links precisam começar com https://"
        errors={errorsFor(errors, "description")}
        className="sm:col-span-6"
      >
        {(p) => <Textarea {...p} value={values.description} onChange={text("description")} maxLength={5000} rows={5} />}
      </Field>
      <Field label="E-mail de contato" errors={errorsFor(errors, "contactEmail")} className="sm:col-span-6">
        {(p) => (
          <Input
            {...p}
            type="email"
            value={values.contactEmail}
            onChange={text("contactEmail")}
            maxLength={255}
            required
          />
        )}
      </Field>
      <Field label="Site" optional errors={errorsFor(errors, "websiteUrl")} className="sm:col-span-3">
        {(p) => (
          <Input
            {...p}
            type="url"
            inputMode="url"
            value={values.websiteUrl}
            onChange={text("websiteUrl")}
            maxLength={255}
            placeholder="https://"
          />
        )}
      </Field>
      <Field label="Instagram" optional errors={errorsFor(errors, "instagramUrl")} className="sm:col-span-3">
        {(p) => (
          <Input
            {...p}
            type="url"
            inputMode="url"
            value={values.instagramUrl}
            onChange={text("instagramUrl")}
            maxLength={255}
            placeholder="https://instagram.com/…"
          />
        )}
      </Field>
    </div>
  );
}
