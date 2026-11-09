"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createProjectWithOpportunityAction } from "@/actions/project.actions";
import type { ActionResult } from "@/actions/result";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { OpportunityFormValues } from "@/lib/validation/opportunity";
import { projectInputSchema } from "@/lib/validation/project";
import { FormMessage } from "./field";
import { type FieldErrors, splitPrefixedErrors } from "./form-errors";
import { type Course, OpportunityForm } from "./opportunity-form";
import { EMPTY_PROJECT, type ProjectDraft, ProjectFields, toProjectFormValues } from "./project-fields";
import { TurnstileWidget } from "./turnstile-widget";

/** No passo 1 o cliente confere só os obrigatórios; o servidor valida tudo no envio final. */
const requiredProjectFields = projectInputSchema.pick({
  name: true,
  category: true,
  shortDescription: true,
  contactEmail: true,
});

function validateRequired(draft: ProjectDraft): FieldErrors {
  const parsed = requiredProjectFields.safeParse(toProjectFormValues(draft));
  if (parsed.success) return {};
  const errors: FieldErrors = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path.join(".");
    errors[key] = [...(errors[key] ?? []), issue.message];
  }
  return errors;
}

function StepIndicator({ step }: { step: 1 | 2 }) {
  const item = (n: 1 | 2, label: string) => (
    <li
      aria-current={n === step ? "step" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-xl px-3.5 py-2 font-semibold",
        n === step ? "bg-ipe text-ink" : "text-ink-2",
      )}
    >
      <span
        className={cn(
          "grid size-6 place-items-center rounded-full text-sm tabular-nums",
          n === step ? "bg-ink text-white" : "bg-fact text-ink-2",
        )}
      >
        {n}
      </span>
      {label}
    </li>
  );
  return (
    <ol className="flex flex-wrap gap-1.5 rounded-2xl bg-surface p-1.5 shadow-card sm:w-fit">
      {item(1, "Sobre o projeto")}
      {item(2, "Sobre o processo")}
    </ol>
  );
}

/** Wizard de 2 passos (spec §6.4): nada é gravado até "Publicar", que cria tudo numa transação. */
export function PublishWizard({ courses, siteKey, bypass }: { courses: Course[]; siteKey: string; bypass: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [visited2, setVisited2] = useState(false);
  const [project, setProject] = useState<ProjectDraft>(EMPTY_PROJECT);
  const [projectErrors, setProjectErrors] = useState<FieldErrors>({});
  const [projectMessage, setProjectMessage] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  function goToStep2(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const errors = validateRequired(project);
    setProjectErrors(errors);
    setProjectMessage(Object.keys(errors).length > 0 ? "Preencha os campos obrigatórios." : null);
    if (Object.keys(errors).length > 0) return;
    setStep(2);
    setVisited2(true);
    window.scrollTo({ top: 0 });
  }

  async function publish(opportunity: OpportunityFormValues): Promise<ActionResult<unknown>> {
    const res = await createProjectWithOpportunityAction({
      turnstileToken: token ?? "",
      project: toProjectFormValues(project),
      opportunity,
    });
    if (res.ok) {
      router.push(`/projetos/${res.data.projectId}?publicado=${res.data.opportunityId}`);
      return res;
    }
    // Token do Turnstile é de uso único: qualquer recusa pede um novo desafio.
    setToken(null);
    setAttempt((a) => a + 1);
    const split = splitPrefixedErrors(res.fieldErrors, ["project", "opportunity"] as const);
    if (Object.keys(split.project).length > 0) {
      setProjectErrors(split.project);
      setProjectMessage(res.message);
      setStep(1);
      window.scrollTo({ top: 0 });
    }
    return { ...res, fieldErrors: { ...split.opportunity, ...split.rest } };
  }

  return (
    <div className="space-y-6">
      <StepIndicator step={step} />

      <form onSubmit={goToStep2} noValidate hidden={step !== 1} className="space-y-4">
        <section className="rounded-2xl bg-surface p-5 shadow-card sm:p-7">
          <ProjectFields values={project} onChange={setProject} errors={projectErrors} />
        </section>
        <FormMessage message={projectMessage} />
        <div className="flex justify-end">
          <Button type="submit" size="lg">
            Continuar
          </Button>
        </div>
      </form>

      {visited2 && (
        <div hidden={step !== 2}>
          <OpportunityForm
            mode="create"
            courses={courses}
            category={project.category}
            onSubmit={publish}
            submitLabel="Publicar"
            submitDisabled={!token}
            actions={
              <Button type="button" variant="outline" size="lg" onClick={() => setStep(1)}>
                Voltar
              </Button>
            }
          >
            <TurnstileWidget key={attempt} siteKey={siteKey} bypass={bypass} onToken={setToken} />
          </OpportunityForm>
        </div>
      )}
    </div>
  );
}
