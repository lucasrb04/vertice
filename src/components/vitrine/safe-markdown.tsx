import type { ComponentProps } from "react";
import Markdown from "react-markdown";
import { isHttps } from "@/lib/validation/common";

const ALLOWED = ["p", "strong", "em", "ul", "ol", "li", "a", "br", "img"];

const httpsOnly = (url: string) => (isHttps(url) ? url : "");

function SafeLink({ href, children }: ComponentProps<"a">) {
  if (!href) return <>{children}</>;
  return (
    <a
      href={href}
      target="_blank"
      rel="nofollow noopener noreferrer"
      className="font-semibold text-ink underline underline-offset-4"
    >
      {children}
    </a>
  );
}

// `img` só entra na lista para virar o texto alternativo: sem ela o `alt` se perderia.
const COMPONENTS = {
  a: SafeLink,
  img: ({ alt }: ComponentProps<"img">) => <>{alt}</>,
};

/**
 * Markdown restrito (spec §5.8), sem HTML. Revalida aqui o que o Zod já barrou na escrita: o texto
 * pode ser anterior à regra. Elementos fora da lista perdem a tag e mantêm o texto.
 */
export function SafeMarkdown({ source }: { source: string }) {
  return (
    <div className="space-y-3.5 text-[1.02rem] leading-relaxed [overflow-wrap:anywhere] text-stone-700 [&_h1]:mt-6 [&_h1]:text-[1.2rem] [&_h1]:font-bold [&_h1]:text-ink [&_h2]:mt-6 [&_h2]:text-[1.2rem] [&_h2]:font-bold [&_h2]:text-ink [&_h3]:mt-5 [&_h3]:text-[1.05rem] [&_h3]:font-bold [&_h3]:text-ink [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5 [&_strong]:font-semibold [&_strong]:text-stone-900 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
      <Markdown allowedElements={ALLOWED} unwrapDisallowed urlTransform={httpsOnly} components={COMPONENTS}>
        {source}
      </Markdown>
    </div>
  );
}
