import Link from "next/link";
import { OpportunityCard } from "@/components/vitrine/opportunity-card";
import { Carousel } from "@/components/vitrine/carousel";
import type { PublicCard } from "@/lib/public/queries";

/** Lista vazia não aparece (spec §5.2). */
export function HomeRow({ title, href, cards }: { title: string; href: string; cards: PublicCard[] }) {
  if (cards.length === 0) return null;
  return (
    <Carousel
      label={title}
      header={
        <div className="flex items-baseline gap-3">
          <h2 className="truncate text-base font-semibold tracking-[-0.01em] text-stone-900 [word-spacing:0.06em] sm:text-lg">{title}</h2>
          <Link
            href={href}
            aria-label={`Ver todos: ${title}`}
            className="shrink-0 text-sm text-stone-600 underline-offset-4 hover:text-brand hover:underline"
          >
            Ver todos
          </Link>
        </div>
      }
    >
      {cards.map((card) => (
        <OpportunityCard key={card.slug} card={card} />
      ))}
    </Carousel>
  );
}
