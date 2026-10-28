"use client";

import { useEffect, useId, useRef, useState } from "react";
import { XIcon } from "lucide-react";
import { searchTagsAction } from "@/actions/tag.actions";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { normalizeTagSlug } from "@/lib/search/tags";
import type { TagRef } from "@/lib/validation/opportunity";
import { addTagRef, removeTagRef, tagRefKey } from "./tag-refs";

const DEBOUNCE_MS = 200;

type TagOption = { id: string; name: string };

/**
 * Escolha de tags com busca nas tags da instituição. Enter num termo sem resultado igual adiciona
 * uma tag nova só no cliente (`{ name }`); ela é criada no servidor no envio do formulário.
 */
export function TagCombobox({
  value,
  onChange,
  label,
  max = 10,
  tagNames,
  errors = [],
}: {
  value: TagRef[];
  onChange: (refs: TagRef[]) => void;
  label: string;
  max?: number;
  /** Nomes de exibição de tags existentes já escolhidas (id → nome). */
  tagNames?: Record<string, string>;
  errors?: string[];
}) {
  const errorId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TagOption[]>([]);
  const [known, setKnown] = useState<Record<string, string>>({});
  const [navigated, setNavigated] = useState(false);
  const requestId = useRef(0);

  const names = { ...tagNames, ...known };
  const term = query.trim();
  const full = value.length >= max;

  useEffect(() => {
    if (!term) return;
    const id = ++requestId.current;
    const timer = setTimeout(() => {
      searchTagsAction(term)
        .then((rows) => {
          if (id === requestId.current) setResults(rows);
        })
        // Sem sessão a action rejeita: mostra nenhum resultado.
        .catch(() => {
          if (id === requestId.current) setResults([]);
        });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [term]);

  function changeQuery(next: string) {
    setQuery(next);
    setNavigated(false);
    if (!next.trim()) {
      requestId.current++;
      setResults([]);
    }
  }

  function add(ref: TagRef, option?: TagOption) {
    const nextNames = option ? { ...names, [option.id]: option.name } : names;
    if (option) setKnown((k) => ({ ...k, [option.id]: option.name }));
    onChange(addTagRef(value, ref, nextNames, max));
    changeQuery("");
  }

  const termSlug = normalizeTagSlug(term);
  const exact = results.find((r) => normalizeTagSlug(r.name) === termSlug);
  const visible = term ? results : [];
  const canCreate = term.length >= 2 && termSlug !== "" && !exact;

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") setNavigated(true);
    if (e.key !== "Enter") return;
    // Enter nunca envia o formulário. Com seleção feita pelas setas, o cmdk escolhe o item.
    if (navigated && (visible.length > 0 || canCreate)) return;
    e.preventDefault();
    if (!term || full) return;
    if (exact) add({ id: exact.id }, exact);
    else if (canCreate) add({ name: term });
  }

  const labelFor = (ref: TagRef) => ("name" in ref ? ref.name : (names[ref.id] ?? "Tag"));

  return (
    <div className="space-y-2">
      <div aria-hidden="true" className="text-sm font-medium text-stone-800">
        {label} <span className="font-mono text-xs text-stone-500">{value.length}/{max}</span>
      </div>
      {value.length > 0 && (
        <ul aria-label={`Tags escolhidas: ${label}`} className="flex flex-wrap gap-1.5">
          {value.map((ref) => {
            const key = tagRefKey(ref);
            const name = labelFor(ref);
            return (
              <li
                key={key}
                className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-stone-100 py-0.5 pr-1 pl-2 font-mono text-xs text-stone-700"
              >
                {name}
                <button
                  type="button"
                  aria-label={`Remover ${name}`}
                  onClick={() => onChange(removeTagRef(value, key))}
                  className="rounded-sm p-0.5 text-stone-500 hover:bg-stone-200 hover:text-stone-900"
                >
                  <XIcon className="size-3" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <Command
        shouldFilter={false}
        label={label}
        className="rounded-lg! border border-stone-200 bg-white p-0"
      >
        <CommandInput
          value={query}
          onValueChange={changeQuery}
          onKeyDown={onKeyDown}
          disabled={full}
          placeholder={full ? `Limite de ${max} tags` : "Buscar ou criar tag"}
          aria-invalid={errors.length > 0 || undefined}
          aria-describedby={errors.length > 0 ? errorId : undefined}
        />
        {term && (visible.length > 0 || canCreate) && (
          <CommandList>
            <CommandGroup>
              {visible.map((r) => (
                <CommandItem key={r.id} value={`id:${r.id}`} onSelect={() => add({ id: r.id }, r)}>
                  <span className="font-mono text-xs">{r.name}</span>
                </CommandItem>
              ))}
              {canCreate && (
                <CommandItem value={`new:${termSlug}`} onSelect={() => add({ name: term })}>
                  Criar <span className="font-mono text-xs">“{term}”</span>
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        )}
      </Command>
      {errors.length > 0 && (
        <p id={errorId} className="text-sm text-red-700">
          {errors.join(" ")}
        </p>
      )}
    </div>
  );
}
