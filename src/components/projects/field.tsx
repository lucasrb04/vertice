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
    <div className={cn("space-y-1.5", highlight && "rounded-lg border border-brand/30 bg-brand/5 p-3", className)}>
      <Label htmlFor={id} className="text-stone-800">
        {label}
        {optional && <span className="text-xs font-normal text-stone-500">opcional</span>}
      </Label>
      {children({
        id,
        "aria-invalid": errors.length > 0 ? true : undefined,
        "aria-describedby": describedBy || undefined,
      })}
      {hint && (
        <p id={hintId} className="text-xs text-stone-500">
          {hint}
        </p>
      )}
      {errors.length > 0 && (
        <p id={errorId} className="text-sm text-red-700">
          {errors.join(" ")}
        </p>
      )}
    </div>
  );
}

export function FormMessage({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
      {message}
    </p>
  );
}
