# Busca inteligente em português: técnicas nativas do PostgreSQL 16 (pg_trgm, fuzzystrmatch, FTS, ts_stat)

## 1. Como tolerar typos ("pyhton", "progamação") com pg_trgm / fuzzystrmatch; thresholds para palavras curtas; falsos positivos (casa/caso)

### Takeaway
pg_trgm tolera omissão de letra bem (similaridade alta), mas transposição em palavra curta cai abaixo do limiar padrão 0,3. levenshtein não conta transposição como 1 edição (custo 2). Palavras curtas exigem limiar baixo ou verificação por edit distance, ao custo de falsos positivos como casa/caso.

### Cited Findings
- Definição de trigrama e preenchimento: pg_trgm ignora não alfanuméricos; cada palavra recebe 2 espaços de prefixo e 1 de sufixo ("cat" -> "  c", " ca", "cat", "at "). — [PG16 pg_trgm](https://www.postgresql.org/docs/16/pgtrgm.html)
- Limiares padrão: `pg_trgm.similarity_threshold`=0,3 (operador `%`), `word_similarity_threshold`=0,6 (`<%`, `%>`), `strict_word_similarity_threshold`=0,5 (`<<%`, `%>>`). `set_limit()`/`show_limit()` são obsoletos. — [PG16 pg_trgm](https://www.postgresql.org/docs/16/pgtrgm.html)
- `word_similarity(a,b)`: maior similaridade entre o conjunto de trigramas de `a` e qualquer extensão contígua de trigramas ordenados de `b` (sem preenchimento nas bordas da extensão). `strict_word_similarity`: igual, mas a extensão deve coincidir com fronteiras de palavra. Exemplo oficial: word_similarity('word','two words')=0,8; strict_word_similarity('word','two words')=0,571429=similarity('word','words'). Doc: usar strict para palavra inteira, word para partes de palavra. — [PG16 pg_trgm](https://www.postgresql.org/docs/16/pgtrgm.html)
- Comparações de similaridade são case-insensitive em build padrão; a página NÃO discute acentos/locale. — [PG16 pg_trgm](https://www.postgresql.org/docs/16/pgtrgm.html)
- Operadores de distância: `<->` (1-similarity), `<<->`/`<->>` (1-word_similarity), `<<<->`/`<->>>` (1-strict). — [PG16 pg_trgm](https://www.postgresql.org/docs/16/pgtrgm.html)
- levenshtein(source,target[,ins,del,sub]) e levenshtein_less_equal(...,max_d): máximo de 255 caracteres; less_equal retorna distância correta se <= max_d, senão algum valor > max_d (mais rápido). Exemplos: levenshtein('GUMBO','GAMBOL')=2; com custos (2,1,1)=3. — [PG16 fuzzystrmatch](https://www.postgresql.org/docs/16/fuzzystrmatch.html)
- A doc lista só inserção, remoção e substituição (sem transposição Damerau). Inferência: 'ab'->'ba' custa 2. — [PG16 fuzzystrmatch](https://www.postgresql.org/docs/16/fuzzystrmatch.html)
- soundex/metaphone/dmetaphone "não funcionam bem com codificações multibyte (ex.: UTF-8)"; usar daitch_mokotoff ou levenshtein. Soundex "não é muito útil para nomes não ingleses". Logo, fonéticos não servem para PT-BR. — [PG16 fuzzystrmatch](https://www.postgresql.org/docs/16/fuzzystrmatch.html)
- Exemplo prático (10 mil produtos): `actor % 'tomy'` retornou TOM TORN e TOM DAY (falso positivo ilustrando o trade-off de limiar); similarity('tomy','tom')=0,5. — [Tapoueh, Using trigrams against typos](https://tapoueh.org/blog/2013/09/using-trigrams-against-typos/)
- Guias recomendam levenshtein após filtro por trigramas para ranking preciso em poucas linhas. — resumo de busca, fonte de baixa autoridade: [chat2db](https://chat2db.ai/resources/blog/postgres-fuzzy-search-levenshtein)

### Inferences
- Cálculo MANUAL (não executado no Postgres; validar com `SELECT similarity(...)`), seguindo as regras de trigramas acima e ignorando acentos (após unaccent):
  - 'pyhton' vs 'python': 7 trigramas cada, 3 em comum ("  p"," py","on ") => 3/11 = 0,27 < 0,3: NÃO casa com `%` padrão. Transposição no meio de palavra curta é o pior caso. levenshtein = 2.
  - 'progamacao' vs 'programacao': 11 e 12 trigramas, 9 em comum => 9/14 = 0,64: casa com folga (omissão de letra preserva a maioria dos trigramas). levenshtein = 1.
  - 'casa' vs 'caso': 5 trigramas cada, 3 em comum => 3/7 = 0,43 > 0,3: falso positivo com limiar padrão. levenshtein = 1, então edit distance sozinha também não separa; só frequência/contexto (ex.: preferir correção para palavra mais frequente no corpus, ou exigir correspondência exata quando o termo existe no vocabulário).
- Estratégia sensata: só aplicar correção quando o termo NÃO existe no vocabulário do corpus; para termos com <=4 letras não corrigir (ou exigir distância 1 e mesma letra inicial); para 5-8 letras permitir distância 2 via levenshtein_less_equal(…,2) para cobrir transposições; acima disso, similarity >= 0,3-0,4 como pré-filtro.
- Trigramas favorecem palavras longas; levenshtein como segundo estágio cobre o buraco das curtas.

### Gaps
- Não rodei SQL real: valores de similarity acima são cálculo manual e devem ser conferidos no Postgres 16.
- Nenhuma fonte encontrada com limiares empíricos recomendados para PT-BR/palavras curtas; as recomendações acima são inferência.
- Não há suporte nativo a Damerau-Levenshtein em fuzzystrmatch (conforme doc); alternativa seria trocar `translate`/regex ou função PL/pgSQL (não pesquisado).

## 2. FTS com config `portuguese` (Snowball): diminutivos, plurais, derivações, acentos; unaccent; Hunspell pt_BR; sinônimos/thesaurus; ts_rank/ts_rank_cd; websearch_to_tsquery

### Takeaway
O stemmer Snowball português trata plurais e muitas derivações, mas NÃO reduz diminutivos de forma sistemática (-inho/-zinho ficam, ex.: "bobinho" -> "bobinh"). Dicionários synonym/thesaurus ou Hunspell são as vias nativas para cobrir isso; não achei dicionário Hunspell pt_BR pronto para Postgres.

### Cited Findings
- Snowball português: Passo 1 remove sufixos derivacionais (-eza, -ico/-ica, -ismo, -ável/-ível, -ista, -oso, -amento/-imento, -ador, -ante, -mente, -idade, -ução, -ência...); passo 2 sufixos verbais só se o 1 nada removeu; passos 3-5 removem vogal final (-os,-a,-i,-o,-e...) e tratam ç->c. Não lista -inho/-zinho. Funciona para PT-PT e PT-BR sem normalizá-los. — [Snowball Portuguese](https://snowballstem.org/algorithms/portuguese/stemmer.html)
- Exemplos do vocabulário oficial: boato/boate/boatos -> boat; bobo -> bob; bobeira -> bobeir; "bobinho"/"bobinhos" -> "bobinh" (mantém -inh); bocadinho -> bocadinh; boca/bocado -> boc; bobagem -> bobag mas bobagens fica "bobagens" (plural irregular não reduz). — [Snowball Portuguese](https://snowballstem.org/algorithms/portuguese/stemmer.html)
- Plural é tratado dentro das listas (-as,-os,-es...) e no passo 4; não há passo dedicado. — [Snowball Portuguese](https://snowballstem.org/algorithms/portuguese/stemmer.html)
- Snowball reconhece todo token, portanto deve ficar por último na lista de dicionários. Dicionário Ispell reconhece vocabulário limitado: colocar Snowball depois. — [PG16 dictionaries](https://www.postgresql.org/docs/16/textsearch-dictionaries.html)
- unaccent como dicionário de filtro na cadeia (precisa vir antes do stemmer): `CREATE TEXT SEARCH CONFIGURATION fr (COPY=french); ALTER TEXT SEARCH CONFIGURATION fr ALTER MAPPING FOR hword, hword_part, word WITH unaccent, french_stem;` Exemplo: to_tsvector('fr','Hôtels de la Mer') -> 'hotel':1 'mer':4. — [PG16 unaccent](https://www.postgresql.org/docs/16/unaccent.html)
- A função `unaccent()` é STABLE (não IMMUTABLE), logo não entra direto em índice de expressão/coluna gerada; wrapper IMMUTABLE com dicionário explícito é a solução comum (nota da própria fonte como prática geral, não da página): `CREATE FUNCTION f_unaccent(text) ... IMMUTABLE ... SELECT public.unaccent('public.unaccent', $1)`. Módulo é "trusted". — [PG16 unaccent](https://www.postgresql.org/docs/16/unaccent.html)
- Synonym dictionary: arquivo `$SHAREDIR/tsearch_data/x.syn`, linhas "palavra sinônimo"; `*` no final = prefixo (vale só em to_tsquery); evita stemmer estragar palavras. Mapeamento: `ALTER TEXT SEARCH CONFIGURATION ... ALTER MAPPING FOR asciiword WITH my_synonym, english_stem`. — [PG16 dictionaries](https://www.postgresql.org/docs/16/textsearch-dictionaries.html)
- Thesaurus: mapeia frases ("sample words : indexed words") com subdicionário para normalização (ex.: Dictionary = english_stem); mudanças exigem reindexar. Incluir a forma original no lado direito mantém busca pelos dois. — [PG16 dictionaries](https://www.postgresql.org/docs/16/textsearch-dictionaries.html)
- Ispell/Hunspell: arquivos .dict/.affix não vêm com o Postgres; renomear .dic/.aff, converter para UTF-8 (iconv), copiar para `$SHAREDIR/tsearch_data`, `CREATE TEXT SEARCH DICTIONARY ... (TEMPLATE=ispell, DictFile=..., AffFile=..., Stopwords=...)`. Hunspell com suporte só básico a compostos. Sessões leem o arquivo uma vez (usar ALTER dummy para recarregar). — [PG16 dictionaries](https://www.postgresql.org/docs/16/textsearch-dictionaries.html)
- Pacote Pigsty `hunspell_pt_pt` (origem postgrespro/hunspell_dicts) cria config `portuguese_hunspell`, mas é Português de Portugal, e uma página o marca como "broken". Não encontrei pacote pt_BR; a rota seria montar a partir dos arquivos Hunspell pt_BR do LibreOffice (inferência da busca, não confirmada). — [Pigsty hunspell_pt_pt](https://pigsty.io/docs/pgext/fts/hunspell_pt_pt), [pg_hunspell](https://github.com/EvanCarroll/pg_hunspell)
- RSLP (Orengo): stemmer de sufixos com regras (sufixo, tamanho mínimo de radical, substituição, exceções); Lucene tem implementação (RSLPStemmerBase, e variante RSLP-S só de plural). Não consegui verificar o texto exato da regra de diminutivo (-inho/-zinho). — [Lucene RSLPStemmerBase](https://code.yawk.at/org.apache.lucene/lucene-analyzers-common/8.7.0/org/apache/lucene/analysis/pt/RSLPStemmerBase.java) (a página não carregou na leitura; informação vem do resumo da busca), [Lucene PortugueseMinimalStemmer](https://lucene.apache.org/core/6_4_0/analyzers-common/org/apache/lucene/analysis/pt/PortugueseMinimalStemmer.html)
- websearch_to_tsquery: nunca dá erro de sintaxe; texto sem aspas -> AND (&); "aspas" -> frase (<->); `or` -> |; `-` -> !; demais pontuação ignorada. — [PG16 textsearch-controls](https://www.postgresql.org/docs/16/textsearch-controls.html)
- ts_rank: frequência dos lexemas; ts_rank_cd: cover density (considera proximidade, exige posições; retorna 0 se vetor "stripped"). Pesos padrão {D,C,B,A} = {0.1,0.2,0.4,1.0}. Normalização (bitmask): 0 ignora tamanho, 1 /(1+log len), 2 /len, 4 /distância harmônica média (só cd), 8 /palavras únicas, 16 /(1+log únicas), 32 rank/(rank+1). Doc alerta que ranking é custoso (consulta o tsvector de cada match, I/O). — [PG16 textsearch-controls](https://www.postgresql.org/docs/16/textsearch-controls.html)
- setweight rotula posições A-D; pesos se aplicam a posições; vetor stripped perde isso. — [PG16 textsearch-features](https://www.postgresql.org/docs/16/textsearch-features.html)

### Inferences
- Diminutivos: como "-inh" permanece, "bolsinha" e "bolsa" não convergem no `portuguese`. Opções nativas: (a) arquivo synonym/thesaurus curado para termos do domínio (ex.: "iniciacao cientifica : ic"); (b) pré-normalização com regex (`regexp_replace(q, '(z?inh)(o|a)s?$', '\2')`) limitada a palavras longas, com lista de exceções (vizinho, caminho, carinho, linha, farinha) — técnica de engenharia minha, não citada de fonte; (c) fallback por trigramas, que aproxima "bolsinha"/"bolsa" pelo prefixo comum.
- Cadeia recomendada: `unaccent, portuguese_stem` (mais um synonym antes de unaccent/stem se houver siglas). Acentos: unaccent no FTS torna "programacao"=="programação".
- Para poucos milhares de documentos curtos, ts_rank_cd com normalização 1 ou 2 e pesos A/B (título/tags) é suficiente; custo de ranking desprezível nessa escala.
- Hunspell pt_BR traria lematização melhor (formas verbais irregulares, plurais irregulares), mas custo operacional (arquivos no container, UTF-8, recarga) provavelmente não compensa em catálogo pequeno.

### Gaps
- Não achei fonte primária sobre a regra de diminutivo do RSLP (texto do artigo Orengo & Huyck, 2001 não lido).
- Não achei dicionário Hunspell pt_BR já empacotado para Postgres nem avaliação de qualidade (lematização) comparando com Snowball.
- Comportamento exato do `portuguese` do PG16 com diminutivos específicos (rodar `ts_lexize('portuguese_stem', ...)` para confirmar; os exemplos acima vêm da tabela oficial do Snowball, que o Postgres incorpora).

## 3. Pipeline recomendado (trigram + FTS), combinação de scores, e padrão "você quis dizer" com ts_stat

### Takeaway
O padrão comum é FTS primeiro (stemming, sinônimos, ranking) e trigramas como fallback/complemento para typos e prefixos; para "você quis dizer", montar tabela de vocabulário do corpus (via ts_stat ou lista de palavras) com índice trigram e buscar o vizinho mais próximo, refinando com levenshtein. Não encontrei fonte autoritativa sobre fórmula de fusão de scores; é decisão de projeto.

### Cited Findings
- ts_stat(sqlquery [, weights]) retorna (word, ndoc, nentry) a partir de uma query que devolve uma coluna tsvector. A doc a descreve como útil para checar configuração e achar candidatas a stop words; não menciona "vocabulário"/correção ortográfica. — [PG16 textsearch-features](https://www.postgresql.org/docs/16/textsearch-features.html)
- Nota: lexemas de ts_stat são STEMS (saída do stemmer), não palavras originais; para sugestão exibível ao usuário é preciso vocabulário de palavras cruas (inferência, ver abaixo).
- Padrão trigram: filtrar por `%`, ordenar por `<->`, índice GiST `gist_trgm_ops`; exemplo ~10 mil linhas: ~27 ms sem índice, ~2,7 ms com GiST; autocomplete `ORDER BY <-> LIMIT 10` ~3 ms com filtro `%`, ~30 ms sem o filtro (índice não usado). — [Tapoueh](https://tapoueh.org/blog/2013/09/using-trigrams-against-typos/) (dados de 2013, PG 9.x; ordem de grandeza apenas)
- Trigramas são complemento, não substituto do FTS (stemming, dicionários, sinônimos, ranking vêm do FTS). — [Tapoueh](https://tapoueh.org/blog/2013/09/using-trigrams-against-typos/)
- Resumo de blogs de baixa autoridade: tentar FTS primeiro e cair para trigramas quando não houver resultado, porque pg_trgm não entende a língua. — [resultados de busca, ex. chat2db](https://chat2db.ai/resources/blog/postgres-pg-trgm-fuzzy-text-search)
- GIN e GiST em pg_trgm suportam `%`, `<%`, `<<%`, LIKE/ILIKE/regex; apenas GiST suporta operadores de distância (KNN `ORDER BY ... <->`); GiST aceita `siglen` (padrão 12, 1-2024). — [PG16 pg_trgm](https://www.postgresql.org/docs/16/pgtrgm.html)
- Para FTS, GIN é o tipo "preferido"; GiST é lossy (assinatura, precisa recheck do heap); `maintenance_work_mem` ajuda o build do GIN. — [PG16 textsearch-indexes](https://www.postgresql.org/docs/16/textsearch-indexes.html)

### Inferences
- Pipeline proposto (não citado de fonte única):
  1. Normalizar consulta (lower + unaccent). Tokenizar.
  2. Estágio A (preciso): `websearch_to_tsquery('pt_unaccent', q)`; ordenar por `ts_rank_cd(vetor_com_pesos, q, 1)`.
  3. Estágio B (tolerante): para tokens fora do vocabulário (ou se A retornar poucos/zero), corrigir token via tabela `vocab(palavra, freq)` com índice GIN/GiST trigram: candidatos `palavra % token`, depois `levenshtein_less_equal(palavra, token, 2)`, escolher menor distância e maior frequência; reexecutar A com o token corrigido e mostrar "Você quis dizer: …".
  4. Estágio C (complemento): `word_similarity(q, titulo || ' ' || tags)` com `<%` para casar prefixos/partes e typos em títulos curtos.
  5. Fusão: ou cascata (A, depois B se vazio) ou score linear, ex. `score = 1.0*ts_rank_cd_norm + 0.5*word_similarity` (pesos a calibrar com amostra de consultas reais); normalizar ts_rank com flag 32 para ficar em 0-1 antes de somar. Alternativa sem calibrar escalas: Reciprocal Rank Fusion (conhecimento geral, sem fonte aqui).
- Vocabulário: popular `vocab` a partir de palavras cruas (unaccent+lower) dos títulos/descrições/tags, p.ex. `regexp_split_to_table`; ts_stat sobre `to_tsvector('simple', ...)` fornece palavras não-stemizadas com ndoc/nentry (frequência), servindo ao mesmo propósito. Em catálogo de milhares de docs, tabela de poucos milhares de palavras permite até seq scan com levenshtein em poucos ms, dispensando índice.
- Para "casa/caso": só corrigir token ausente do vocabulário; assim uma palavra válida nunca é "corrigida".

### Gaps
- Sem fonte de engenharia autoritativa para o padrão ts_stat -> sugestão ortográfica nem para fórmulas de fusão; a doc do Postgres e blogs fracos apenas sustentam peças.
- Não li artigos de empresas (ex. posts de engenharia) sobre híbrido FTS+trigram em produção.

## 4. Latência, custo de índice (poucos milhares de docs curtos) e extensões na imagem postgres:16-alpine

### Takeaway
Nessa escala quase tudo roda em poucos milissegundos, mesmo sem índice; os índices importam pouco. pg_trgm, fuzzystrmatch e unaccent são módulos contrib; a confirmação de que a imagem oficial alpine os traz ficou só parcial.

### Cited Findings
- Docker Hub: na variante Alpine, "qualquer extensão fora de postgres-contrib precisa ser compilada na sua imagem", o que implica que os contrib estão presentes. A página não lista extensões explicitamente. — [Docker Hub postgres](https://hub.docker.com/_/postgres)
- pg_trgm, fuzzystrmatch e unaccent são módulos contrib documentados no PG16 (apêndice F); unaccent é "trusted" (instalável por não superusuário com CREATE no banco). — [PG16 unaccent](https://www.postgresql.org/docs/16/unaccent.html), [PG16 pg_trgm](https://www.postgresql.org/docs/16/pgtrgm.html), [PG16 fuzzystrmatch](https://www.postgresql.org/docs/16/fuzzystrmatch.html)
- Medidas históricas: ~10 mil linhas, `%` com scan sequencial ~27 ms vs ~2,7 ms com GiST; KNN ~3 ms. — [Tapoueh](https://tapoueh.org/blog/2013/09/using-trigrams-against-typos/)
- Ranking exige ler o tsvector de cada linha que casou (pode ser I/O bound); doc diz ser quase impossível evitar. — [PG16 textsearch-controls](https://www.postgresql.org/docs/16/textsearch-controls.html)
- Alpine desde PG15 suporta locales ICU (relevante para ordenação/collation PT-BR). — [Docker Hub postgres](https://hub.docker.com/_/postgres)

### Inferences
- Com <= alguns milhares de linhas curtas, o tamanho de índices GIN/GiST é de KBs a poucos MB e o build é instantâneo; ainda assim criar GIN no tsvector (coluna gerada STORED) e GIN/GiST trigram no texto normalizado é barato e evita seq scans futuros. Para esse volume, o planner pode preferir seq scan de qualquer forma.
- Coluna gerada exige função IMMUTABLE: `to_tsvector('regconfig_literal', ...)` com config explícita e wrapper f_unaccent IMMUTABLE.
- Esperado: dezenas de ms no pior caso por consulta (inclui levenshtein em vocabulário pequeno); medir com EXPLAIN ANALYZE.
- Verificação recomendada no container: `SELECT name FROM pg_available_extensions WHERE name IN ('pg_trgm','fuzzystrmatch','unaccent');` e `CREATE EXTENSION` na migration Drizzle (SQL custom). O CLAUDE.md do projeto já prevê pg_trgm e unaccent.

### Gaps
- Não consegui abrir o Dockerfile oficial (404 nas URLs tentadas) para citar que `postgres:16-alpine` constrói com contrib; a evidência é só a frase do Docker Hub. Conhecimento prévio indica que os contrib vêm na imagem, mas não verificado aqui.
- Não medi latência nem tamanho de índice reais; sem benchmark citável para PG16 em catálogos pequenos.
