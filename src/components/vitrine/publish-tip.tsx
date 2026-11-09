"use client";

import { Megaphone, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PUBLISH_TIP_COOKIE } from "@/lib/public/publish-tip";

/** Dica para quem publica. Fechar grava um cookie: o servidor deixa de renderizá-la, sem piscar. */
export function PublishTip() {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <section
      aria-labelledby="dica-publicar"
      className="relative rounded-2xl bg-ipe-soft py-4 pr-12 pl-4 sm:py-5 sm:pr-14 sm:pl-[22px]"
    >
      <h2
        id="dica-publicar"
        className="flex items-center gap-2.5 font-sans text-[1.05rem] font-semibold tracking-normal"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-surface">
          <Megaphone aria-hidden className="size-[18px]" />
        </span>
        Lidera uma equipe, laboratório ou projeto?
      </h2>
      <p className="mt-2 mb-3.5 max-w-[70ch] text-[0.96rem] text-ink-2 sm:text-base">
        Publique o processo seletivo em poucos minutos e receba o link pronto para divulgar. Qualquer conta
        @unifei.edu.br publica, sem aprovação prévia.
      </p>
      <Button asChild>
        <Link href="/publicar">Publicar processo</Link>
      </Button>
      <button
        type="button"
        aria-label="Fechar dica"
        onClick={() => {
          // biome-ignore lint/suspicious/noDocumentCookie: cookie simples de preferência, lido pelo servidor.
          document.cookie = `${PUBLISH_TIP_COOKIE}=0; path=/; max-age=31536000; samesite=lax`;
          setHidden(true);
        }}
        className="absolute top-3 right-3 rounded-lg p-1.5 hover:bg-[#f8e6b4] sm:top-3.5 sm:right-3.5"
      >
        <X aria-hidden className="size-5" />
      </button>
    </section>
  );
}
