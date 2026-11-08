# Busca semântica e híbrida com pgvector para português brasileiro

Nota: preços consultados em 2026-11-02, via agregadores, salvo indicação. Confirmar nas páginas oficiais antes de decidir.

## 1. Modelos de embedding multilíngues para português (qualidade, dimensões, custo, CPU local)

### Takeaway
Não encontrei números de MTEB-BR por modelo (só o artigo e agregadores ambíguos). A escolha prática para uma instância OCI pequena é multilingual-e5-small (384d) ou BGE-M3 (1024d, MIT) rodando local, ou OpenAI text-embedding-3-small (US$0,02/M tokens) via API. Para um catálogo de poucos milhares de textos curtos, o custo de API é desprezível; a questão real é privacidade e latência.

### Cited Findings
- MTEB-BR é um benchmark de 22 tarefas nativas em português brasileiro, em 7 categorias, com 93 modelos avaliados (73 abertos, 20 APIs comerciais). Os autores afirmam que um modelo aberto e auto-hospedável chega ao grupo líder — [arXiv 2607.04581](https://arxiv.org/pdf/2607.04581)
- O ranking do MTEB multilíngue global prevê o ranking em português só moderadamente (Spearman 0,75 em 55 modelos; um modelo é 3º no global e 49º no BR). Não confie só no leaderboard global — [arXiv 2607.04581](https://arxiv.org/pdf/2607.04581) (via resumo de busca; o PDF não foi legível por mim)
- Uma página do agregador mostra 57,5% de Mean_22 no MTEB-BR para multilingual-e5-base, mas a leitura do layout é ambígua — [benchmarklist](https://benchmarklist.com/models/intfloat-multilingual-e5-base/)
- BGE-M3: 1024 dimensões, contexto de 8192 tokens, licença MIT, tag ONNX disponível — [HF BAAI/bge-m3](https://huggingface.co/BAAI/bge-m3)
- multilingual-e5: três tamanhos (small/base/large), pré-treino contrastivo em 1 bilhão de pares multilíngues — [arXiv 2402.05672](https://arxiv.org/abs/2402.05672)
- multilingual-e5-small: 384 dimensões, exige prefixos `query: ` / `passage: `, mean pooling e normalização; há conversão ONNX para Transformers.js (Xenova), usada com `dtype: 'q8'` — [HF JasonYANG170/multilingual-e5-small-ONNX](https://huggingface.co/JasonYANG170/multilingual-e5-small-ONNX), [Xenova/multilingual-e5-small](https://huggingface.co/Xenova/multilingual-e5-small)
- O `model.onnx` em precisão total do e5-small tem cerca de 448 MB em um repositório — [HF skillsafe-ai/multilingual-e5-small](https://huggingface.co/skillsafe-ai/multilingual-e5-small)
- paraphrase-multilingual-MiniLM-L12-v2: 384d, `max_seq_length` 128, ~0,1B parâmetros, Apache-2.0, "50 línguas" sem listá-las na ficha — [HF card](https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2)
- fastembed (Qdrant) lista como multilíngues: paraphrase-multilingual-MiniLM-L12-v2 (384d, 0,22 GB, Apache-2.0), paraphrase-multilingual-mpnet-base-v2 (768d, 1,0 GB) e multilingual-e5-large (1024d, 2,24 GB, MIT). BGE-M3 não aparece nessa lista — [fastembed Supported Models](https://qdrant.github.io/fastembed/examples/Supported_Models/)
- OpenAI text-embedding-3-small: US$0,02 por 1M de tokens na página oficial; US$0,01/M no Batch segundo agregador, não confirmado na OpenAI — [OpenAI docs](https://developers.openai.com/api/docs/models/text-embedding-3-small), [costbench](https://www.costbench.com/software/embedding-apis/openai-embeddings/)
- Voyage: voyage-3.5 a US$0,06/M tokens (página oficial); voyage-multilingual-2 cerca de US$0,12/M (terceiros). Franquia gratuita descrita de modo conflitante na página (200M tokens para os modelos novos) — [Voyage pricing](https://docs.voyageai.com/pricing)
- Cohere embed-multilingual-v3: ~US$0,10/M tokens e 512 tokens de entrada, só por revendedores/agregadores, não pela Cohere — [getmaxim](https://www.getmaxim.ai/bifrost/llm-cost-calculator/provider/cohere/model/embed-multilingual-v3.0), [costbench Cohere](https://www.costbench.com/software/embedding-apis/cohere-embed/)
- Transformers.js roda modelos ONNX em Node.js sem GPU nem API externa; variantes quantizadas reduzem memória — [promptfoo docs](https://www.promptfoo.dev/docs/providers/transformers)

### Inferences
- Para o caso "carros" → "Equipe Baja", o desafio é associação semântica curta-para-curta, onde e5 e BGE-M3 devem servir. Isso não foi testado por mim. Recomendo montar um conjunto de ~30 consultas reais com o catálogo e comparar 2 ou 3 modelos, em vez de confiar em benchmark.
- RAM é inferência, não medição: e5-small quantizado (q8, cerca de 120 MB de pesos, um quarto dos 448 MB do fp32) deve caber folgadamente em uma instância OCI de 1 a 2 GB. BGE-M3 (~568M parâmetros, algo como 2 GB em fp32) é mais pesado e apertaria uma instância pequena. Os 568M não vêm de fonte que eu tenha fetchado.
- Com poucos milhares de documentos, o embedding dos documentos é feito uma vez; só a consulta é embutida online. Custo de API, mesmo em Voyage ou Cohere, fica em centavos.
- Se for um TCC, rodar local evita dependência externa e o problema de LGPD (seção 5).

### Gaps
- Scores por modelo no MTEB-BR (e5-small/large, BGE-M3, MiniLM, OpenAI, Cohere, Voyage): o PDF não pôde ser lido e o leaderboard não foi consultado.
- RAM e latência medidas de e5-small/BGE-M3 em CPU ARM/x86 da OCI: não encontrei benchmark.
- Cohere e Voyage com preço oficial confirmado: só via terceiros/snippet. Preço de Cohere v4 ou modelos 2026 mais novos não verificado.
- Não verifiquei se a OpenAI mudou o modelo recomendado ou os preços após meu corte.

## 2. Erros de digitação e consultas muito curtas; embeddings substituem trigrama?

### Takeaway
Não: a literatura mostra que encoders densos perdem desempenho de forma relevante com erros de digitação, então trigrama (pg_trgm) continua útil como ramo lexical tolerante a typos. Embeddings ajudam em sinonímia/intenção, trigrama em grafia.

### Cited Findings
- Dual encoders de recuperação densa sofrem queda grande de desempenho quando a consulta tem typos, e o efeito varia conforme a palavra errada — [Sidiropoulos & Kanoulas, SIGIR 2022](https://arxiv.org/abs/2205.02303v1)
- Trabalhos anteriores (Zhuang & Zuccon; Penha et al.) mostram que erros de ortografia degradam substancialmente a recuperação; modelos tipo BERT não são robustos a typos — mesma fonte acima
- Há treinamento específico (DST) para melhorar robustez a typos, com ganhos em MS MARCO/DL-typo, o que indica que modelos de prateleira não o fazem por padrão — [Tasawong et al., ACL 2023](https://arxiv.org/html/2306.10348v1)
- Embeddings lidam com paraphrases, mas podem falhar em identificadores exatos; a busca por palavra-chave tem o defeito oposto, daí a fusão — [pgXN pg_search / ParadeDB docs](https://api.pgxn.org/src/pg_search/pg_search-0.25.7/docs/documentation/hybrid/rrf.mdx) (via resumo)

### Inferences
- Esses estudos usam modelos em inglês (BERT, MS MARCO). Para e5/BGE-M3 em português a magnitude é desconhecida; subword tokenizers (XLM-R) fragmentam palavras erradas, o que sugere degradação, mas não medi.
- Consultas de 1 a 2 palavras dão pouco contexto ao encoder, e o vetor fica mais ruidoso; trigrama/prefixo funciona bem nelas. Isso é inferência.
- Desenho sugerido: ramo 1 = embeddings; ramo 2 = full-text `portuguese` + `unaccent`; ramo 3 opcional = `pg_trgm` `word_similarity` em título/tags. Fusão por RRF.

### Gaps
- Nenhum estudo achado sobre typos em português com e5/BGE-M3 nem sobre consultas de uma palavra.
- Nada achado sobre pg_trgm especificamente combinado com pgvector (a busca devolveu só material de BM25).

## 3. RRF: fórmula, k, SQL, armadilhas, alternativas

### Takeaway
RRF soma 1/(k+rank) por lista, com k=60 padrão; usa só posição, então dispensa normalizar scores de escalas diferentes. O exemplo oficial do pgvector é um FULL OUTER JOIN de duas CTEs.

### Cited Findings
- Exemplo pgvector-python: duas CTEs (`semantic_search` com `RANK() OVER (ORDER BY embedding <=> q)` LIMIT 20; `keyword_search` com `ts_rank_cd`), `FULL OUTER JOIN` por id, score = `COALESCE(1.0/(k+rank_sem),0) + COALESCE(1.0/(k+rank_kw),0)`, com `k = 60` — [pgvector-python rrf.py](https://github.com/pgvector/pgvector-python/blob/master/examples/hybrid_search/rrf.py)
- O README do pgvector recomenda usá-lo com full-text search do Postgres para busca híbrida e combinar via RRF ou cross-encoder — [pgvector README](https://github.com/pgvector/pgvector)
- RRF usa só rank; scores de cada ramo ficam locais, evitando normalização — [pgContext hybrid retrieval](https://pgxn.org/dist/pgcontext/docs/user_guide/hybrid_retrieval.html)
- ParadeDB chama k=60 de padrão amplamente usado e sugere 20–40 para acentuar o topo do ranking — [ParadeDB RRF](https://api.pgxn.org/src/pg_search/pg_search-0.25.7/docs/documentation/hybrid/rrf.mdx)
- Origem: Cormack, Clarke & Büttcher, SIGIR 2009 (não consegui abrir o PDF por redirecionamentos; o artigo é a fonte de k=60) — [PDF](http://cormack.uwaterloo.ca/cormacksigir09-rrf.pdf)

### Inferences
- Armadilhas: (a) ramo lexical sem acento/stemming (`unaccent` + config `portuguese`) perde "automóvel"/"automoveis"; (b) `plainto_tsquery` usa AND e "quero trabalhar com carros" raramente casa tudo, então ramo lexical vazio é comum. Usar OR (`websearch_to_tsquery` não resolve; montar `to_tsquery` com `|`) ou stopwords; (c) o vetor sempre devolve N vizinhos, mesmo irrelevantes, e RRF não tem noção de "nenhum resultado bom"; vale um limiar mínimo de similaridade cosseno por ramo; (d) com catálogo pequeno, LIMIT por ramo de 20 a 50 basta; (e) empates: desempate determinístico por id/data; (f) a consulta SQL precisa de `ORDER BY ... LIMIT` na CTE vetorial para usar índice.
- Alternativas: soma ponderada exige normalizar escalas (cosseno vs ts_rank vs similarity) e é frágil; RRF com pesos por ramo (peso/(k+rank)) é um meio-termo simples. Cross-encoder/reranker é opção mas custa CPU/RAM.
- Sem conjunto de avaliação, não dá para afirmar que k=60 é ótimo; com listas curtas, k menor dá mais peso ao topo.

### Gaps
- Texto do artigo original de RRF não foi lido (redirecionamentos); a afirmação de k=60 vem dos exemplos de pgvector/ParadeDB.
- Nenhum benchmark achado comparando RRF e soma ponderada em português.

## 4. HNSW vs varredura exata com alguns milhares de vetores

### Takeaway
Não precisa de índice. O pgvector faz busca exata por padrão (recall perfeito); em alguns milhares de linhas a varredura sequencial é de poucos ms. HNSW só adiciona memória, tempo de build e perda de recall.

### Cited Findings
- "By default, pgvector performs exact nearest neighbor search, which provides perfect recall"; índices aproximados trocam recall por velocidade; HNSW tem melhor desempenho de consulta que IVFFlat, mas build mais lento e mais memória — [pgvector README](https://github.com/pgvector/pgvector)
- O índice só é usado com `ORDER BY` por operador de distância + `LIMIT` — mesma fonte
- Filtros são aplicados após a varredura do índice HNSW: com filtro que casa 10% das linhas, restam ~4 resultados com `ef_search`=40 padrão; `hnsw.iterative_scan` mitiga — mesma fonte
- Parâmetros HNSW: `m`=16, `ef_construction`=64, `hnsw.ef_search`=40; `halfvec` reduz o tamanho do conjunto de trabalho — mesma fonte
- Operador `<=>` é distância de cosseno; `<#>` é produto interno negativo — mesma fonte

### Inferences
- Cálculo próprio: 5.000 vetores × 1024 floats × 4 B ≈ 20 MB (384d: ≈ 7,7 MB), cabe em shared_buffers; varredura exata é trivial. Se houver filtro (status da vaga ativa, por exemplo), o exato é ainda mais correto, pois evita o problema de filtro pós-índice.
- Quando adicionar HNSW: dezenas/centenas de milhares de vetores ou latência medida acima do aceitável. Verificar com `EXPLAIN ANALYZE`.

### Gaps
- Latência medida de varredura exata em OCI não existe; recomendo medir.
- Limite de dimensões (2000 para `vector` indexado, 4000 para `halfvec`) é do README; irrelevante sem índice.

## 5. Privacidade/LGPD e falha do serviço de embedding

### Takeaway
Consultas de visitantes anônimos podem conter dados pessoais (ex.: nome, curso) e enviá-las a API estrangeira configura transferência internacional sob a LGPD. Rodar o modelo local elimina o problema e a dependência; com API, é preciso fallback para o ramo lexical.

### Cited Findings
- A Resolução CD/ANPD nº 19/2024 (23/08/2024) regulamenta transferência internacional (arts. 33–36 da LGPD): decisão de adequação, cláusulas-padrão contratuais (Anexo II), cláusulas específicas (aprovação prévia da ANPD), normas corporativas globais — [Migalhas](https://www.migalhas.com.br/coluna/migalhas-de-protecao-de-dados/414287/breve-analise-sobre-a-transferencia-internacional-de-dados), [Demarest](https://www.demarest.com.br/anpd-aprova-o-regulamento-de-transferencia-internacional-de-dados/)
- O prazo de adaptação às cláusulas-padrão terminou em 23/08/2025 — [Mayer Brown](https://www.mayerbrown.com/pt/insights/publications/2025/08/end-of-grace-period-implementation-of-brazils-standard-contractual-clauses-in-international-transfers-of-personal-data)
- Uma única fonte afirma que a UE foi reconhecida como adequada (Res. CD/ANPD 32/2026); não verificado — [Confidata](https://confidata.com.br/blog/transferencia-internacional-dados-atualizacao-anpd-2026)
- Todas as fontes jurídicas acima são secundárias (escritórios/portais); não consultei o texto oficial.

### Inferences
- Se usar API (OpenAI, Voyage, Cohere: todas sediadas nos EUA, pelo meu conhecimento), é necessário base legal, aviso de privacidade e cláusulas contratuais; para um TCC, a opção de menor risco é embedding local ou, no mínimo, não enviar IP/identificadores e documentar.
- Os dados do catálogo (vagas/projetos) são públicos; o risco está só nas consultas dos visitantes. Mitigação: não logar consultas com identificadores, enviar apenas o texto da consulta e cachear embeddings de consultas frequentes.
- Falha do serviço: padrão sensato é timeout curto (1 a 2 s), disjuntor (circuit breaker) e degradar para o ramo lexical + trigrama; RRF com um ramo vazio continua funcionando (o `COALESCE(...,0)` do exemplo já trata isso). Com modelo local, a falha vira falta de memória/carga inicial: carregar o modelo na subida (warm-up) e expor health check.
- Cache LRU em memória das consultas já embutidas reduz custo e latência; ao trocar de modelo é preciso re-embutir todo o catálogo e guardar o nome/versão do modelo junto do vetor.

### Gaps
- Texto oficial da Res. 19/2024 e políticas de retenção/treinamento de dados de cada provedor de API (OpenAI, Voyage, Cohere) não foram verificados.
- Parecer jurídico sobre se uma consulta curta de busca é "dado pessoal": não encontrei fonte.
- Nenhuma fonte sobre padrões de disjuntor/fallback específicos de busca híbrida; a recomendação é engenharia geral.
