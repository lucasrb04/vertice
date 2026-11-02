export const INSTITUTION = {
  slug: "unifei-itajuba",
  name: "Universidade Federal de Itajubá — Campus Itajubá",
  shortName: "UNIFEI",
  allowedEmailDomains: ["unifei.edu.br"],
};

export const COURSES: { code: string; name: string; institute: string }[] = [
  { code: "CCO", name: "Ciência da Computação", institute: "IESTI" }, // TODO: revisar instituto
  { code: "ECO", name: "Engenharia de Computação", institute: "IESTI" }, // TODO: revisar instituto
  { code: "SIN", name: "Sistemas de Informação", institute: "IESTI" }, // TODO: revisar instituto
  { code: "EEL", name: "Engenharia Eletrônica", institute: "IESTI" }, // TODO: revisar instituto
  { code: "ECA", name: "Engenharia de Controle e Automação", institute: "IESTI" }, // TODO: revisar instituto
  { code: "ELT", name: "Engenharia Elétrica", institute: "IESTI" }, // TODO: revisar instituto
  { code: "ETEL", name: "Engenharia de Telecomunicações", institute: "IESTI" }, // TODO: revisar instituto
  { code: "EME", name: "Engenharia Mecânica", institute: "IMC" }, // TODO: revisar instituto
  { code: "EMA", name: "Engenharia Mecânica Aeronáutica", institute: "IMC" }, // TODO: revisar instituto
  { code: "EMAT", name: "Engenharia de Materiais", institute: "IMC" }, // TODO: revisar instituto
  { code: "EPR", name: "Engenharia de Produção", institute: "IEPG" }, // TODO: revisar instituto
  { code: "ADM", name: "Administração", institute: "IEPG" }, // TODO: revisar instituto
  { code: "EAM", name: "Engenharia Ambiental", institute: "IRN" }, // TODO: revisar instituto
  { code: "ECV", name: "Engenharia Civil", institute: "IRN" }, // TODO: revisar instituto
  { code: "EHD", name: "Engenharia Hídrica", institute: "IRN" }, // TODO: revisar instituto
  { code: "EQA", name: "Engenharia Química", institute: "IEI" }, // TODO: revisar instituto
  { code: "EBP", name: "Engenharia de Bioprocessos", institute: "IEI" }, // TODO: revisar instituto
  { code: "EEN", name: "Engenharia de Energia", institute: "IEI" }, // TODO: revisar instituto
  { code: "FIS", name: "Física", institute: "IFQ" }, // TODO: revisar instituto
  { code: "MAT", name: "Matemática", institute: "IMC" }, // TODO: revisar instituto
  { code: "QUI", name: "Química", institute: "IFQ" }, // TODO: revisar instituto
];

type SeedTag = { name: string; category: "AREA" | "SKILL" };

const areas = [
  "Inteligência Artificial", "Ciência de Dados", "Desenvolvimento Web", "Sistemas Embarcados",
  "Aeroespacial", "Automobilística", "Robótica", "Energias Renováveis", "Sustentabilidade",
  "Gestão de Projetos", "Finanças", "Automação Industrial", "Física Aplicada", "Biotecnologia",
];

const skills = [
  "Python", "TypeScript", "React", "C", "C++", "ROS", "SolidWorks", "AutoCAD", "MATLAB", "ANSYS",
  "Design de PCB", "Altium", "Impressão 3D", "Power BI", "Marketing Digital", "Gestão de Pessoas",
  "Redação Científica", "Inglês Técnico",
];

export const TAGS: SeedTag[] = [
  ...areas.map((name) => ({ name, category: "AREA" as const })),
  ...skills.map((name) => ({ name, category: "SKILL" as const })),
];

/** Sinônimos curados: quem partilha o canônico vale por todos do grupo. Sempre em minúsculas e sem acentos. */
export const SYNONYMS: { term: string; canonical: string }[] = [
  { term: "ic", canonical: "iniciacao cientifica" },
  { term: "ics", canonical: "iniciacao cientifica" },
  { term: "pibic", canonical: "iniciacao cientifica" },
  { term: "pivic", canonical: "iniciacao cientifica" },
  { term: "pibiti", canonical: "iniciacao cientifica" },
  { term: "ia", canonical: "inteligencia artificial" },
  { term: "ml", canonical: "aprendizado de maquina" },
  { term: "machine learning", canonical: "aprendizado de maquina" },
  { term: "remunerada", canonical: "bolsa" },
  { term: "engenheiro", canonical: "engenharia" },
  { term: "robo", canonical: "robotica" },
  { term: "programador", canonical: "programacao" },
  { term: "empresa jr", canonical: "empresa junior" },
  { term: "domotica", canonical: "casa inteligente" },
  { term: "aviao", canonical: "aeronautica" },
  { term: "internet das coisas", canonical: "iot" },
  { term: "coding", canonical: "programacao" },
];
