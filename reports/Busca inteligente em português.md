# Busca tolerante cabe inteira no PostgreSQL

O Vértice deve ficar no PostgreSQL 16 e trocar a estratégia atual por uma cascata de três algoritmos: full-text search (FTS) com stemmer `portuguese` para derivações, um corretor por vocabulário (Levenshtein mais regra de diminutivos) para erros e "casinha → casa", e sinônimos em tabela para o que a grafia não resolve. **Baixar o limiar de `word_similarity` não funciona**: medido neste projeto, o erro legítimo `pyhton/python` dá 0,29 e o falso positivo `casa/caso` dá 0,60, então nenhum limiar separa os dois. As três camadas custam **R$ 0 de infraestrutura e nenhum serviço novo**: basta ativar `fuzzystrmatch`, já disponível na imagem local, e criar duas tabelas. Num protótipo sintético de 5.000 documentos, o FTS com índice levou cerca de 21 ms e o corretor cerca de 1 ms. Motores dedicados e extensões BM25 ficam de fora, porque só resolvem problemas que esse catálogo não tem ou trazem custo desproporcional para um desenvolvedor solo. Busca semântica é a única expansão com ganho real em potencial ("carros" → "Equipe Baja"), mas `vector` não está na imagem local e deve esperar evidência do conjunto de avaliação. As testagens aqui são pequenas: não há ainda medida de relevância com consultas reais, e o plano começa justamente por criá-la.

## Nenhum limiar de trigrama separa erro de falso positivo

Os valores abaixo vêm do PostgreSQL 16 do projeto (medido aqui, 2026-11-02) e substituem os cálculos manuais das notas. A coluna de Levenshtein foi medida nesta síntese. O código atual exige `word_similarity(consulta, alvo) > 0,4` para termos com 4 letras ou mais.

| Consulta → alvo | `word_similarity` | Levenshtein | Veredito desejado | Limiar 0,4 |
| --- | --- | --- | --- | --- |
| `casinha → casa` | 0,38 | 3 | casar | perde |
| `pyhton → python` | 0,29 | 2 | casar | perde |
| `pithon → python` | 0,43 | 1 | casar | acerta |
| `robotcia → robotica` | 0,56 | 2 | casar | acerta |
| `casa → caso` | 0,60 | 1 | não casar | erra |
| `casa → causa` | 0,40 | 1 | não casar | na fronteira |
| `programador → programacao` | 0,67 | não usado | casar | acerta |
| `engenheiro → engenharia` | 0,55 | 4 | casar | acerta |

Para pegar `pyhton`, o limiar teria de cair abaixo de 0,29, e aí `casa` passaria a casar `caso`, `causa` e qualquer vizinho de trigramas. A causa é estrutural: uma transposição no meio de palavra curta destrói quase todos os trigramas, enquanto trocar a última letra preserva a maioria deles. Há também uma limitação no modelo atual: a função recebe a consulta inteira como uma só string, portanto `bolsa pyhton` não tem correção por palavra. O FTS tradicional não resolve o caso do autor sozinho, pois `casinha` vira `casinh` e `casa` vira `cas` (medido aqui). O próprio Snowball mantém `-inh` em seus exemplos oficiais, como `bobinho → bobinh` ([Snowball](https://snowballstem.org/algorithms/portuguese/stemmer.html)).

**Uma ressalva sobre `progamação`.** O dado medido de 0,36 usa a consulta acentuada. Em teste adicional desta síntese, `word_similarity('progamacao', 'programacao de robos')` deu **0,64**, igual ao cálculo manual das notas, e `normalizeQuery` remove o acento antes do SQL. Logo, pela leitura do código, a busca atual deve encontrar esse caso, ao contrário da conclusão fornecida. Não executei `searchOpportunities` de ponta a ponta, então esse ponto vira o primeiro teste do conjunto de avaliação. Os casos `casinha` e `pyhton` continuam falhando em qualquer leitura.

## A cascata: stemmer, corretor e sinônimos, nessa ordem

**Derivações ficam com FTS, mas a receita das notas precisa mudar.** As notas sugerem a cadeia `unaccent, portuguese_stem`, baseada no exemplo oficial ([PG16 unaccent](https://www.postgresql.org/docs/16/unaccent.html)). Testei essa cadeia nesta síntese e ela **quebra derivações em português**: sem acento, `programação` vira `programaca` em vez de `program`, e buscar `programador`, `programar` ou `computador` deixou de encontrar os documentos certos. A causa é que o Snowball precisa do `ç` e do `ã` para reconhecer os sufixos. Sem `unaccent`, porém, `programacao` digitado sem acento não casa com `program`, e `robô`/`robôs` não convergem (o stemmer mantém as duas formas).

A solução medida é **indexar as duas formas**: `to_tsvector('portuguese', texto) || to_tsvector('portuguese', unaccent(texto))`, consultando cada palavra pelas duas variantes. No teste, `programacao`, `programação`, `programador` e `programar` acharam o mesmo documento, assim como `robo`, `robos` e `robô`, e `iniciação cientifica` achou o documento de iniciação científica. O custo é um vetor maior, irrelevante nessa escala. A colisão contrária existe: `casa`, `caso`, `casos` e `casado` compartilham o radical `cas` (medido aqui), por isso `casa` traz `Estudo de caso`. O ranqueamento resolve isso colocando a palavra exata primeiro.

**Erros e diminutivos ficam com um corretor por vocabulário, aplicado palavra a palavra, só quando a palavra não casou com nada.** Essa condição é a defesa central contra `casa → caso`: palavra válida nunca é corrigida. A fonte do vocabulário é `ts_stat` sobre `to_tsvector('simple', unaccent(...))`, que entrega palavras sem stemming e frequência ([PG16 text search](https://www.postgresql.org/docs/16/textsearch-features.html)). A regra proposta é engenharia própria, sem fonte de autoridade: primeiro tentar a forma sem diminutivo (`casinha → casa`, `cafezinho → cafe`) e aceitá-la só se existir no vocabulário; depois usar `levenshtein_less_equal` com distância 1 para 4 letras e 2 para 5 ou mais, desempatando por menor distância e maior frequência; nada abaixo de 4 letras, o que protege `IC`, `PET` e siglas. Distância 2 é obrigatória porque `levenshtein` não trata transposição como uma edição ([PG16 fuzzystrmatch](https://www.postgresql.org/docs/16/fuzzystrmatch.html)) e `pyhton → python` custa 2. Algoritmos fonéticos estão descartados: a documentação avisa que funcionam mal em UTF-8 ([PG16 fuzzystrmatch](https://www.postgresql.org/docs/16/fuzzystrmatch.html)).

No protótipo, com 19 tokens de teste e cerca de 5.000 palavras, **18 se comportaram como esperado**: `casinha`, `casinhas`, `bolsinha`, `pyhton`, `pithon`, `progamacao`, `robotcia`, `algoritimo` e `engeharia` foram corrigidas; `casa`, `caso`, `vizinho`, `caminho`, `sozinho` e `carinho` ficaram intactas; `ic`, `pet` e `xyzw` não foram alteradas. A falha foi `cafezinho`, porque a primeira regex gerava `cafeo`; a variante que remove `-zinho` inteiro produz `cafe`, verificada separadamente. O risco remanescente é real: se `carinho` não existir no catálogo e `caro` existir, a regra troca o sentido da palavra. Por isso a correção precisa ser sempre visível, como "Mostrando resultados para **casa** · buscar exatamente **casinha**". Isso também atende ao pedido do autor de sugerir, em vez de impor. Sem correção possível, a página deve oferecer saída, já que a Baymard relata becos sem saída em 68% dos sites analisados ([Coveo sobre Baymard](https://coveo.com/blog/avoid-no-search-results-found/)).

**Sinônimos ficam em tabela, expandidos na consulta.** Os dicionários `synonym` e `thesaurus` do PostgreSQL exigem arquivo em `$SHAREDIR/tsearch_data` e, no thesaurus, reindexação a cada mudança ([PG16 dictionaries](https://www.postgresql.org/docs/16/textsearch-dictionaries.html)), o que significaria alterar a imagem por causa de uma palavra. Uma tabela `search_synonyms` editável pelo admin evita isso. Ela cobre o que o stemmer não une: `engenheiro` (`engenheir`) e `engenharia` (`engenh`), `robô` (`rob`) e `robótica` (`robot`), além de `IC` e `iniciação científica`. A tabela `tag_aliases`, que já existe, mapeia variantes de tags como `pyhton` e deve alimentar essa expansão. Hunspell pt_BR fica fora: as notas não acharam pacote pronto e a montagem manual não compensa aqui.

**`LIKE` continua no sistema.** Ele preserva buscas que stemmer e trigrama ignoram, como `C++`, siglas e nomes de orientador, e pode reaproveitar o código existente.

## Ranqueamento em camadas vence fórmula de pesos

A ordem deve ser lexicográfica, depois de respeitar a D36 (abertos antes de encerrados): acerto exato em sigla, tag ou título; todos os termos no título ou nas tags; todos os termos no corpo; algum termo (OR); resultado de termo corrigido. Dentro de cada camada, usar `ts_rank_cd` com pesos A para título, sigla e tags, B para projeto e área, e C para descrição. Os pesos e a normalização são nativos ([PG16 controls](https://www.postgresql.org/docs/16/textsearch-controls.html)). Essa regra é simples de explicar numa banca e de depurar, e dispensa calibrar escalas entre scores diferentes. A etapa OR importa porque o AND tende a zerar frases como "quero trabalhar com carros".

`ts_rank` não tem IDF nem saturação, e os fornecedores de BM25 enfatizam isso ([Tiger Data](https://tigerdata.com/blog/pg-textsearch-bm25-full-text-search-postgres)). A objeção é legítima, mas não há benchmark independente nessa escala: os dados encontrados vão de 8,8 a 138 milhões de passagens, e uma fonte neutra admite que o nativo "may still be adequate" quando simplicidade pesa mais ([Evan Schwartz](https://emschwartz.me/comparing-full-text-search-algorithms-bm25-tf-idf-and-postgres/)). Em títulos curtos, a posição do termo tende a dizer mais que a raridade, embora isso seja hipótese. Se o conjunto de avaliação mostrar falhas de termos raros, um ajuste por `ndoc` do vocabulário custa menos que uma extensão.

## O que não entra agora, e por quê

| Opção | Ganho real | Obstáculo | Decisão |
| --- | --- | --- | --- |
| ParadeDB `pg_search` | BM25, stemmer português, fuzzy até distância 2 ([docs](https://api.pgxn.org/src/pg_search/pg_search-0.25.3/docs/documentation/full-text/fuzzy.mdx)) | AGPLv3, versão 0.x e imagem própria ([GitHub](https://github.com/paradedb/paradedb)) | Rejeitar; é o melhor plano B dentro do Postgres |
| `pg_textsearch` | BM25, licença permissiva | Só PG 17 e 18, sem tolerância a erro ([GitHub](https://github.com/timescale/pg_textsearch)) | Rejeitar |
| VectorChord-BM25 | BM25 | "Only English has been tested" ([GitHub](https://github.com/tensorchord/VectorChord-bm25)) | Rejeitar |
| RUM | Ranking mais rápido | TF/IDF é só TODO ([GitHub](https://github.com/postgrespro/rum)) | Rejeitar |
| Typesense | Erro, prefixo e stemming `pt` ([docs](https://typesense.org/docs/30.2/api/stemming)) | Serviço extra, sincronização e prioridade ao acento exato ([locale](https://typesense.org/docs/guide/locale.html)) | Rejeitar; plano B fora do Postgres |
| Meilisearch | Erro e prefixo por padrão ([docs](https://www.meilisearch.com/docs/capabilities/full_text_search/relevancy/typo_tolerance_settings)) | Serviço extra; stemming não documentado ([idiomas](https://www.meilisearch.com/docs/resources/help/language)); 1 a 4 letras sem erro | Rejeitar |
| Elasticsearch, OpenSearch | Plataforma completa | JVM desproporcional para uma VM pequena (inferência das notas) | Rejeitar |
| Algolia | Serviço pronto | Dependência externa e cota; valores não confirmados na página de preços ([Algolia](https://www.algolia.com/pricing/build-plan)) | Rejeitar |

O custo que decide contra motores dedicados não é RAM, pois Typesense ocioso usa cerca de 20 MB ([Typesense](https://typesense.org/docs/guide/system-requirements.html)). É a dupla escrita: cada processo despublicado precisa sumir do segundo índice, e falhas viram processos encerrados visíveis, em conflito com a D36. Mesmo o motor com erro nativo não dispensaria lógica própria para mostrar "Você quis dizer".

**Busca semântica é adiamento, não rejeição.** Embeddings cobrem o que nenhuma camada lexical alcança, mas não substituem o ramo tolerante, porque encoders densos perdem desempenho com erros de digitação ([Sidiropoulos & Kanoulas](https://arxiv.org/abs/2205.02303v1)), ainda que esses estudos sejam em inglês. O custo marginal aqui é maior do que o preço sugere. O `vector` não está disponível na imagem atual, então seria preciso trocá-la. O modelo local `multilingual-e5-small` exige prefixos e ONNX ([HF](https://huggingface.co/Xenova/multilingual-e5-small)) e consome, por inferência das notas, cerca de 120 MB de pesos quantizados, com RAM e latência em VM OCI não medidas. A API OpenAI custa US$ 0,02 por milhão de tokens ([OpenAI](https://developers.openai.com/api/docs/models/text-embedding-3-small)), logo cerca de US$ 0,03 para 5.000 documentos de 300 tokens (cálculo próprio). Em contrapartida, ela envia consultas de anônimos ao exterior e levanta a questão de transferência internacional sob a LGPD ([Demarest](https://www.demarest.com.br/anpd-aprova-o-regulamento-de-transferencia-internacional-de-dados/)). Se a fase vier, a escolha é modelo local, varredura exata sem HNSW, que tem recall perfeito ([pgvector](https://github.com/pgvector/pgvector)), cerca de 7,7 MB de vetores a 384 dimensões, e fusão por RRF com k=60 ([pgvector-python](https://github.com/pgvector/pgvector-python/blob/master/examples/hybrid_search/rrf.py)). Sem um limiar mínimo de cosseno, RRF sempre devolve algo, mesmo irrelevante.

## Custo quase zero, com uma dependência operacional nova

O comando pedido retornou **61 extensões**, na imagem `postgres:16-alpine` local (PostgreSQL 16.15, x86_64). **Estão disponíveis `pg_trgm`, `fuzzystrmatch` e `unaccent`; `vector` não está.** Hoje apenas `uuid-ossp`, `pg_trgm` e `unaccent` estão instaladas no banco, portanto `fuzzystrmatch` exige uma linha na migration. A lista não prova a imagem de produção: a VM pode ser ARM64, então repita o comando lá antes do deploy. Saída completa:

```text
adminpack amcheck autoinc bloom bool_plperl bool_plperlu btree_gin btree_gist citext cube dblink dict_int dict_xsyn earthdistance file_fdw fuzzystrmatch hstore hstore_plperl hstore_plperlu hstore_plpython3u insert_username intagg intarray isn jsonb_plperl jsonb_plperlu jsonb_plpython3u lo ltree ltree_plpython3u moddatetime old_snapshot pageinspect pg_buffercache pgcrypto pg_freespacemap pg_prewarm pgrowlocks pg_stat_statements pgstattuple pg_surgery pg_trgm pg_visibility pg_walinspect plperl plperlu plpgsql plpython3u pltcl pltclu postgres_fdw refint seg sslinfo tablefunc tcn tsm_system_rows tsm_system_time unaccent uuid-ossp xml2
```

O protótipo usou 5.000 documentos sintéticos de 98 palavras, com palavras aleatórias, em tabela temporária, nesta máquina local. Portanto, ele mostra ordem de grandeza, não latência de produção nem qualidade de relevância.

| Operação | Medido aqui |
| --- | --- |
| `LIKE` com `lower(unaccent())`, sem índice (estilo atual) | cerca de 107 ms |
| FTS com ranking, sem índice | cerca de 160 ms |
| FTS com ranking, com GIN | cerca de 21 ms |
| Corretor em 3.150 palavras, sem índice | cerca de 1 ms |
| Tamanho do índice GIN | 2,1 MB |

Isso ajusta uma inferência das notas: com documentos desse tamanho, o GIN não é irrelevante, pois reduziu o tempo em cerca de 8 vezes. O vocabulário, por outro lado, dispensa índice trigram.

A dependência nova é a **manutenção do índice**. Uma coluna gerada não alcança outras tabelas, e a busca combina processo, projeto e tags. Recomendo uma tabela `search_documents`, com vetor por processo, atualizada na mesma transação das Server Actions que alteram esses dados, inclusive merge de tags, mais um comando idempotente de reconstrução total. O vocabulário entra nessa reconstrução. As estimativas de esforço abaixo são minhas.

| Fase | Entrega | Esforço | Infra nova | Critério para seguir |
| --- | --- | --- | --- | --- |
| 0 | Conjunto de avaliação em Vitest (cerca de 50 consultas e 20 de zero resultado), com P@1, P@3 e NDCG@10 ([Curiosity](https://docs.curiosity.ai/workspace/evaluation/relevance-evaluation)) | 1 dia | Nenhuma | Linha de base registrada, incluindo `progamação` |
| 1 | `search_documents`, vetor duplo, GIN, camadas de ranking, `LIKE` mantido | 2 a 3 dias | Nenhuma | Nenhuma consulta regride; derivações e acentos passam |
| 2 | `fuzzystrmatch`, vocabulário, diminutivos, aviso de correção | 1 a 2 dias | 1 extensão | `casinha` e `pyhton` passam; `casa` e `caso` ficam intactas |
| 3 | `search_synonyms`, `tag_aliases`, log de consultas | 1 dia, mais 15 min por semana | 2 tabelas | Zero resultados em queda |
| 4 (condicional) | pgvector, modelo local, RRF | 1 semana ou mais | Imagem nova, mais RAM | Só se as falhas conceituais restantes não caberem em sinônimos |

O log é necessário para visitantes anônimos, mas deve guardar apenas consulta normalizada, número de resultados e posição clicada, sem IP ou sessão, com retenção curta. Consultas podem conter nomes, e não encontrei parecer sobre se uma busca curta é dado pessoal. As fases 1 e 2 devem seguir TDD, como pede o `CLAUDE.md`, e a decisão precisa ser registrada em `docs/DECISIONS.md`, com atualização de `docs/ARCHITECTURE.md` §6.3.

## Conclusão

A descoberta útil é que os três problemas do autor parecem um só, mas pedem algoritmos distintos: "derivação" é morfologia, "erro" é distância de edição condicionada ao vocabulário e "sinônimo" é conhecimento curado. Por isso a pergunta deixa de ser qual extensão escolher e passa a ser em que ordem aplicar cada uma. A ordem importa mais que a sofisticação: o teste de `unaccent` antes do stemmer mostra que a receita padrão, aplicada sem medir, removeria justamente o comportamento desejado em português.

O vocabulário do próprio catálogo é a peça que torna a busca menos rígida sem deixá-la imprecisa, porque só permite corrigir para palavras que levam a resultado. O valor mais duradouro do trabalho, inclusive para o TCC, será o conjunto de avaliação. Com catálogo pequeno e sem literatura para PT-BR nessa escala, ele transforma preferências técnicas em decisões demonstráveis, e os limiares propostos aqui devem ser tratados como hipóteses iniciais até passarem por ele.
