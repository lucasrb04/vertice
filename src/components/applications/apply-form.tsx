"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { applyToOpportunityAction } from "@/actions/application.actions";
import type { ActionResult } from "@/actions/result";
import { Field, FormMessage } from "@/components/projects/field";
import { errorsFor, type FieldErrors } from "@/components/projects/form-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ANSWER_MAX, PROFILE_LINK_MAX } from "@/lib/validation/application";

export type ApplyFormInitial = { courseId: string; currentSemester: string; profileLink: string };

type Requirements = { minSemester: number | null; maxSemester: number | null; targetCourseIds: string[] };

/** Requisitos não atendidos viram aviso: quem decide é a equipe do projeto. */
function warnings(req: Requirements, courseId: string, semester: string, courseNames: Record<string, string>): string[] {
  const out: string[] = [];
  const n = Number(semester);
  if (semester && req.minSemester !== null && n < req.minSemester) {
    out.push(`O processo pede a partir do ${req.minSemester}º período.`);
  }
  if (semester && req.maxSemester !== null && n > req.maxSemester) {
    out.push(`O processo pede até o ${req.maxSemester}º período.`);
  }
  if (courseId && req.targetCourseIds.length > 0 && !req.targetCourseIds.includes(courseId)) {
    out.push(`O processo é voltado a: ${req.targetCourseIds.map((id) => courseNames[id] ?? id).join(", ")}.`);
  }
  return out;
}

export function ApplyForm({
  opportunitySlug,
  question,
  courses,
  initial,
  requirements,
}: {
  opportunitySlug: string;
  question: string | null;
  courses: { id: string; name: string }[];
  initial: ApplyFormInitial;
  requirements: Requirements;
}) {
  const router = useRouter();
  const [courseId, setCourseId] = useState(initial.courseId);
  const [semester, setSemester] = useState(initial.currentSemester);
  const [profileLink, setProfileLink] = useState(initial.profileLink);
  const [answer, setAnswer] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const courseNames = Object.fromEntries(courses.map((c) => [c.id, c.name]));
  const notices = warnings(requirements, courseId, semester, courseNames);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setMessage(null);
    let res: ActionResult<{ opportunitySlug: string }>;
    try {
      res = await applyToOpportunityAction({
        opportunitySlug,
        courseId,
        currentSemester: semester.trim() === "" ? undefined : Number(semester),
        profileLink,
        answerText: question ? answer : undefined,
      });
    } catch {
      res = { ok: false, error: "RULE", message: "Não foi possível enviar agora. Tente de novo." };
    }
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      setMessage(res.message);
      setPending(false);
      return;
    }
    // Em sucesso o envio continua "pendente" até a navegação, para evitar clique duplo.
    router.push("/minhas-candidaturas");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <section className="space-y-5 rounded-lg border border-stone-200 bg-white p-5">
        <h2 className="text-base font-semibold tracking-tight text-stone-900">Seu perfil</h2>
        <div className="grid gap-5 sm:grid-cols-6">
          <Field label="Curso" errors={errorsFor(errors, "courseId")} className="sm:col-span-4">
            {(p) => (
              <Select value={courseId} onValueChange={setCourseId}>
                <SelectTrigger {...p} className="w-full bg-white">
                  <SelectValue placeholder="Escolha o curso" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
          <Field label="Período" errors={errorsFor(errors, "currentSemester")} className="sm:col-span-2">
            {(p) => (
              <Input
                {...p}
                type="number"
                inputMode="numeric"
                min={1}
                max={12}
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                className="font-mono"
              />
            )}
          </Field>
          <Field
            label="Link de perfil"
            optional
            hint="LinkedIn, GitHub, Lattes ou portfólio."
            errors={errorsFor(errors, "profileLink")}
            className="sm:col-span-6"
          >
            {(p) => (
              <Input
                {...p}
                type="url"
                value={profileLink}
                onChange={(e) => setProfileLink(e.target.value)}
                maxLength={PROFILE_LINK_MAX}
                placeholder="https://"
              />
            )}
          </Field>
        </div>
        {notices.length > 0 && (
          <ul role="status" className="space-y-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {notices.map((n) => (
              <li key={n}>{n} Você ainda pode se candidatar; a equipe decide.</li>
            ))}
          </ul>
        )}
      </section>

      {question && (
        <section className="rounded-lg border border-stone-200 bg-white p-5">
          <Field
            label={question}
            hint={<span className="font-mono">{answer.length}/{ANSWER_MAX}</span>}
            errors={errorsFor(errors, "answerText")}
          >
            {(p) => (
              <Textarea {...p} value={answer} onChange={(e) => setAnswer(e.target.value)} maxLength={ANSWER_MAX} rows={5} />
            )}
          </Field>
        </section>
      )}

      <p className="text-sm text-stone-600">
        A equipe do projeto verá seu nome, e-mail, curso, período, link e resposta.
      </p>
      <FormMessage message={message} />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Enviando…" : "Enviar candidatura"}
      </Button>
    </form>
  );
}
