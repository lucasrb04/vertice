"use client";

import { type ReactNode, useId } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type ControlProps = {
  id: string;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
};

/** Rótulo, controle, dica e erros do servidor ligados por `aria-describedby`. */
export function Field({
  label,
  hint,
  errors = [],
  optional = false,
  highlight = false,
  className,
  children,
}: {
  label: string;
  hint?: ReactNode;
  errors?: string[];
  optional?: boolean;
  highlight?: boolean;
  className?: string;
  children: (props: ControlProps) => ReactNode;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, errors.length > 0 ? errorId : null].filter(Boolean).join(" ");
  return (
    <div className={cn("space-y-1.5", highlight && "rounded-xl border border-ipe bg-ipe-soft p-3", className)}>
      <Label htmlFor={id} className="text-[0.95rem] font-semibold text-ink">
        {label}
        {optional && <span className="text-sm font-normal text-ink-3">opcional</span>}
      </Label>
      {children({
        id,
        "aria-invalid": errors.length > 0 ? true : undefined,
        "aria-describedby": describedBy || undefined,
      })}
      {hint && (
        <p id={hintId} className="text-sm text-ink-3">
          {hint}
        </p>
      )}
      {errors.length > 0 && (
        <p id={errorId} className="text-sm font-medium text-danger-ink">
          {errors.join(" ")}
        </p>
      )}
    </div>
  );
}

export function FormMessage({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-xl border border-danger-ink/25 bg-danger-soft px-3.5 py-2.5 text-sm text-danger-ink"
    >
      {message}
    </p>
  );
}
