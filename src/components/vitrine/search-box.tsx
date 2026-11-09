"use client";

import { Search } from "lucide-react";
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
  const wrapperProps = embedded ? { role: "search" } : { action: "/", method: "get", role: "search" };

  return (
    <Wrapper {...wrapperProps} className="flex gap-2.5">
      <div className="relative min-w-0 flex-1">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-2"
        />
        <Input
          ref={inputRef}
          type="search"
          name="q"
          defaultValue={defaultValue}
          maxLength={100}
          enterKeyHint="search"
          aria-label="Buscar processos"
          placeholder="Busque por tema, projeto ou habilidade"
          className="h-[54px] rounded-[14px] border-transparent pr-12 pl-12 text-[1.02rem] shadow-card hover:border-transparent focus-visible:border-ink [&::-webkit-search-cancel-button]:hidden"
        />
        {autoFocusShortcut && (
          <kbd
            aria-hidden
            className="pointer-events-none absolute top-1/2 right-4 hidden -translate-y-1/2 rounded-md border border-line bg-surface-2 px-1.5 text-xs text-ink-3 sm:block"
          >
            /
          </kbd>
        )}
      </div>
      <Button type="submit" size="lg" className="h-[54px] rounded-[14px] px-5 max-sm:hidden">
        Buscar
      </Button>
    </Wrapper>
  );
}
