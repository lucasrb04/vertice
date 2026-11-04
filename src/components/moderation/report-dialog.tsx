"use client";

import { Flag } from "lucide-react";
import { useState } from "react";
import { reportAction } from "@/actions/report.actions";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  type ModerationTargetType,
  REPORT_DESCRIPTION_MAX,
  REPORT_REASON_LABELS,
  REPORT_REASONS,
  type ReportReason,
} from "@/lib/validation/moderation";

const TARGET_NOUNS: Record<ModerationTargetType, string> = { PROJECT: "este projeto", OPPORTUNITY: "este processo" };

/** Botão "Denunciar" e o diálogo. O Radix devolve o foco ao botão quando o diálogo fecha. */
export function ReportDialog({ targetType, targetId }: { targetType: ModerationTargetType; targetId: string }) {
  const [open, setOpen] = useState(false);
  const [reasonCode, setReasonCode] = useState<ReportReason | "">("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function handleOpenChange(next: boolean) {
    if (pending) return;
    setOpen(next);
    if (!next) {
      setReasonCode("");
      setDescription("");
      setErrors({});
      setMessage(null);
      setDone(null);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    if (!reasonCode) {
      setErrors({ reasonCode: ["Escolha um motivo."] });
      return;
    }
    setPending(true);
    setMessage(null);
    setErrors({});
    let res: ActionResult<{ message: string }>;
    try {
      res = await reportAction({ targetType, targetId, reasonCode, description });
    } catch {
      res = { ok: false, error: "RULE", message: "Não foi possível enviar agora. Tente de novo." };
    }
    setPending(false);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      setMessage(res.message);
      return;
    }
    setDone(res.data.message);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-stone-600">
          <Flag aria-hidden data-icon="inline-start" />
          Denunciar
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-lg ring-stone-200 sm:max-w-md">
        {done ? (
          <div className="grid gap-4">
            <DialogHeader>
              <DialogTitle className="text-stone-900">Denúncia enviada</DialogTitle>
              <DialogDescription role="status" className="text-stone-700">
                {done}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="rounded-b-lg border-stone-200 bg-stone-50">
              <Button type="button" onClick={() => handleOpenChange(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-4">
            <DialogHeader>
              <DialogTitle className="text-stone-900">Denunciar</DialogTitle>
              <DialogDescription className="text-stone-600">
                Conte à moderação o que há de errado com {TARGET_NOUNS[targetType]}.
              </DialogDescription>
            </DialogHeader>
            <Field label="Motivo" errors={errorsFor(errors, "reasonCode")}>
              {(p) => (
                <Select value={reasonCode} onValueChange={(v) => setReasonCode(v as ReportReason)}>
                  <SelectTrigger {...p} className="w-full bg-white">
                    <SelectValue placeholder="Escolha o motivo" />
                  </SelectTrigger>
                  <SelectContent>
                    {REPORT_REASONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {REPORT_REASON_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
            <Field
              label="Descrição"
              optional
              hint={`Até ${REPORT_DESCRIPTION_MAX} caracteres.`}
              errors={errorsFor(errors, "description")}
            >
              {(p) => (
                <Textarea
                  {...p}
                  rows={4}
                  maxLength={REPORT_DESCRIPTION_MAX}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              )}
            </Field>
            <FormMessage message={message} />
            <DialogFooter className="rounded-b-lg border-stone-200 bg-stone-50">
              <Button type="button" variant="outline" disabled={pending} onClick={() => handleOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Aguarde…" : "Enviar denúncia"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
