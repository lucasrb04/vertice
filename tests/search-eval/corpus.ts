/** Corpus fictício e fixo da avaliação de busca (spec §5.6). Nenhum dado real. */

export type EvalProject = {
  key: string;
  name: string;
  acronym?: string;
  advisorName?: string;
  category: "SPECIAL_PROJECT" | "SCIENTIFIC_INIT" | "EXTENSION" | "JUNIOR_ENTERPRISE" | "PET" | "LAB_GROUP" | "OTHER";
};

export type EvalProcess = {
  slug: string;
  project: string;
  title: string;
  roleArea?: string;
  description: string;
  tags: string[];
  /** `open` (padrão), `closed` (prazo vencido) ou `hidden` (em revisão, nunca público). */
  state?: "open" | "closed" | "hidden";
};

export const projects: EvalProject[] = [
  { key: "lar", name: "Laboratório de Automação Residencial", acronym: "LAR", advisorName: "Prof. Henrique Albuquerque", category: "LAB_GROUP" },
  { key: "taurus", name: "Equipe Taurus", acronym: "TAURUS", advisorName: "Profa. Marta Siqueira", category: "SPECIAL_PROJECT" },
  { key: "gea", name: "Grupo de Estudos em Computação", acronym: "GEC", advisorName: "Prof. Ricardo Telles", category: "PET" },
  { key: "dados", name: "Núcleo de Ciência de Dados", acronym: "NCD", advisorName: "Profa. Beatriz Nogueira", category: "LAB_GROUP" },
  { key: "cafe", name: "Café com Ciência", advisorName: "Profa. Lúcia Fontes", category: "EXTENSION" },
  { key: "bio", name: "Laboratório de Instrumentação Biomédica", acronym: "LIB", advisorName: "Prof. Otávio Mendes", category: "LAB_GROUP" },
  { key: "ic", name: "Programa Institucional de Pesquisa", acronym: "PIP", advisorName: "Prof. Sérgio Vilela", category: "SCIENTIFIC_INIT" },
  { key: "bairro", name: "Ação Comunitária Sul de Minas", acronym: "ACSM", advisorName: "Profa. Helena Duarte", category: "EXTENSION" },
  { key: "aero", name: "Aerodesign Itajubá", acronym: "AERO", advisorName: "Prof. Fernando Coutinho", category: "SPECIAL_PROJECT" },
  { key: "energia", name: "Núcleo de Energias Renováveis", acronym: "NER", advisorName: "Prof. Gustavo Prado", category: "LAB_GROUP" },
  { key: "gestao", name: "Consultoria Júnior Vale", acronym: "CJV", advisorName: "Prof. André Moraes", category: "JUNIOR_ENTERPRISE" },
  { key: "tec", name: "Coletivo de Tecnologia Aberta", acronym: "COTA", advisorName: "Profa. Renata Queiroz", category: "OTHER" },
];

export const corpus: EvalProcess[] = [
  { slug: "casa-inteligente", project: "lar", title: "Bolsista em Casa Inteligente", roleArea: "Automação", description: "Sensores e controle de iluminação para ambientes residenciais.", tags: ["IoT", "Automação"] },
  { slug: "estudo-de-caso-gestao", project: "gestao", title: "Estudo de caso em gestão de projetos", roleArea: "Gestão", description: "Análise de empresas juniores da região.", tags: ["Gestão"] },
  { slug: "python-bolsa", project: "dados", title: "Bolsa de Python para análise de dados", roleArea: "Ciência de Dados", description: "Limpeza e modelagem de bases públicas.", tags: ["Python", "Dados"] },
  { slug: "python-ic", project: "ic", title: "Iniciação científica em aprendizado de máquina", roleArea: "Inteligência artificial", description: "Treino de redes neurais em linguagem Python.", tags: ["Python", "Aprendizado de máquina"] },
  { slug: "programacao-competitiva", project: "gea", title: "Monitor de programação competitiva", roleArea: "Treinamento", description: "Preparação de equipes para maratonas.", tags: ["Programação", "Algoritmos"] },
  { slug: "programacao-embarcada", project: "taurus", title: "Programação de sistemas embarcados", roleArea: "Eletrônica", description: "Firmware para microcontroladores do veículo.", tags: ["Embarcados", "C"] },
  { slug: "algoritmos-grafos", project: "gea", title: "Pesquisa em algoritmos de grafos", roleArea: "Teoria da computação", description: "Caminhos mínimos e fluxo em redes.", tags: ["Algoritmos", "Grafos"] },
  { slug: "algoritmos-otimizacao", project: "energia", title: "Algoritmos genéticos para otimização", roleArea: "Otimização", description: "Dimensionamento de usinas por busca evolutiva.", tags: ["Algoritmos", "Otimização"] },
  { slug: "robotica-competicao", project: "taurus", title: "Membro da equipe de robótica de competição", roleArea: "Mecatrônica", description: "Projeto e montagem do robô para torneios nacionais.", tags: ["Robótica", "Mecatrônica"] },
  { slug: "robotica-movel", project: "lar", title: "Bolsista de robótica móvel", roleArea: "Navegação", description: "Mapeamento e controle de robôs de serviço.", tags: ["Robótica", "ROS"] },
  { slug: "robotica-educacional", project: "bairro", title: "Oficineiro de robótica educacional", roleArea: "Ensino", description: "Oficinas em escolas públicas de Itajubá.", tags: ["Robótica", "Educação"] },
  { slug: "cafe-ciencia", project: "cafe", title: "Divulgador do Café com Ciência", roleArea: "Divulgação científica", description: "Conversas abertas entre pesquisadores e público.", tags: ["Divulgação", "Café"] },
  { slug: "cafe-qualidade", project: "energia", title: "Pesquisa em qualidade do café", roleArea: "Agroindústria", description: "Secagem e armazenamento de grãos da região.", tags: ["Café", "Agroindústria"] },
  { slug: "eng-biomedica", project: "bio", title: "Estágio em engenharia biomédica", roleArea: "Instrumentação", description: "Calibração de equipamentos hospitalares.", tags: ["Biomédica", "Instrumentação"] },
  { slug: "eng-fotovoltaica", project: "energia", title: "Engenharia de sistemas fotovoltaicos", roleArea: "Energia", description: "Projeto de microgeração para o campus.", tags: ["Fotovoltaica", "Energia solar"] },
  { slug: "eng-aeronautica", project: "aero", title: "Engenharia estrutural da aeronave", roleArea: "Estruturas", description: "Cálculo de longarinas e nervuras.", tags: ["Estruturas", "Aeronáutica"] },
  { slug: "ic-fisica", project: "ic", title: "Iniciação científica em física de materiais", roleArea: "Física", description: "Caracterização de filmes finos.", tags: ["Física", "Materiais"] },
  { slug: "ic-quimica", project: "ic", title: "Iniciação científica em química ambiental", roleArea: "Química", description: "Análise de águas de nascentes.", tags: ["Química", "Meio ambiente"] },
  { slug: "ic-visao", project: "ic", title: "Iniciação científica em visão computacional", roleArea: "Visão computacional", description: "Detecção de objetos em imagens aéreas.", tags: ["Visão computacional", "Inteligência artificial"] },
  { slug: "vizinho-solidario", project: "bairro", title: "Vizinho Solidário: apoio a famílias do bairro", roleArea: "Assistência", description: "Visitas e cadastro de necessidades locais.", tags: ["Assistência social"] },
  { slug: "caminho-trilhas", project: "bairro", title: "Mapeamento de caminho e trilhas ecológicas", roleArea: "Meio ambiente", description: "Levantamento de percursos na serra.", tags: ["Meio ambiente", "Mapeamento"] },
  { slug: "carinho-hospital", project: "bairro", title: "Voluntário de leitura e carinho no hospital", roleArea: "Voluntariado", description: "Contação de histórias para crianças internadas.", tags: ["Saúde", "Leitura"] },
  { slug: "horta-comunitaria", project: "bairro", title: "Monitor da horta comunitária", roleArea: "Agroecologia", description: "Manejo de canteiros e oficinas de compostagem.", tags: ["Agroecologia", "Horta"] },
  { slug: "dados-abertos", project: "dados", title: "Visualização de dados abertos municipais", roleArea: "Visualização", description: "Painéis sobre transporte e saúde.", tags: ["Dados", "Visualização"] },
  { slug: "estatistica", project: "dados", title: "Bolsista de estatística aplicada", roleArea: "Estatística", description: "Planejamento de experimentos e testes.", tags: ["Estatística"] },
  { slug: "aero-cad", project: "aero", title: "Modelagem CAD de asas", roleArea: "Projeto", description: "Superfícies e perfis aerodinâmicos.", tags: ["CAD", "Aerodinâmica"] },
  { slug: "aero-materiais", project: "aero", title: "Materiais compostos leves", roleArea: "Fabricação", description: "Laminação de fibra de carbono.", tags: ["Compósitos", "Aeronáutica"] },
  { slug: "energia-solar", project: "energia", title: "Monitor de energia solar", roleArea: "Energia", description: "Acompanhamento da usina didática.", tags: ["Energia solar"] },
  { slug: "baterias", project: "energia", title: "Pesquisa em baterias de lítio", roleArea: "Armazenamento", description: "Ensaios de carga e descarga.", tags: ["Baterias", "Armazenamento"] },
  { slug: "oficinas-idosos", project: "bairro", title: "Oficinas de informática para idosos", roleArea: "Inclusão digital", description: "Uso de celular e serviços públicos online.", tags: ["Inclusão digital"] },
  { slug: "jogos-educacionais", project: "tec", title: "Desenvolvedor de jogos educacionais", roleArea: "Jogos", description: "Protótipos para ensino de matemática.", tags: ["Jogos", "Educação"] },
  { slug: "web-react", project: "tec", title: "Desenvolvimento web com React", roleArea: "Interfaces", description: "Painéis para projetos de extensão.", tags: ["Web", "JavaScript"] },
  { slug: "redes-servidores", project: "tec", title: "Infraestrutura de redes e servidores", roleArea: "Infraestrutura", description: "Administração de máquinas virtuais.", tags: ["Redes", "Linux"] },
  { slug: "comunicacao-design", project: "cafe", title: "Design para divulgação científica", roleArea: "Design", description: "Cartazes e vídeos curtos.", tags: ["Design", "Comunicação"] },
  // Ruído: processos que a busca pública não pode devolver.
  { slug: "python-lab-encerrado", project: "dados", title: "Python para automação de laboratório", roleArea: "Automação", description: "Processo já encerrado.", tags: ["Python"], state: "closed" },
  { slug: "colheita-encerrada", project: "cafe", title: "Auxiliar de colheita", roleArea: "Campo", description: "Processo já encerrado.", tags: ["Campo"], state: "closed" },
  { slug: "criptografia-oculta", project: "gea", title: "Criptografia quântica", roleArea: "Segurança", description: "Aguardando revisão.", tags: ["Segurança"], state: "hidden" },
];
