"use client";

import { useState } from "react";

/**
 * Select de ordenação controlado: acompanha a URL (voltar no histórico) sem remontar, o que
 * perderia o foco. O `change` nativo continua subindo até o formulário, onde o `AutoSubmit` escuta.
 */
export function SortSelect({
  value,
  options,
}: {
  value: string;
  options: { value: string; label: string }[];
}) {
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
      className="h-9 min-w-0 rounded-md border border-stone-200 bg-white px-2 text-sm text-stone-800"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
