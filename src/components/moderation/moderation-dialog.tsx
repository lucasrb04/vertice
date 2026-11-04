"use client";

import { useState } from "react";
import { moderationAction, type ModerationActionKind } from "@/actions/moderation.actions";
import type { ActionResult } from "@/actions/result";
import { Field, FormMessage } from "@/components/projects/field";
import { errorsFor, type FieldErrors } from "@/components/projects/form-errors";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { MODERATION_REASON_MAX, MODERATION_REASON_MIN, type ModerationTargetType } from "@/lib/validation/moderation";

const COPY: Record<ModerationActionKind, { trigger: string; title: string; description: string; submit: string; outline: boolean }> = {
  hide: {
    trigger: "Ocultar",
    title: "Ocultar",
    description: "Sai do ar na hora. Os membros do projeto veem o motivo no painel.",
    submit: "Ocultar",
    outline: true,
  },
  restore: {
    trigger: "Restaurar",
    title: "Restaurar",
    description: "Volta ao estado anterior e resolve as denúncias pendentes.",
    submit: "Restaurar",
    outline: false,
  },
  dismiss: {
    trigger: "Descartar denúncias",
    title: "Descartar denúncias",
    description: "Resolve as denúncias pendentes sem mudar o estado do item.",
    submit: "Descartar",
    outline: true,
  },
};

/** Botão da ação e o diálogo com o motivo obrigatório. O Radix devolve o foco ao botão quando o diálogo fecha. */
export function ModerationDialog({
  kind,
  targetType,
  targetId,
  targetName,
  onDone,
}: {
  kind: ModerationActionKind;
  targetType: ModerationTargetType;
  targetId: string;
  targetName: string;
  onDone: (message: string) => void;
}) {
  const copy = COPY[kind];
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function handleOpenChange(next: boolean) {
    if (pending) return;
    setOpen(next);
    if (!next) {
      setReason("");
      setErrors({});
      setMessage(null);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setMessage(null);
    setErrors({});
    let res: ActionResult<{ message: string }>;
    try {
      res = await moderationAction(kind, { targetType, targetId, reason });
    } catch {
      res = { ok: false, error: "RULE", message: "Não foi possível concluir agora. Tente de novo." };
    }
    setPending(false);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      setMessage(res.message);
      return;
    }
    handleOpenChange(false);
    onDone(`${res.data.message} ${targetName}`);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant={copy.outline ? "outline" : "default"} size="sm" aria-label={`${copy.trigger}: ${targetName}`}>
          {copy.trigger}
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-lg ring-stone-200 sm:max-w-md">
        <form onSubmit={handleSubmit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle className="text-stone-900">{copy.title}</DialogTitle>
            <DialogDescription className="text-stone-600">
              <span className="font-medium text-stone-800">{targetName}</span>. {copy.description}
            </DialogDescription>
          </DialogHeader>
          <Field
            label="Motivo"
            hint={`De ${MODERATION_REASON_MIN} a ${MODERATION_REASON_MAX} caracteres. Fica no registro de auditoria.`}
            errors={errorsFor(errors, "reason")}
          >
            {(p) => (
              <Textarea
                {...p}
                rows={4}
                required
                minLength={MODERATION_REASON_MIN}
                maxLength={MODERATION_REASON_MAX}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            )}
          </Field>
          <FormMessage message={message} />
          <DialogFooter className="rounded-b-lg border-stone-200 bg-stone-50">
            <Button type="button" variant="outline" disabled={pending} onClick={() => handleOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Aguarde…" : copy.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
