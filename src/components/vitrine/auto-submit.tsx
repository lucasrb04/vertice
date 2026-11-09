"use client";

import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";

/**
 * Aplica os filtros ao mudar um campo, navegando sem recarregar a página: foco e o `<details>`
 * ficam como estão. Sem JS o formulário segue funcionando pelos botões; com JS marca o formulário
 * (`data-js`) para esconder o botão "Aplicar".
 */
export function AutoSubmit({ formId }: { formId: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  useEffect(() => {
    const el = document.getElementById(formId);
    if (!(el instanceof HTMLFormElement)) return;
    const form: HTMLFormElement = el;
    form.dataset.js = "1";

    function apply() {
      const query = new URLSearchParams();
      for (const [key, value] of new FormData(form)) {
        if (typeof value === "string" && value !== "") query.append(key, value);
      }
      // Uma busca nova volta a corrigir: `corrigir=0` vale só para o texto que o usuário já viu.
      const q = form.elements.namedItem("q");
      if (q instanceof HTMLInputElement && q.value !== q.defaultValue) query.delete("corrigir");
      const qs = query.toString();
      startTransition(() => router.replace(qs ? `/?${qs}` : "/", { scroll: false }));
    }
    function onChange(e: Event) {
      // O campo de busca envia pelo Enter ou pelo botão; `change` dispararia ao perder o foco.
      if (e.target instanceof HTMLInputElement && e.target.type === "search") return;
      apply();
    }
    function onSubmit(e: SubmitEvent) {
      e.preventDefault();
      apply();
    }
    form.addEventListener("change", onChange);
    form.addEventListener("submit", onSubmit);
    return () => {
      form.removeEventListener("change", onChange);
      form.removeEventListener("submit", onSubmit);
      delete form.dataset.js;
    };
  }, [formId, router]);
  return null;
}
