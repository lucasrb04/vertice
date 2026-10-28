"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/actions/result";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { FormMessage } from "./field";

/**
 * Botão com confirmação (`AlertDialog`). O diálogo fica aberto enquanto a action roda e mostra a
 * mensagem de erro dela; em sucesso fecha e atualiza a página (ou navega para `redirectTo`).
 */
export function ConfirmActionButton({
  label,
  title,
  description,
  confirmLabel,
  action,
  redirectTo,
  variant = "outline",
  size = "sm",
}: {
  label: string;
  title: string;
  description: string;
  confirmLabel: string;
  action: () => Promise<ActionResult<unknown>>;
  redirectTo?: string;
  variant?: "outline" | "destructive" | "ghost";
  size?: "sm" | "default" | "lg";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function confirm(e: React.MouseEvent) {
    e.preventDefault(); // não fecha antes de a action terminar
    if (pending) return;
    setPending(true);
    setMessage(null);
    let res: ActionResult<unknown>;
    try {
      res = await action();
    } catch {
      res = { ok: false, error: "RULE", message: "Não foi possível concluir agora. Tente de novo." };
    }
    setPending(false);
    if (!res.ok) {
      setMessage(res.message);
      return;
    }
    setOpen(false);
    if (redirectTo) router.push(redirectTo);
    router.refresh();
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        setOpen(next);
        if (!next) setMessage(null);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button type="button" variant={variant} size={size}>
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="rounded-lg ring-stone-200">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-stone-900">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-stone-600">{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <FormMessage message={message} />
        <AlertDialogFooter className="rounded-b-lg border-stone-200 bg-stone-50">
          <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={pending} onClick={confirm}>
            {pending ? "Aguarde…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
