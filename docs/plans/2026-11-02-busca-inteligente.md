# Busca inteligente — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Busca tolerante a erros, derivações e diminutivos em PostgreSQL, com correção visível e qualidade medida.

**Architecture:** Índice e vocabulário em tabelas próprias, mantidos pelos serviços de escrita; corretor em `src/lib/search/`; `searchOpportunities` passa a usar as camadas da spec §5.4.

**Tech Stack:** PostgreSQL 16 (`fuzzystrmatch`, `pg_trgm`, `unaccent`), Drizzle, Vitest, Playwright.

**Spec:** [`docs/superpowers/specs/2026-11-02-busca-inteligente-design.md`](../superpowers/specs/2026-11-02-busca-inteligente-design.md)

## Global Constraints

- Somente pnpm. `src/lib/**` não importa `next/*`. Valores do usuário sempre como parâmetro SQL; `LIKE` escapado.
- Vetor em duas formas (spec §5.1); nunca `unaccent` encadeado antes do stemmer sozinho.
- Vocabulário só com processos públicos. Predicados de visibilidade seguem `publicOpportunitySql`/`openOpportunitySql`.
- D36: abertos sempre antes de encerrados. Palavra existente nunca é corrigida.
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Ao fim de cada task: `pnpm lint && pnpm tsc --noEmit && pnpm test` verdes; Task 4 também `pnpm test:e2e` e `pnpm build`, em sequência.

## Review Focus

1. Consulta só com sinais ou palavras muito comuns (`!!!`, `de`, `a`) não dá erro de `tsquery` nem zera a busca por `LIKE`. Teste na Task 3.
2. Palavra só de processo oculto não vira correção, e some do vocabulário quando o processo sai do público. Teste na Task 2.
3. Editar nome do projeto atualiza a busca de todos os seus processos. Teste na Task 2.
4. Falha ao reconstruir o vocabulário não impede salvar o processo. Teste na Task 2.
5. `vizinho`, `caminho`, `carinho` existentes no catálogo não perdem o sufixo. Teste na Task 3.

---

### Task 1: Conjunto de avaliação e linha de base

**Files:** Create `tests/search-eval/{corpus.ts,queries.ts,metrics.ts,baseline.json}`, `tests/integration/search-eval.test.ts`, `tests/unit/search-metrics.test.ts`.

**Produces:** `precisionAt(k, results, expected)`, `ndcgAt(k, results, expected)`, `evaluate(run)` → `{ p1, p3, ndcg10, zeroRate, perQuery }`; `corpus` (ao menos 30 processos fictícios, cobrindo os exemplos da spec); `queries` (ao menos 50, com `expected: slug[]`, 10 de zero resultado, e `category`: exata, derivacao, erro, diminutivo, sinonimo, zero).

- [ ] Unit das métricas com valores calculados à mão.
- [ ] Teste de integração roda `searchOpportunities` em todas as consultas, grava o resultado atual em `baseline.json` (script ou flag `UPDATE_BASELINE=1`), falha se qualquer métrica cair abaixo do piso. Registrar também `progamação`.
- [ ] Commit `test(busca): conjunto de avaliação e linha de base`.

### Task 2: Índice, vocabulário e sinônimos

**Files:** Create `src/db/schema/search.ts`, migration (inclui `CREATE EXTENSION IF NOT EXISTS fuzzystrmatch`), `src/lib/search/index-documents.ts`, `src/db/search-rebuild.ts`; Modify `src/lib/projects/service.ts`, `src/lib/opportunities/service.ts`, `src/db/seed.ts`, `src/db/seed-demo.ts`, `package.json`, `tests/helpers/db.ts` se preciso; Test `tests/integration/search-index.test.ts`.

**Produces:** `refreshSearchDocument(tx, opportunityId)`, `refreshProjectSearchDocuments(tx, projectId)`, `rebuildSearchDocuments(institutionId)`, `rebuildSearchVocabulary(institutionId)`, `scheduleVocabularyRebuild(institutionId): Promise<void>` (captura erro e registra); script `db:search:rebuild`. Sinônimos iniciais no seed.

- [ ] Testes que falham: criar, editar processo e editar projeto atualizam o documento; vocabulário inclui público e exclui oculto, e remove a palavra quando o processo vai para `UNDER_REVIEW` ou o projeto para `SUSPENDED`; falha do vocabulário não aborta a escrita; rebuild idempotente; `programador`, `programacao`, `robo` casam com o vetor.
- [ ] Implementar. Fixtures diretas de teste chamam rebuild quando precisarem.
- [ ] Commit `feat(busca): índice de documentos, vocabulário e sinônimos`.

### Task 3: Corretor e consulta em camadas

**Files:** Create `src/lib/search/corrector.ts`, `src/lib/search/query.ts`; Modify `src/lib/public/queries.ts`, `src/lib/public/search-params.ts`, `tests/search-eval/baseline.json`; Test `tests/unit/diminutive.test.ts`, `tests/integration/search-corrector.test.ts`, `tests/integration/public-queries.test.ts`.

**Produces:** `stripDiminutive(word): string[]`; `correctQuery(institutionId, q): Promise<{ original; corrected: string|null; terms: string[] }>`; `searchOpportunities` devolve também `correction: { original; corrected } | null`; `VitrineParams.exact: boolean` (`corrigir=0`).

- [ ] Testes que falham: corretor com os exemplos da spec §6 e Review Focus 5; `casa` intacta; frase mista; aspas; siglas curtas; camadas (exato antes de corrigido, aberto antes de encerrado); `!!!` e `de` sem erro; todos os testes atuais de `public-queries` seguem verdes.
- [ ] Implementar. Rodar avaliação, registrar nova linha de base; nenhuma consulta pode regredir.
- [ ] Commit `feat(busca): corretor por vocabulário e ranqueamento em camadas`.

### Task 4: Interface e documentação

**Files:** Modify `src/app/(public)/processos/page.tsx`; Create `src/components/vitrine/correction-notice.tsx`; Modify `docs/ARCHITECTURE.md` §6.3, `README.md`; Test `e2e/busca-inteligente.spec.ts`.

- [ ] E2E que falha: `casinha` mostra a faixa e o processo de casa; "buscar exatamente" remove a correção; `pyhton`; sem JS o link funciona; `casa` não mostra faixa.
- [ ] Implementar, atualizar documentos.
- [ ] Rodar tudo em sequência; commit `feat(busca): aviso de correção na vitrine`.
