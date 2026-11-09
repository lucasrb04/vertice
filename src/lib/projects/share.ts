import { deadlineLabel } from "./labels";

/** URL pública de um processo, para o organizador divulgar. */
export function processPublicUrl(appUrl: string, slug: string): string {
  return `${appUrl.replace(/\/+$/, "")}/processo/${slug}`;
}

/** Texto pronto para colar em grupos e redes: o que é, de quem, até quando e onde se inscrever. */
export function shareMessage(p: { title: string; projectName: string; deadlineAt: Date; url: string }): string {
  return [
    `Processo seletivo aberto: ${p.title} (${p.projectName}).`,
    `${deadlineLabel(p.deadlineAt)}.`,
    `Detalhes e inscrição: ${p.url}`,
  ].join("\n");
}
