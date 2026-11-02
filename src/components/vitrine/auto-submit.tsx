"use client";

import { useEffect } from "react";

/**
 * Aplica os filtros ao mudar um campo. Sem JS o formulário segue funcionando pelos botões;
 * com JS marca o formulário (`data-js`) para esconder o botão "Aplicar".
 */
export function AutoSubmit({ formId }: { formId: string }) {
  useEffect(() => {
    const el = document.getElementById(formId);
    if (!(el instanceof HTMLFormElement)) return;
    const form: HTMLFormElement = el;
    form.dataset.js = "1";
    function onChange(e: Event) {
      // O campo de busca envia pelo Enter ou pelo botão; `change` dispararia ao perder o foco.
      if (e.target instanceof HTMLInputElement && e.target.type === "search") return;
      form.requestSubmit();
    }
    form.addEventListener("change", onChange);
    return () => {
      form.removeEventListener("change", onChange);
      delete form.dataset.js;
    };
  }, [formId]);
  return null;
}
