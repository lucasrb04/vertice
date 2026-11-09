"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const DESKTOP = "(min-width: 1100px)";

type SheetState = {
  open: boolean;
  setOpen: (open: boolean) => void;
  titleId: string;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
};
const SheetContext = createContext<SheetState | null>(null);

function useSheet(): SheetState {
  const ctx = useContext(SheetContext);
  if (!ctx) throw new Error("FilterSheet fora do FilterSheetProvider");
  return ctx;
}

/** Estado da folha de filtros do celular, compartilhado entre o botão da barra e o painel. */
export function FilterSheetProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  return <SheetContext.Provider value={{ open, setOpen, titleId, triggerRef }}>{children}</SheetContext.Provider>;
}

/** Botão "Filtros" da barra; só aparece abaixo de 1100px e com JavaScript. */
export function FilterSheetTrigger({ activeCount }: { activeCount: number }) {
  const { open, setOpen, triggerRef } = useSheet();
  return (
    <button
      ref={triggerRef}
      type="button"
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={() => setOpen(true)}
      className="hidden h-11 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-[0.95rem] font-bold shadow-card hover:border-line-strong max-[1099px]:scripting:inline-flex"
    >
      <SlidersHorizontal aria-hidden className="size-[18px]" />
      Filtros
      {activeCount > 0 && (
        <span className="min-w-[26px] rounded-[7px] bg-ink px-1.5 text-center text-[0.82rem] text-white tabular-nums">
          {activeCount}
          <span className="sr-only"> ativos</span>
        </span>
      )}
    </button>
  );
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select, textarea, summary';

/**
 * Painel de filtros. No desktop é a coluna da esquerda; abaixo de 1100px, com JavaScript, vira uma folha
 * que sobe de baixo, modal: foco dentro, Esc fecha, o foco volta ao botão. Os campos continuam no mesmo
 * formulário GET, então o `AutoSubmit` segue funcionando dentro da folha.
 */
export function FilterSheetPanel({ children, footer }: { children: ReactNode; footer: ReactNode }) {
  const { open, setOpen, titleId, triggerRef } = useSheet();
  const panelRef = useRef<HTMLDivElement>(null);
  const [modal, setModal] = useState(false);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, [setOpen, triggerRef]);

  // Modal só no celular: no desktop, abrir não faz sentido e a folha volta a ser coluna.
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP);
    const sync = () => {
      if (mq.matches) setOpen(false);
      setModal(open && !mq.matches);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [open, setOpen]);

  useEffect(() => {
    if (!modal) return;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      const first = items[0];
      const last = items.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [modal, close]);

  return (
    <>
      <div
        aria-hidden="true"
        onClick={close}
        className={cn(
          "fixed inset-0 z-40 bg-ink/35 transition-opacity duration-200 min-[1100px]:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      {/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: o papel muda entre complementary (desktop) e dialog (folha). */}
      <div
        ref={panelRef}
        aria-labelledby={titleId}
        role={modal ? "dialog" : "complementary"}
        aria-modal={modal || undefined}
        data-open={open}
        className={cn(
          "flex min-w-0 flex-col rounded-2xl bg-surface shadow-card",
          "min-[1100px]:sticky min-[1100px]:top-5 min-[1100px]:max-h-[calc(100dvh-2.5rem)]",
          // Celular com JavaScript: folha que sobe de baixo, escondida (e fora do Tab) quando fechada.
          "max-[1099px]:scripting:fixed max-[1099px]:scripting:inset-x-0 max-[1099px]:scripting:bottom-0 max-[1099px]:scripting:z-50 max-[1099px]:scripting:max-h-[88dvh] max-[1099px]:scripting:rounded-b-none max-[1099px]:scripting:rounded-t-[20px]",
          "max-[1099px]:scripting:invisible max-[1099px]:scripting:translate-y-[105%] max-[1099px]:scripting:transition-[transform,visibility] max-[1099px]:scripting:duration-300 max-[1099px]:scripting:ease-[cubic-bezier(.16,1,.3,1)]",
          "max-[1099px]:scripting:data-[open=true]:visible max-[1099px]:scripting:data-[open=true]:translate-y-0 motion-reduce:transition-none",
        )}
      >
        <SheetTitleContext.Provider value={{ titleId, close }}>
          {children}
          <div className="hidden border-t border-line px-4 pt-3 pb-4 max-[1099px]:scripting:block">{footer}</div>
        </SheetTitleContext.Provider>
      </div>
    </>
  );
}

const SheetTitleContext = createContext<{ titleId: string; close: () => void } | null>(null);

/** Cabeçalho do painel: título (rótulo do diálogo), "Limpar tudo" e, na folha, o botão de fechar. */
export function FilterSheetHeader({ clearHref }: { clearHref: string | null }) {
  const ctx = useContext(SheetTitleContext);
  if (!ctx) throw new Error("FilterSheetHeader fora do FilterSheetPanel");
  return (
    <div className="flex items-center gap-3 border-b border-line px-5 py-4">
      <h2 id={ctx.titleId} className="text-[1.15rem] font-bold">
        Filtros
      </h2>
      {clearHref && (
        // <a> comum: recarrega e zera os campos não controlados do formulário.
        <a href={clearHref} className="ml-auto text-[0.95rem] font-semibold text-ink underline underline-offset-4">
          Limpar tudo
        </a>
      )}
      <button
        type="button"
        onClick={ctx.close}
        aria-label="Fechar filtros"
        className={cn(
          "hidden rounded-lg p-1.5 hover:bg-fact max-[1099px]:scripting:inline-flex",
          !clearHref && "ml-auto",
        )}
      >
        <X aria-hidden className="size-5" />
      </button>
    </div>
  );
}

/** Botão do rodapé da folha: fecha e mostra a lista já filtrada. */
export function FilterSheetDone({ total }: { total: number }) {
  const ctx = useContext(SheetTitleContext);
  return (
    <button
      type="button"
      onClick={ctx?.close}
      className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-ink px-4 text-base font-bold text-white hover:bg-stone-800"
    >
      {total === 0 ? "Nenhum processo" : total === 1 ? "Ver 1 processo" : `Ver ${total} processos`}
    </button>
  );
}
