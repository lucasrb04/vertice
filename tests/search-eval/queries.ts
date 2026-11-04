import type { Category } from "./metrics";

export type EvalQuery = { q: string; category: Category; expected: string[] };

const q = (category: Category, text: string, expected: string[] = []): EvalQuery => ({ q: text, category, expected });

const R = ["robotica-competicao", "robotica-movel", "robotica-educacional"];
const ALG = ["algoritmos-grafos", "algoritmos-otimizacao", "programacao-competitiva"];
const IC = ["python-ic", "ic-fisica", "ic-quimica", "ic-visao", "pibic-distribuicao"];
const PROG = ["programacao-competitiva", "programacao-embarcada"];
const CAFE = ["cafe-ciencia", "cafe-qualidade"];
const ENG = ["eng-biomedica", "eng-fotovoltaica", "eng-aeronautica"];
const BAIRRO = [
  "robotica-educacional",
  "vizinho-solidario",
  "caminho-trilhas",
  "carinho-hospital",
  "horta-comunitaria",
  "oficinas-idosos",
  "inscricoes-secretaria",
  "acolhimento-familias",
];

export const queries: EvalQuery[] = [
  // exata
  q("exata", "casa", ["casa-inteligente", "acolhimento-familias"]),
  q("exata", "python", ["python-bolsa", "python-ic"]),
  q("exata", "robótica", R),
  q("exata", "robotica", R),
  q("exata", "algoritmos", ALG),
  q("exata", "café", CAFE),
  q("exata", "cafe", CAFE),
  q("exata", "engenharia", ENG),
  q("exata", "iniciação científica", IC),
  q("exata", "programação", PROG),
  q("exata", "vizinho", ["vizinho-solidario"]),
  q("exata", "caminho", ["caminho-trilhas"]),
  q("exata", "carinho", ["carinho-hospital"]),
  q("exata", "horta", ["horta-comunitaria"]),
  q("exata", "taurus", ["robotica-competicao", "programacao-embarcada"]),
  q("exata", "duarte", BAIRRO),
  q("exata", "carteira", ["inscricoes-secretaria"]),
  q("exata", "laboratório", ["inscricoes-secretaria", "eng-biomedica", "robotica-movel", "casa-inteligente"]),
  q("exata", "html/css", ["oficina-html", "portal-extensao"]),
  q("exata", "python,java", ["python-bolsa", "python-ic", "portal-extensao"]),
  // derivacao
  q("derivacao", "algoritmo", ALG),
  q("derivacao", "programar", PROG),
  q("derivacao", "bolsistas", ["robotica-movel", "estatistica", "casa-inteligente"]),
  q("derivacao", "monitores", ["programacao-competitiva", "horta-comunitaria", "energia-solar"]),
  q("derivacao", "desenvolvedores", ["jogos-educacionais"]),
  q("derivacao", "jogo", ["jogos-educacionais"]),
  q("derivacao", "bateria", ["baterias"]),
  q("derivacao", "fotovoltaicos", ["eng-fotovoltaica"]),
  q("derivacao", "trilha", ["caminho-trilhas"]),
  // erro
  q("erro", "pyhton", ["python-bolsa", "python-ic"]),
  q("erro", "bolsa pyhton", ["python-bolsa"]),
  q("erro", "robotcia", R),
  q("erro", "algoritimo", ALG),
  q("erro", "progamação", PROG),
  q("erro", "enginharia", ENG),
  q("erro", "inciação científica", IC),
  q("erro", "cafee", CAFE),
  q("erro", "biomédca", ["eng-biomedica"]),
  q("erro", "fotovoltaca", ["eng-fotovoltaica"]),
  q("erro", "estatitica", ["estatistica"]),
  q("erro", "redes nerais", ["python-ic"]),
  // diminutivo
  q("diminutivo", "casinha", ["casa-inteligente"]),
  q("diminutivo", "casinha inteligente", ["casa-inteligente"]),
  q("diminutivo", "cafezinho", CAFE),
  q("diminutivo", "cafezinho com ciência", ["cafe-ciencia"]),
  q("diminutivo", "hortinha", ["horta-comunitaria"]),
  // sinonimo
  q("sinonimo", "inteligência artificial", ["python-ic", "ic-visao"]),
  q("sinonimo", "domótica", ["casa-inteligente"]),
  q("sinonimo", "robôs", R),
  q("sinonimo", "painel solar", ["eng-fotovoltaica", "energia-solar"]),
  q("sinonimo", "avião", ["eng-aeronautica", "aero-cad", "aero-materiais"]),
  q("sinonimo", "internet das coisas", ["casa-inteligente"]),
  q("sinonimo", "coding", PROG),
  q("sinonimo", "ic", IC),
  q("sinonimo", "ics", IC),
  q("sinonimo", "ia", ["python-ic", "ic-visao"]),
  q("sinonimo", "ml", ["python-ic"]),
  q("sinonimo", "machine learning", ["python-ic"]),
  q("sinonimo", "machine-learning", ["python-ic"]),
  q("sinonimo", "remunerada", ["python-bolsa", "pibic-distribuicao"]),
  // zero (inclui palavra só de processo encerrado e só de processo em revisão)
  q("zero", "xadrez"),
  q("zero", "zzzzzz"),
  q("zero", "culinária"),
  q("zero", "futebol"),
  q("zero", "astrologia"),
  q("zero", "hieróglifos"),
  q("zero", "dermatologia"),
  q("zero", "colheita"),
  q("zero", "criptografia"),
  q("zero", "xqzwvk"),
  q("zero", "arte"),
  q("zero", "teatro"),
  q("zero", "cinema"),
];
