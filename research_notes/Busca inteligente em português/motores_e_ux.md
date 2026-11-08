# Motores de busca dedicados vs Postgres para um catálogo pequeno (pt-BR) e UX de busca

Data da pesquisa: 2026-11-02. Observação: web search limitada; várias fontes foram só snippets/resumos. Itens não confirmados estão em Gaps.

## 1. Funcionalidades nativas: typo, prefixo, sinônimos, stemming pt, ranking, facetas, híbrida

### Takeaway
Meilisearch dá typo tolerance + prefixo + normalização de acentos de graça, mas a documentação consultada não menciona stemming (nenhum idioma); Typesense tem stemming Snowball opt-in por campo (`stem: true` + `locale: "pt"`), portanto é o único dos dois com stemming em português documentado. Ambos oferecem busca híbrida com embeddings.

### Cited Findings
- Meilisearch: typo tolerance ligada por padrão; palavras de 1–4 caracteres sem typos, 5–8 um typo, 9+ dois typos (máx. 2); limiares configuráveis via `minWordSizeForTypos`; prefixo e typo aplicam-se à última palavra da consulta; prefixo pode ser desativado separadamente — [Meilisearch typo tolerance settings](https://www.meilisearch.com/docs/capabilities/full_text_search/relevancy/typo_tolerance_settings)
- Meilisearch: português está no grupo "Latin" do tokenizer Charabia (segmentação CamelCase; normalização com decomposição, minúsculas e remoção de marcas não espaçantes, isto é, acentos). A página de idiomas não menciona stemming — [Meilisearch language support](https://www.meilisearch.com/docs/resources/help/language)
- Meilisearch: para idiomas com keyword search mais fraco, docs sugerem busca híbrida com modelo de embeddings multilíngue (100+ idiomas; português não nomeado explicitamente) — [Meilisearch language support](https://www.meilisearch.com/docs/resources/help/language); guia de dados multilíngues recomenda `localizedAttributes`/`locales` — [Meilisearch multilingual](https://meilisearch.com/docs/capabilities/indexing/how_to/handle_multilingual_data)
- Meilisearch: a issue #2144 (2022) era sobre tokenização não-ASCII, não stemming; fechada via PR #2468 — [GitHub #2144](https://github.com/meilisearch/meilisearch/issues/2144). Não encontrei issue específica pedindo stemming.
- Typesense: `"stem": true` em campo string usa o stemmer Snowball (baseado em regras); o idioma vem do `locale` do campo; dicionários de stemming customizados (JSONL, `stem_dictionary`) para formas irregulares; ressalva: regras podem prejudicar nomes próprios/marcas — [Typesense stemming](https://typesense.org/docs/30.2/api/stemming)
- Typesense: português listado com código `pt`; sem locale o campo é tratado como inglês; em locales não-ingleses acentos são mantidos, correspondência exata acentuada é priorizada e versão sem acento só casa via typo tolerance quando não há match acentuado — [Typesense locale guide](https://typesense.org/docs/guide/locale.html)
- Typesense: resposta de thread da comunidade diz que Snowball não tem variantes regionais, então pt-BR e pt-PT usam o mesmo stemmer `pt` — [Typesense threads](https://threads.typesense.org/t/29450057/hey-guys-about-the-stemming-feature-is-there-anyway-to-use-s) (fonte comunitária, resultado de busca resumido)
- Typesense: embeddings embutidos permitem busca híbrida; stemming não afeta embeddings — [Typesense system requirements](https://typesense.org/docs/guide/system-requirements.html), [stemming](https://typesense.org/docs/30.2/api/stemming)

### Inferences
- Para pt-BR, "bolsa/bolsas", "pesquisa/pesquisar" só casariam via stemming (Typesense) ou via sinônimos/typo (Meilisearch). Se stemming importa, Typesense com `locale: pt` ou Postgres `to_tsvector('portuguese')` (Snowball também) são mais diretos.
- Como Typesense prioriza acento exato, usuários digitando sem acento ("extensao") dependem de typo tolerance; testar isso com golden set.

### Gaps
- Não consegui confirmar na doc do Meilisearch a ausência explícita de stemming (apenas não é mencionado); verificar a página de tokenização/Charabia e issues "stemming" no GitHub.
- Páginas oficiais de sinônimos de Meilisearch/Typesense, ranking rules e facetas não foram abertas nesta rodada.
- Detalhes de Elasticsearch/OpenSearch (analisador `portuguese`, `light_portuguese` stemmer) não pesquisados; conhecimento geral apenas, sem citação.

## 2. RAM, ops, Docker, ARM, licenciamento, sincronização com Postgres

### Takeaway
Typesense guarda todo o índice em RAM (ocioso ~20 MB; 2–3x o tamanho dos campos buscáveis), trivial para milhares de documentos; Meilisearch usa LMDB mmap com RAM ≈ tamanho em disco recomendado. Licenças: Meilisearch CE MIT (só sharding é EE/BUSL), Typesense GPL-3.0, Elasticsearch com opção AGPL desde 2024, OpenSearch Apache 2.0. A sincronização é um custo operacional real que o Postgres elimina.

### Cited Findings
- Typesense: processo ocioso ~20 MB; keyword search precisa tipicamente de 2x–3x o tamanho dos campos pesquisáveis; índice inteiro em memória + cópia dos dados em disco; mínimo citado de 2 vCPUs; embeddings embutidos exigem 2–6 GB RAM, embeddings remotos só memória dos vetores (7 bytes/dimensão/registro) — [Typesense system requirements](https://typesense.org/docs/guide/system-requirements.html)
- Meilisearch: LMDB mapeado em memória, o SO gerencia a RAM real; RAM recomendada ≈ tamanho em disco; VIRT alto não indica falta de memória; deletar documentos não encolhe o banco — [Meilisearch storage](https://meilisearch.com/docs/learn/engine/storage)
- Meilisearch: investigação de memória mostrou crescimento de RSS por interação de alocadores LMDB/Meilisearch; mimalloc v3 via LD_PRELOAD ajudou — [Meilisearch blog](https://kubecon.meilisearch.com/blog/memory-leak-investigation)
- Meilisearch licença: docs oficiais dizem CE gratuita sob MIT, EE sob BUSL; sharding é a única feature exclusiva do EE, que "não pode ser usada livremente em produção" — [Meilisearch EE docs](https://www.meilisearch.com/docs/resources/self_hosting/enterprise_edition) (consultado 2026-11-02). Conflito: o README no GitHub, segundo resumo de busca, descreve CE como comercial/BUSL 1.1 — [GitHub README](https://github.com/meilisearch/meilisearch); arquivo LICENSE v1.33.1 (jan/2026) diz partes EE em BUSL 1.1 e o restante MIT — [Fossies LICENSE](https://fossies.org/linux/meilisearch/LICENSE). Leitura mais consistente: núcleo MIT, partes EE em BUSL.
- Typesense: licença GPL-3.0 segundo páginas de terceiros — [Railway](https://railway.com/deploy/typesense-docker) (fonte secundária; confirmar no GitHub). Imagem oficial `typesense/typesense`, tags 29.1/30.2 citadas.
- Elasticsearch: Elastic anunciou em 2024 AGPL como opção ao lado de ELv2 e SSPL; OpenSearch (fork do ES 7.10.2) é Apache 2.0 — [DevClass 2024-09-02](https://devclass.com/2024/09/02/elasticsearch-will-be-open-source-again-as-cto-declares-changed-landscape/)
- Algolia: plano Build gratuito com 10 mil pedidos de busca/mês e 1M de registros (fontes divergem; uma cita 50K); plano Grow pay-as-you-go com 10K buscas grátis, ~US$0,50 por 1K buscas extras; Build pode ser suspenso/atribuição ao exceder — [Algolia Build plan](https://www.algolia.com/pricing/build-plan), [Activepieces 2026](https://www.activepieces.com/blog/algolia-pricing-2026-plans-costs-and-examples). Confirmar valores atuais no site (não consegui abrir a página de preços).

### Inferences
- Para milhares de documentos, RAM de qualquer um dos dois é desprezível (dezenas a poucas centenas de MB); o custo real é um serviço a mais, backups, upgrades e reindex. Elasticsearch/OpenSearch (JVM) é desproporcional numa instância OCI pequena.
- Dupla escrita (Postgres + motor) gera risco de defasagem e de vazamento: indexar apenas campos de documentos públicos/publicados, remover do índice ao despublicar/arquivar, nunca expor a chave master do motor ao cliente (usar chave de busca restrita ou proxy via rota Next.js). Padrão simples: reindexação idempotente completa (job/cron) mais upsert/delete em hooks das Server Actions; com poucos milhares de docs, reindex total em segundos é viável.
- GPL-3.0 do Typesense não é problema ao usá-lo como serviço separado via HTTP; MIT do Meilisearch CE também seguro.

### Gaps
- Suporte a ARM64 (OCI Ampere): não confirmei para Typesense nem Meilisearch (nenhuma fonte encontrada); verificar tags multi-arch no Docker Hub.
- Não há números medidos de RAM para ~1–5 mil documentos em Meilisearch.
- Preços/limites do Typesense Cloud, Meilisearch Cloud e requisitos de memória de ES/OpenSearch não pesquisados.
- Mecanismos de sync (CDC, LISTEN/NOTIFY, outbox) não pesquisados com fontes.
- Busca híbrida e Postgres (pg_trgm, unaccent, tsvector portuguese, pgvector) como alternativa: sem fontes coletadas nesta rodada.

## 3. UX de busca e medição de qualidade

### Takeaway
A pesquisa da Baymard trata autocomplete como problema de relevância (não de velocidade de digitação) e aponta que páginas sem resultados são becos sem saída comuns; NN/g recomenda busca global visível quando busca com escopo falha. Para medição em site pequeno: golden set manual (~50 consultas frequentes + ~20 de zero resultados), taxa de zero resultados, e NDCG@10/Precision@1,3.

### Cited Findings
- Baymard: autocomplete existe em 80% dos sites de e-commerce, mas só 19% atingem desempenho máximo — [Baymard on-site search (via resumo)](https://baymard.com/research-articles/collections/on-site-search)
- Baymard: autocomplete é mais questão de relevância das sugestões do que de poupar digitação; qualidade das sugestões deve ser levada tão a sério quanto a dos resultados — [Baymard autocomplete](https://baymard.com/ecommerce-design-examples/88-search-autocomplete)
- Baymard (via Coveo): 68% dos sites têm "dead ends" em zero resultados; cerca de 50% não oferecem recuperação eficaz — [Coveo](https://coveo.com/blog/avoid-no-search-results-found/), [Baymard no-results](https://baymard.com/research-articles/no-results-page). Padrões de recuperação (categorias relacionadas, buscas alternativas, populares, suporte) vêm de resumo secundário, não verificado na Baymard.
- Nielsen (PDF antigo, não verificado no nngroup.com): busca com escopo é arriscada porque usuários ignoram o escopo; quando falha, ofereça forma muito visível de buscar no site todo — [PDF do capítulo](https://chnm.gmu.edu/digitalhistory/links/pdf/chapter4/4.26a.pdf)
- "Did you mean" (Hawksearch) dispara quando poucos resultados voltam, com limiares configuráveis — [Baymard/Hawksearch via busca]; fonte fraca.
- Medição: golden set com ~50 consultas de maior volume + ~20 de zero resultados; acompanhar Precision@1, @3 e NDCG@10; labels envelhecem e devem ser datados e revisados; logs reais são a melhor fonte de consultas; com baixo volume, usar golden set manual + amostra de logs — [Curiosity relevance evaluation](https://docs.curiosity.ai/workspace/evaluation/relevance-evaluation), [Gale](https://blog.gale.com/measuring-search-quality-part-1/), [QA Skills](https://qaskills.sh/blog/search-relevance-testing-golden-queries) (blogs/guias, qualidade média; snippets apenas)

### Inferences
- Plano barato: registrar (query normalizada, nº de resultados, clique/posição) em tabela Postgres; revisar semanalmente as top zero-result queries e alimentar sinônimos; manter ~30–50 consultas com resultados esperados rodando como teste Vitest, reportando P@1 e NDCG@10 antes/depois de mudanças.
- Ordenação "exato primeiro": ranking em camadas (match exato de título/slug > prefixo > palavras > fuzzy/stem), o que Postgres também consegue com `ts_rank` + `similarity`, e Meilisearch/Typesense entregam via regras de ranking.
- "Mostrando resultados para X" / "Você quis dizer": exige sugestão de correção; motores dedicados fazem typo-tolerance na própria query, mas mostrar a correção explícita requer lógica da aplicação (ex.: pg_trgm contra vocabulário de títulos/tags).

### Gaps
- Páginas Baymard/NN/g principais estão atrás de paywall ou não abertas; não obtive recomendações diretas e citáveis sobre "did you mean", "showing results for" e typeahead do NN/g (Alertbox).
- Guias do Algolia sobre UX (query suggestions, synonyms) não coletados.
- Nenhuma fonte primária sobre NDCG para sites pequenos além de blogs/guias.
