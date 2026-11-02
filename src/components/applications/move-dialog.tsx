"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { moveApplicationsAction } from "@/actions/application.actions";
import type { ActionResult } from "@/actions/result";
import { Field, FormMessage } from "@/components/projects/field";
import { errorsFor, type FieldErrors } from "@/components/projects/form-errors";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { APPLICATION_STATUSES, APPLICATION_STATUS_LABELS, type ApplicationStatus } from "@/lib/applications/labels";
import { MOVE_MESSAGE_MAX } from "@/lib/validation/application";

export type MoveTarget = {
  items: { applicationId: string; fromStatus: ApplicationStatus }[];
  /** Quem será movido, em texto: o nome do candidato ou "3 candidatos selecionados". */
  summary: string;
};

/** Escolha da etapa e mensagem opcional. Fica aberto enquanto a action roda e mostra o erro dela. */
export function MoveDialog({
  projectId,
  opportunityId,
  target,
  open,
  onOpenChange,
  onMoved,
  onCloseAutoFocus,
}: {
  projectId: string;
  opportunityId: string;
  target: MoveTarget;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMoved: (result: { moved: number; skipped: number }) => void;
  onCloseAutoFocus: (event: Event) => void;
}) {
  const router = useRouter();
  const [toStatus, setToStatus] = useState<ApplicationStatus | "">("");
  const [text, setText] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Um candidato só não precisa da própria etapa como destino.
  const single = target.items.length === 1 ? target.items[0]!.fromStatus : null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    if (!toStatus) {
      setErrors({ toStatus: ["Escolha a etapa."] });
      return;
    }
    setPending(true);
    setMessage(null);
    setErrors({});
    let res: ActionResult<{ moved: number; skipped: number }>;
    try {
      res = await moveApplicationsAction({ projectId, opportunityId, items: target.items, toStatus, message: text });
    } catch {
      res = { ok: false, error: "RULE", message: "Não foi possível mover agora. Tente de novo." };
    }
    setPending(false);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      setMessage(res.message);
      return;
    }
    onMoved(res.data);
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
    >
      <DialogContent className="rounded-lg ring-stone-200 sm:max-w-md" onCloseAutoFocus={onCloseAutoFocus}>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle className="text-stone-900">Mover para</DialogTitle>
            <DialogDescription className="[overflow-wrap:anywhere] text-stone-600">{target.summary}</DialogDescription>
          </DialogHeader>
          <Field label="Etapa de destino" errors={errorsFor(errors, "toStatus")}>
            {(p) => (
              <Select value={toStatus} onValueChange={(v) => setToStatus(v as ApplicationStatus)}>
                <SelectTrigger {...p} className="w-full bg-white">
                  <SelectValue placeholder="Escolha a etapa" />
                </SelectTrigger>
                <SelectContent>
                  {APPLICATION_STATUSES.filter((s) => s !== single).map((s) => (
                    <SelectItem key={s} value={s}>
                      {APPLICATION_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
          <Field
            label="Mensagem ao candidato"
            optional
            hint={`Até ${MOVE_MESSAGE_MAX} caracteres. O aluno recebe um e-mail e vê a mensagem em Minhas candidaturas.`}
            errors={errorsFor(errors, "message")}
          >
            {(p) => (
              <Textarea {...p} rows={4} maxLength={MOVE_MESSAGE_MAX} value={text} onChange={(e) => setText(e.target.value)} />
            )}
          </Field>
          <FormMessage message={message} />
          <DialogFooter className="rounded-b-lg border-stone-200 bg-stone-50">
            <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Aguarde…" : "Mover"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
