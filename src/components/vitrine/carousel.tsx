"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SCROLL_FRACTION = 0.85;

/**
 * Rolagem nativa: sem JS continua rolável por toque, trackpad, barra e teclado.
 * Os botões só aparecem depois de medir que há o que rolar.
 */
export function Carousel({
  label,
  header,
  children,
}: {
  label: string;
  header?: ReactNode;
  children: ReactNode;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const prevRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const [can, setCan] = useState({ prev: false, next: false });

  const measure = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCan({
      prev: el.scrollLeft > 1,
      next: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
    });
  }, []);

  // Botão desabilitado perde o foco: leva o foco ao botão oposto para o teclado não se perder.
  useEffect(() => {
    const active = document.activeElement;
    if (!can.prev && active === prevRef.current && can.next) nextRef.current?.focus();
    else if (!can.next && active === nextRef.current && can.prev) prevRef.current?.focus();
  }, [can]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    // O observer dispara já na primeira observação, fazendo a medição inicial.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure]);

  function scroll(direction: 1 | -1) {
    const el = scrollerRef.current;
    if (!el) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({
      left: direction * el.clientWidth * SCROLL_FRACTION,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">{header}</div>
        <div className={cn("flex shrink-0 gap-1", !can.prev && !can.next && "invisible")}>
          <Button
            ref={prevRef}
            type="button"
            variant="outline"
            size="icon"
            className="bg-white"
            aria-label={`Ver anteriores em ${label}`}
            disabled={!can.prev}
            onClick={() => scroll(-1)}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <Button
            ref={nextRef}
            type="button"
            variant="outline"
            size="icon"
            className="bg-white"
            aria-label={`Ver próximos em ${label}`}
            disabled={!can.next}
            onClick={() => scroll(1)}
          >
            <ChevronRight aria-hidden />
          </Button>
        </div>
      </div>
      {/* Margens negativas: no celular o card seguinte encosta na borda da tela e o foco não é cortado. */}
      <div
        ref={scrollerRef}
        role="region"
        aria-label={label}
        tabIndex={0}
        onScroll={measure}
        className="-mx-4 mt-3 snap-x snap-mandatory scroll-px-4 overflow-x-auto px-4 py-1 outline-none [scrollbar-color:#d6d3d1_transparent] [scrollbar-width:thin] focus-visible:ring-3 focus-visible:ring-ring/50 lg:-mx-1 lg:scroll-px-1 lg:px-1"
      >
        <ul className="flex gap-4 pb-2">
          {Children.toArray(children).map((child, i) => (
            <li key={i} className="flex w-70 shrink-0 snap-start">
              {child}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
