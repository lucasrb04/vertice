"use client";

import { useState } from "react";

/**
 * Select de ordenação controlado: acompanha a URL (voltar no histórico) sem remontar, o que
 * perderia o foco. O `change` nativo continua subindo até o formulário, onde o `AutoSubmit` escuta.
 */
export function SortSelect({ value, options }: { value: string; options: { value: string; label: string }[] }) {
  const [current, setCurrent] = useState(value);
  const [prev, setPrev] = useState(value);
  // Ajuste de estado na renderização: a prop mudou (navegação), então o estado local a segue.
  if (value !== prev) {
    setPrev(value);
    setCurrent(value);
  }
  return (
    <select
      id="ordenacao"
      name="sort"
      value={current}
      onChange={(e) => setCurrent(e.target.value)}
      className="h-11 w-full min-w-0 rounded-xl border border-transparent bg-surface px-3 text-base font-medium text-ink shadow-card hover:border-line-strong sm:w-auto sm:min-w-[200px]"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
