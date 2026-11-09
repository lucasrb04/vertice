import { z } from "zod";
import type { PanelOpportunity } from "./queries";

export type PublishNotice = { kind: "published" | "updated"; opportunity: PanelOpportunity };

type NoticeParams = { publicado?: string | string[]; atualizado?: string | string[] };

const uuid = z.string().uuid();
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * Aviso no painel depois de publicar (`?publicado=<id>`) ou editar (`?atualizado=<id>`) um processo.
 * O id vem da URL: só vale se for um processo visível deste projeto, e nada da URL é mostrado.
 * "Publicado" exige o processo aberto, porque o aviso entrega o link para divulgar.
 */
export function pickPublishNotice(
  params: NoticeParams,
  panel: { open: PanelOpportunity[]; closed: PanelOpportunity[] },
  canEdit: boolean,
): PublishNotice | null {
  if (!canEdit) return null;
  const published = uuid.safeParse(first(params.publicado));
  if (published.success) {
    const opportunity = panel.open.find((o) => o.id === published.data && !o.hidden);
    return opportunity ? { kind: "published", opportunity } : null;
  }
  const updated = uuid.safeParse(first(params.atualizado));
  if (updated.success) {
    const opportunity = [...panel.open, ...panel.closed].find((o) => o.id === updated.data && !o.hidden);
    return opportunity ? { kind: "updated", opportunity } : null;
  }
  return null;
}
