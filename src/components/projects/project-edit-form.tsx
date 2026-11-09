"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { updateProjectAction } from "@/actions/project.actions";
import type { ActionResult } from "@/actions/result";
import { Button } from "@/components/ui/button";
import { FormMessage } from "./field";
import type { FieldErrors } from "./form-errors";
import { type ProjectDraft, ProjectFields, toProjectFormValues } from "./project-fields";

/** Edição dos dados do projeto (os mesmos campos do passo 1 do wizard). */
export function ProjectEditForm({ projectId, initialValues }: { projectId: string; initialValues: ProjectDraft }) {
  const router = useRouter();
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setMessage(null);
    let res: ActionResult;
    try {
      res = await updateProjectAction(projectId, toProjectFormValues(values));
    } catch {
      res = { ok: false, error: "RULE", message: "Não foi possível salvar agora. Tente de novo." };
    }
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      setMessage(res.message);
      setPending(false);
      return;
    }
    // Continua "pendente" até a navegação, para evitar clique duplo.
    router.push(`/projetos/${projectId}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <section className="rounded-2xl bg-surface shadow-card p-5">
        <ProjectFields values={values} onChange={setValues} errors={errors} />
      </section>
      <FormMessage message={message} />
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button asChild variant="outline" size="lg" className="px-4">
          <Link href={`/projetos/${projectId}`}>Cancelar</Link>
        </Button>
        <Button type="submit" size="lg" disabled={pending} className="px-4">
          {pending ? "Salvando…" : "Salvar alterações"}
        </Button>
      </div>
    </form>
  );
}
