"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** Formulário GET comum: funciona sem JavaScript; só o atalho `/` depende dele. */
export function SearchBox({
  defaultValue,
  autoFocusShortcut = false,
  embedded = false,
}: {
  defaultValue?: string;
  autoFocusShortcut?: boolean;
  /** Dentro de outro formulário GET: renderiza só os campos, sem `<form>` próprio. */
  embedded?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!autoFocusShortcut) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      inputRef.current?.focus();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [autoFocusShortcut]);

  const Wrapper = embedded ? "div" : "form";
  const wrapperProps = embedded ? { role: "search" } : { action: "/processos", method: "get", role: "search" };

  return (
    <Wrapper {...wrapperProps} className="flex flex-col gap-2 sm:flex-row">
      <div className="relative min-w-0 flex-1">
        <Input
          ref={inputRef}
          type="search"
          name="q"
          defaultValue={defaultValue}
          maxLength={100}
          enterKeyHint="search"
          aria-label="Buscar processos"
          placeholder="Busque por projeto, área ou habilidade"
          className="h-11 bg-white pr-10 pl-3 placeholder:text-sm placeholder:text-stone-500"
        />
        {autoFocusShortcut && (
          <kbd
            aria-hidden
            className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded border border-stone-200 bg-stone-50 px-1.5 tabular-nums text-xs text-stone-500 sm:block"
          >
            /
          </kbd>
        )}
      </div>
      <Button type="submit" className="h-11 px-5">
        Buscar
      </Button>
    </Wrapper>
  );
}
