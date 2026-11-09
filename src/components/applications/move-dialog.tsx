"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { moveApplicationsAction } from "@/actions/application.actions";
import type { ActionResult } from "@/actions/result";
import { Field, FormMessage } from "@/components/projects/field";
import { errorsFor, type FieldErrors, withoutFieldError } from "@/components/projects/form-errors";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUSES,
  type ApplicationStatus,
  FINAL_STATUSES,
  REJECTION_SUGGESTION,
} from "@/lib/applications/labels";
import { MOVE_MESSAGE_MAX } from "@/lib/validation/application";

export type MoveTarget = {
  items: { applicationId: string; fromStatus: ApplicationStatus }[];
  /** Quem será movido, em texto: o nome do candidato ou "3 candidatos selecionados". */
  summary: string;
};

/**
 * Escolha da etapa e mensagem opcional. Cada movimento manda e-mail na hora, e o diálogo diz isso antes do envio;
 * nas etapas de resultado há um segundo passo de confirmação. Fica aberto enquanto a action roda e mostra o erro.
 */
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
  const [confirming, setConfirming] = useState(false);
  const submitRef = useRef<HTMLButtonElement>(null);

  // Um candidato só não precisa da própria etapa como destino.
  const single = target.items.length === 1 ? target.items[0]!.fromStatus : null;
  const isFinal = toStatus !== "" && FINAL_STATUSES.includes(toStatus);

  function back() {
    setConfirming(false);
    setMessage(null);
    requestAnimationFrame(() => submitRef.current?.focus());
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    if (!toStatus) {
      setErrors({ toStatus: ["Escolha a etapa."] });
      return;
    }
    if (isFinal && !confirming) {
      setMessage(null);
      setConfirming(true);
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
      // Erro de campo só aparece no formulário.
      if (res.fieldErrors) setConfirming(false);
      return;
    }
    onMoved(res.data);
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        if (!next) setConfirming(false);
        onOpenChange(next);
      }}
    >
      <DialogContent className="rounded-lg ring-stone-200 sm:max-w-md" onCloseAutoFocus={onCloseAutoFocus}>
        <form onSubmit={handleSubmit} className="grid gap-4">
          {confirming && toStatus !== "" ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-stone-900">Confirmar resultado</DialogTitle>
                <DialogDescription className="[overflow-wrap:anywhere] text-stone-700">
                  {single !== null
                    ? `${target.summary} passa para ${APPLICATION_STATUS_LABELS[toStatus]} e recebe o e-mail agora.`
                    : `Os ${target.items.length} candidatos selecionados passam para ${APPLICATION_STATUS_LABELS[toStatus]} e recebem o e-mail agora.`}
                </DialogDescription>
              </DialogHeader>
              {text.trim() ? (
                <figure className="grid gap-1">
                  <figcaption className="text-sm font-medium text-stone-900">Mensagem</figcaption>
                  <blockquote className="max-h-48 overflow-y-auto rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm whitespace-pre-line [overflow-wrap:anywhere] text-stone-800">
                    {text.trim()}
                  </blockquote>
                </figure>
              ) : (
                <p className="text-sm text-stone-700">Sem mensagem: o e-mail informa só a nova etapa.</p>
              )}
              <p className="text-sm font-medium text-stone-900">O e-mail não pode ser desfeito.</p>
              <FormMessage message={message} />
              <DialogFooter className="rounded-b-lg border-stone-200 bg-stone-50">
                {/* O botão que tinha o foco sai da tela: ele vai para o passo seguro, e dois Enter não enviam. */}
                <Button type="button" variant="outline" disabled={pending} onClick={back} autoFocus>
                  Voltar
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? "Enviando…" : "Enviar resultado"}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="text-stone-900">Mover para</DialogTitle>
                <DialogDescription className="[overflow-wrap:anywhere] text-stone-600">
                  {target.summary}
                </DialogDescription>
              </DialogHeader>
              <p className="text-sm [overflow-wrap:anywhere] text-stone-800">
                {single !== null
                  ? `${target.summary} recebe um e-mail com a nova etapa e a sua mensagem assim que você mover.`
                  : "Cada candidato recebe um e-mail com a nova etapa e a sua mensagem assim que você mover."}
              </p>
              <Field label="Etapa de destino" errors={errorsFor(errors, "toStatus")}>
                {(p) => (
                  <Select
                    value={toStatus}
                    onValueChange={(v) => {
                      setToStatus(v as ApplicationStatus);
                      setErrors((e) => withoutFieldError(e, "toStatus"));
                    }}
                  >
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
                hint={`Até ${MOVE_MESSAGE_MAX} caracteres. Também fica em Minhas candidaturas.`}
                errors={errorsFor(errors, "message")}
              >
                {(p) => (
                  <Textarea
                    {...p}
                    rows={4}
                    maxLength={MOVE_MESSAGE_MAX}
                    value={text}
                    onChange={(e) => {
                      setText(e.target.value);
                      setErrors((prev) => withoutFieldError(prev, "message"));
                    }}
                  />
                )}
              </Field>
              {toStatus === "REJECTED" && text.trim() === "" && (
                <div>
                  <Button type="button" variant="outline" size="sm" onClick={() => setText(REJECTION_SUGGESTION)}>
                    Usar texto sugerido
                  </Button>
                </div>
              )}
              <FormMessage message={message} />
              <DialogFooter className="rounded-b-lg border-stone-200 bg-stone-50">
                <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button ref={submitRef} type="submit" disabled={pending}>
                  {pending ? "Aguarde…" : "Mover e avisar"}
                </Button>
              </DialogFooter>
            </>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
