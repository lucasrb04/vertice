# Spec — Busca inteligente

- **Data:** 2026-11-02
- **Status:** Autorizada pelo autor ("pode seguir") após a pesquisa em `reports/Busca inteligente em português.md`.
- **Referências:** D36–D38, spec da vitrine §5.1 e §5.4, `src/lib/public/queries.ts`.

## 1. Intenção

A busca não pode ser rígida pelos caracteres. Pedido do autor: "casinha" deve sugerir "casa", e uma letra errada ainda precisa encontrar. Medido no banco do projeto: `casinha → casa` e `pyhton → python` falham hoje, e nenhum limiar de similaridade resolve, porque `pyhton/python` dá 0,29 e o falso positivo `casa/caso` dá 0,60.

## 2. Objetivos

1. Derivações, plurais e acentos: `programador`, `programação`, `programacao`, `robo`, `robôs`.
2. Erros de digitação, palavra a palavra, inclusive no meio de frase: `bolsa pyhton`.
3. Diminutivos: `casinha → casa`, `cafezinho → cafe`.
4. Sinônimos curados: `IC ↔ iniciação científica`, `engenheiro ↔ engenharia`, aproveitando `tag_aliases`.
5. Toda correção visível e reversível: **"Mostrando resultados para casa · buscar exatamente casinha"**.
6. Conjunto de avaliação versionado, com P@1, P@3, NDCG@10 e taxa de zero resultados.

## 3. Não-objetivos

Busca semântica e `pgvector` (condicional, depende do conjunto de avaliação), BM25, motores dedicados, autocomplete, log de consultas (depende de análise de LGPD; ver §7), tela de admin para sinônimos.

## 4. Anti-objetivos

- Corrigir palavra que existe: `casa` nunca vira `caso`.
- Sugerir palavra vinda de processo oculto.
- Resultado aproximado à frente de resultado exato.
- Encerrado à frente de aberto (D36).
- Quebrar `C++`, siglas, `100%`, filtros, paginação ou o caminho sem JavaScript.

## 5. Design

### 5.1. Índice

Tabela `search_documents`, uma linha por processo: `opportunity_id` (PK, FK cascade), `institution_id`, `document tsvector`, `updated_at`, com índice GIN. O vetor combina duas formas, porque `unaccent` antes do stemmer quebra derivações (`programação` vira `programaca`):

`to_tsvector('portuguese', texto) || to_tsvector('portuguese', unaccent(texto))`

Pesos: A título, sigla e tags; B nome do projeto, área e orientador; C descrição.

`refreshSearchDocument(tx, opportunityId)` roda na mesma transação de criar e editar processo e de editar projeto (todos os processos dele). `pnpm db:search:rebuild` reconstrói tudo, de forma idempotente, e também roda ao fim de `db:seed` e `db:seed:demo`. A visibilidade continua nos predicados da consulta, nunca no índice.

### 5.2. Vocabulário

Tabela `search_vocabulary` (`institution_id`, `word`, `frequency`; PK nas duas primeiras), com palavras de `to_tsvector('simple', unaccent(...))` **somente de processos públicos** (spec da vitrine §5.1). Reconstruída por `rebuildSearchVocabulary(institutionId)` depois de cada escrita, fora da transação; uma falha é registrada e não bloqueia a escrita.

### 5.3. Corretor (`src/lib/search/corrector.ts`)

Só em palavra com 4 letras ou mais que **não existe** no vocabulário nem nos sinônimos:

1. Sem diminutivo (`-zinho(s)`, `-zinha(s)`, `-inho(s)`, `-inha(s)`, restaurando `a`/`o`): aceita se existir no vocabulário.
2. `levenshtein_less_equal`, mesma primeira letra: distância 1 para 4 e 5 letras, 2 para 6 ou mais; com 5 letras, distância 2 só se as letras forem as mesmas em outra ordem (`blosa → bolsa`). Primeira letra diferente só com distância 1 em palavra de 6 ou mais letras (`oython → python`). Empate por menor distância e maior frequência. Sem isso, palavras reais fora do catálogo viravam outras: `avião → acao`, `nasa → casa`, `música → busca`.
3. Sem candidato: mantém a palavra.

Palavra entre aspas não é corrigida e busca o texto exato; as demais palavras da consulta seguem normais. `corrigir=0` na URL desliga a correção.

### 5.4. Consulta e ranqueamento

Termos expandidos por sinônimos e `tag_aliases`, cada termo nas duas formas (com e sem `unaccent`). Casa por FTS em OR ou por `LIKE` (mantido para `C++`, siglas e orientador). Ordem, depois de abertos antes de encerrados:

1. Texto exato em sigla, tag ou título, palavra completa.
2. Todos os termos em título ou tags.
3. Todos os termos no documento.
4. Algum termo.
5. Resultado vindo só de termo corrigido.

Dentro da camada, `ts_rank_cd` com normalização, depois recentes e `id`. Sinônimos ficam em `search_synonyms` (`institution_id`, `term`, `canonical`), com carga inicial no seed.

### 5.5. Interface

Em `/processos`, faixa acima dos resultados: **"Mostrando resultados para *casa* · buscar exatamente *casinha*"**. Sem resultados, mantém a saída atual. Sem JavaScript funciona, pois é um link.

### 5.6. Avaliação

`tests/search-eval/`: corpus fixo, ao menos 50 consultas com documentos esperados, cobrindo os casos desta spec e 10 de zero resultado. Teste Vitest calcula as métricas e falha se cair abaixo do piso registrado em `baseline.json`.

## 6. Critérios de aceite

1. `casinha`, `pyhton`, `bolsa pyhton`, `robotcia`, `algoritimo` e `progamação` encontram o esperado.
2. `casa` não é corrigida; "Estudo de caso" fica depois de "casa" exata.
3. Palavra exclusiva de processo oculto nunca aparece como correção.
4. Métricas acima da linha de base da busca anterior, sem nenhuma consulta regredir.
5. `pnpm lint`, `pnpm tsc --noEmit`, `pnpm test`, `pnpm test:e2e`, `pnpm build` passam.

## 7. Temas em aberto

- Quando pedir conta do aluno. Hipótese do autor: só quando o projeto faz seleção pela plataforma. Ordem proposta: candidatura e Kanban, perfil curto na primeira candidatura, match como bônus.
- Log de consultas sem IP ou sessão: útil para zero resultados, mas falta análise de LGPD.
- Busca semântica: decidir com as falhas conceituais do conjunto de avaliação; exige imagem com `pgvector`.
- Limiares do corretor são hipóteses até passar pela avaliação com consultas reais.
- Repetir a checagem de extensões na imagem de produção, possivelmente ARM64.
- Demais pendências: spec da vitrine §8.
