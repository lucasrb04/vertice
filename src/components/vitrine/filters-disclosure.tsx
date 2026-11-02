"use client";

import { useState, type ReactNode } from "react";

/**
 * `<details>` dos filtros. `open` fica em estado: o servidor reenvia `defaultOpen` a cada navegação
 * e, como atributo controlado, fecharia o painel ao desmarcar o último filtro. Sem JS o SSR já
 * entrega o `<details>` aberto ou fechado.
 */
export function FiltersDisclosure({
  defaultOpen,
  className,
  children,
}: {
  defaultOpen: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)} className={className}>
      {children}
    </details>
  );
}
