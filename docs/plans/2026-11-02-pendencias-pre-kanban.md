# Pendências pré-Kanban Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar as pendências decididas em D41, D42 e D44 e os problemas conhecidos da vitrine antes de Candidatura + Kanban.

**Architecture:** Mudanças pequenas e independentes na vitrine, um `src/proxy.ts` para limitar buscas e uma tabela agregada de buscas sem resultado. A regra de "abre no futuro" fica em `src/lib/opportunities/status.ts`.

**Tech Stack:** Next.js 16 (App Router, `proxy.ts`), Drizzle + PostgreSQL 16, Vitest, Playwright.

**Spec:** `docs/DECISIONS.md` (D41, D42, D44) e `docs/superpowers/specs/2026-11-02-vitrine-design.md` §8.

## Global Constraints

- Textos em pt-BR. Datas no fuso de São Paulo (`src/lib/time.ts`).
- pnpm apenas. Chave primária `uuid` com `defaultRandom()`.
- Dockerfile, imagem de migrations e Caddy ficam fora: são da etapa de deploy.
- Candidatura ainda não existe: D41 aqui cobre só selo e edital.
- Telemetria e log nunca derrubam a página: falha é registrada e ignorada.
- Busca sem IP nem sessão no log (D42).

## Review Focus

1. Requisição sem IP válido: o limite não se aplica e a página responde normalmente.
2. `/processos` sem `q`, só com filtros, nunca conta no limite.
3. Abertura hoje, em São Paulo, perto da meia-noite UTC: já não mostra "Abre em".
4. Busca sem resultado com filtro ativo, em página maior que 1 ou com termo que parece dado pessoal: não é registrada.
5. Limpar o último filtro no celular: o painel continua aberto, com ou sem JS o formulário funciona.

---

### Task 1: Selo "Abre em dd/mm" e contraste do prazo

**Files:**
- Modify: `src/lib/opportunities/status.ts`, `src/lib/public/queries.ts`, `src/lib/public/labels.ts`, `src/components/vitrine/opportunity-card.tsx`, `src/app/(public)/processo/[slug]/page.tsx`, `src/components/projects/opportunity-row.tsx`, `src/db/seed-demo.ts`, `docs/DESIGN_SYSTEM.md`
- Test: `tests/unit/` (arquivo existente de status, ou `tests/unit/opportunity-status.test.ts`), `e2e/paginas-publicas.spec.ts`

**Interfaces:**
- Produces: `opensInFuture(applicationsOpenOn: string | null, now?: Date): boolean` e `opensOnLabel(day: string): string`, que devolve `"Abre em dd/mm"`. `PublicCard` ganha `applicationsOpenOn: string | null`.

- [ ] **Step 1: Escrever os testes que falham**

`opensInFuture(null) === false`; dia seguinte ao de hoje em São Paulo é `true`; o próprio dia é `false`, inclusive com `now = 2026-11-03T01:00:00Z` e abertura `2026-11-02` (ainda dia 2 em São Paulo, resultado `false`) e abertura `2026-11-03` no mesmo `now` (`true`). `opensOnLabel("2026-11-20") === "Abre em 20/11"`.

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `pnpm test:unit`
Expected: FAIL, função inexistente.

- [ ] **Step 3: Implementar**

`opensInFuture` compara strings `YYYY-MM-DD` com `todayInSaoPaulo(now)`. Levar `applicationsOpenOn` ao `PublicCard` em todas as queries de card. O processo continua aberto: `isOpen` não muda. No card, com processo aberto e abertura futura, o selo aparece no lugar da contagem de prazo, sem destaque âmbar. Na página do processo, o selo aparece acima do prazo e "Acessar edital" continua disponível.

Trocar `text-amber-600` por `text-amber-700` nos três usos e registrar em `docs/DESIGN_SYSTEM.md` §2 que texto de prazo usa `amber-700` (D44).

Adicionar ao seed de demonstração o processo `demo-abertura-futura` com `schedule.opens` positivo e prazo posterior.

- [ ] **Step 4: E2E**

Em `e2e/paginas-publicas.spec.ts`: criar processo com abertura futura e conferir "Abre em" na lista e na página, com o link do edital visível.

Run: `pnpm test:unit && pnpm test:e2e e2e/paginas-publicas.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -m "feat(vitrine): selo de abertura futura e contraste do prazo"`

### Task 2: Filtros no celular e foco de teclado

**Files:**
- Create: `src/components/vitrine/filters-disclosure.tsx`, `src/components/vitrine/sort-select.tsx`
- Modify: `src/components/vitrine/filters.tsx`, `src/components/vitrine/carousel.tsx`, `src/app/(public)/processos/page.tsx`
- Test: `e2e/processos.spec.ts`, `e2e/home.spec.ts`

**Interfaces:**
- Produces: `FiltersDisclosure({ defaultOpen, className, children })` e `SortSelect({ value, options })`, com `options: { value: string; label: string }[]`.

- [ ] **Step 1: Escrever os E2E que falham**

No viewport de celular, abrir filtros, marcar uma categoria, desmarcar: `details` segue aberto. Mudar a ordenação pelo teclado: o `select#ordenacao` segue com foco e mostra a opção da URL. Avançar o carrossel pelo teclado até o fim: o botão "Ver próximos" segue focado, e Enter não rola nem dá erro. Mudar a ordenação e voltar com o histórico do navegador: o seletor acompanha a URL.

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `pnpm test:e2e e2e/processos.spec.ts e2e/home.spec.ts`
Expected: FAIL nos novos casos.

- [ ] **Step 3: Implementar**

`FiltersDisclosure` é client e guarda `open` em estado iniciado por `defaultOpen`, atualizado em `onToggle`. O SSR continua entregando `<details>`, então funciona sem JS.

`SortSelect` é client e controlado: estado local sincronizado com a prop `value`. Sai o `key={sortValue}`, que remonta o select e perde o foco. Mantém `id="ordenacao"` e `name="sort"`, e o `change` continua chegando ao `AutoSubmit`.

No carrossel, trocar `disabled` por `aria-disabled` com clique sem efeito e estilo equivalente ao desabilitado, e remover o efeito que move o foco. O botão não perde foco, então nada precisa ser movido.

- [ ] **Step 4: Rodar e confirmar**

Run: `pnpm test:e2e e2e/processos.spec.ts e2e/home.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -m "fix(vitrine): filtros no celular e foco de teclado"`

### Task 3: Limite de buscas, trava do seed e versão do Node

**Files:**
- Create: `src/proxy.ts`, `src/lib/security/request-ip.ts`, `src/lib/security/search-limit.ts`
- Modify: `src/lib/security/audit.ts`, `src/db/seed-demo.ts`, `package.json`, `README.md`
- Test: `tests/unit/search-limit.test.ts`, `tests/integration/seed-demo.test.ts`

**Interfaces:**
- Consumes: `createRateLimiter` de `src/lib/security/rate-limit.ts`.
- Produces: `getRequestIp` passa a morar em `request-ip.ts`, com reexport em `audit.ts`, para o proxy não carregar o banco. `isSearchRateLimited(url: URL, headers: Headers, limiter?: RateLimiter): boolean`. `isLocalDatabaseUrl(url: string): boolean`.

- [ ] **Step 1: Escrever os testes que falham**

`SEARCH_LIMIT_PER_MINUTE = 120`. Com limiter de teste: 120 buscas com `q` do mesmo IP passam e a 121ª é limitada; outro IP passa; `/processos` sem `q` ou com `q` só de espaços nunca é limitado nem consome; requisição sem IP válido nunca é limitada.

`isLocalDatabaseUrl`: `true` para `localhost`, `127.0.0.1` e `[::1]`; `false` para `postgres`, um domínio qualquer e URL inválida. `runDemoSeed` recusa banco não local, mesmo fora de produção.

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `pnpm test:unit && pnpm test:integration tests/integration/seed-demo.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`src/proxy.ts` usa `matcher: "/processos"`. Quando limitado, responde 429 com `Retry-After: 60` e texto "Muitas buscas em pouco tempo. Tente de novo em um minuto.". O limiter é único por processo, coerente com a instância única de D22.

O limite considera só buscas com `q`, a parte cara. O valor é alto porque o campus pode compartilhar um IP.

`pnpm db:seed:demo` lê a URL da mesma variável usada por `src/db/index.ts`.

Em `package.json`: `"engines": { "node": ">=22.9" }`. No README, citar o requisito de Node e que o limite depende do Caddy reescrever `x-forwarded-for`.

- [ ] **Step 4: Rodar e confirmar**

Run: `pnpm test && pnpm build`
Expected: PASS, com `proxy` listado na saída do build.

- [ ] **Step 5: Commit**

`git commit -m "feat(seguranca): limite de buscas e trava do seed de demonstração"`

### Task 4: Log de buscas sem resultado

**Files:**
- Create: `src/lib/search/zero-results.ts`, migration gerada em `drizzle/`
- Modify: `src/db/schema/search.ts`, `src/app/(public)/processos/page.tsx`, `docs/ARCHITECTURE.md`
- Test: `tests/integration/zero-results.test.ts`, `tests/integration/schema.test.ts`

**Interfaces:**
- Consumes: `normalizeQuery`, `todayInSaoPaulo`.
- Produces: tabela `search_zero_results` (`id` uuid, `institution_id`, `term varchar(120)`, `day date`, `count integer not null default 1`, único por `institution_id, term, day`, índice em `day`). `shouldLogZeroResult(params: VitrineParams, total: number): boolean`. `recordZeroResult(institutionId: string, rawQuery: string, now?: Date): Promise<void>`.

- [ ] **Step 1: Escrever os testes que falham**

`recordZeroResult(id, "  Robótica  Quântica ")` grava o termo normalizado com `count = 1`; repetir no mesmo dia dá `count = 2`; em outro dia cria nova linha. Linhas com `day` mais antigo que 90 dias são apagadas ao gravar, e a de exatamente 90 dias fica.

Não grava: termo com `@`, termo com 6 ou mais dígitos no total (CPF e telefone formatados incluídos), termo normalizado vazio, termo com mais de 120 caracteres.

`shouldLogZeroResult` é `true` só com `total === 0`, `q` não vazio, página 1 e nenhum filtro ativo. `corrigir=0` não impede o registro.

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `pnpm test:integration tests/integration/zero-results.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Gerar a migration com `pnpm db:generate` e atualizar a lista de tabelas em `tests/integration/schema.test.ts`. `recordZeroResult` faz upsert e apaga o que passou de 90 dias na mesma chamada, porque não há agendador no projeto.

Em `/processos`, chamar dentro de `after()`, com `try/catch` que registra a falha, como em `src/app/(public)/processo/[slug]/page.tsx`. A página não espera a gravação.

Documentar a tabela e a retenção em `docs/ARCHITECTURE.md`.

- [ ] **Step 4: Rodar e confirmar**

Run: `pnpm lint && pnpm tsc --noEmit && pnpm test && pnpm test:e2e && pnpm build`
Expected: tudo PASS.

- [ ] **Step 5: Commit**

`git commit -m "feat(busca): log agregado de buscas sem resultado"`
