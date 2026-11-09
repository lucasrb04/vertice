export type ProjectStats = {
  openOpportunities: number;
  inProgressApplications: number;
  views: number;
  externalClicks: number;
};

const number = new Intl.NumberFormat("pt-BR");

function countLabel(n: number, singular: string, plural: string): string {
  return `${number.format(n)} ${n === 1 ? singular : plural}`;
}

/**
 * Números acumulados desde a publicação; a interface junta as partes com " · ". `externalClicks` nulo (processo
 * sem edital) omite os cliques.
 */
export function opportunityStatsParts(s: { views: number; externalClicks: number | null }): string[] {
  const parts = [countLabel(s.views, "visualização", "visualizações")];
  if (s.externalClicks !== null) parts.push(countLabel(s.externalClicks, "clique no edital", "cliques no edital"));
  return parts;
}

export function projectStatsParts(s: ProjectStats): string[] {
  return [
    countLabel(s.openOpportunities, "processo aberto", "processos abertos"),
    countLabel(s.inProgressApplications, "candidato em andamento", "candidatos em andamento"),
    ...opportunityStatsParts(s),
  ];
}
