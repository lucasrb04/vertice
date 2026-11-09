# Identidade Ipê Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar a identidade visual inteira do Vértice pela identidade Ipê e transformar a página inicial na lista de
processos com filtros laterais, abas e cards largos.

**Architecture:** Tokens novos em `globals.css` (com a escala `stone-*` remapeada para os neutros quentes, de modo que
nada fique no cinza antigo durante a migração), componentes `ui/` restilizados, casca única (`Shell`), e a vitrine
movida de `/processos` para `/` mantendo o formulário GET + `AutoSubmit`. As demais páginas migram por grupo, sem
mudar funcionamento.

**Tech Stack:** Next.js App Router, Tailwind v4, shadcn/ui (Radix), lucide-react, Drizzle, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-09-identidade-ipe-design.md` (mockup em
`docs/superpowers/specs/assets/2026-11-09-processos-mockup.html`).

## Global Constraints

- Cores exatamente as da tabela "Cores" da spec; amarelo `#f4bf3a` nunca é cor de texto; texto sobre amarelo é `ink`.
- Títulos Bricolage Grotesque, texto Figtree, via `next/font/google`; nenhuma `font-mono` na interface (use `tabular-nums`).
- Casca única `max-w-[1320px]`, margem 16px (celular) / 24px (≥ sm).
- Ícones só de `lucide-react`, 16–18px, mesmo traço.
- Craft floor: sem kicker acima de título, sem texto em gradiente, sem borda lateral colorida > 1px, sem sombra dura.
- Textos em pt-BR; termos "processo", "projeto", "candidatura", "Edital"; nada de números ou depoimentos inventados.
- Toda página sem rolagem horizontal a 360px; foco visível de 3px `ink` em tudo que é interativo.
- Funcionamento, rotas (exceto `/processos` → `/`), validações e textos de ação das páginas não mudam.

## Review Focus

- Filtros que deixam a lista vazia numa aba (ex.: "Abrem em breve" com categoria sem nenhum): a aba mostra o vazio
  próprio e o link "Ver todos os abertos", não o vazio genérico. Teste no Task 5.
- Etiqueta "x" de um filtro numa URL com `page=3`: remover volta à página 1 e mantém `situacao` e a ordem. Teste no Task 3.
- Projeto sem sigla e com nome de uma palavra só ou com preposições ("Grupo de Dados Abertos" → "GDA", "Robótica" → "R").
  Teste no Task 3.
- Título e nome de projeto longos (160 caracteres sem espaço) no card a 360px: quebram sem rolagem horizontal. Teste no Task 5.
- Busca com caracteres de regex (`c++`, `(`) realçada no card: não quebra a página nem realça errado. Teste no Task 3.

---

### Task 1: Fundação visual (tokens, fontes, marca e componentes `ui/`)

**Files:**
- Modify: `src/app/globals.css`, `src/app/layout.tsx`
- Create: `src/app/icon.svg`, `src/components/layout/brand.tsx`, `src/components/layout/shell.tsx`
- Modify: `src/components/ui/{button,badge,input,textarea,select,checkbox,dialog,alert-dialog,dropdown-menu,popover,command,input-group,label}.tsx`
- Modify: todos os arquivos com `font-mono` em `src/` (troca por `tabular-nums`, revisando cada um)
- Test: `tests/unit/brand.test.tsx`

**Interfaces:**
- Produces: tokens Tailwind `bg-ground`, `bg-surface`, `bg-surface-2`, `text-ink`, `text-ink-2`, `text-ink-3`,
  `border-line`, `border-line-strong`, `bg-ipe`, `bg-ipe-hover`, `bg-ipe-soft`, `bg-rosa-soft`, `text-rosa-ink`,
  `bg-money-soft`, `text-money-ink`, `bg-urgent-soft`, `text-urgent-ink`, `bg-danger-soft`, `text-danger-ink`;
  utilitário `shadow-card` e `shadow-card-hover`; `font-heading` = Bricolage, `font-sans` = Figtree.
- Produces: `<Brand />` (marca + "vértice", link para `/`, `aria-label="Vértice, início"`), `<BrandMark className />`
  (só o SVG), `<Shell className children />` (`mx-auto w-full max-w-[1320px] px-4 sm:px-6`).
- Produces: `buttonVariants` com `variant: "default" | "outline" | "ink" | "secondary" | "ghost" | "destructive" | "link"`
  e `size: "default" (h-10) | "sm" (h-9) | "lg" (h-11) | "xs" | "icon" | "icon-sm" | "icon-lg" | "icon-xs"`; `default` =
  fundo `ipe`, texto `ink`; `destructive` = `danger-soft`/`danger-ink` com borda `danger-ink/25`.

- [ ] **Step 1: Write the failing test** `tests/unit/brand.test.tsx`: `renderToStaticMarkup(<Brand />)` contém
  `href="/"`, `aria-label="Vértice, início"` e o texto `vértice`; `<BrandMark />` tem `aria-hidden="true"`.
- [ ] **Step 2: Run** `pnpm vitest run tests/unit/brand.test.tsx` — Expected: FAIL (módulo inexistente).
- [ ] **Step 3: Implement** tokens em `globals.css` (`:root` com os valores da spec; `@theme inline` expondo os nomes
  acima; `--color-stone-50…950` remapeados: 50 `#f5f2ec`, 100 `#f6f3ee`, 200 `#e6e0d4`, 300 `#cfc7b8`, 400 `#a39a8b`,
  500 `#6f675b`, 600 `#5a5348`, 700 `#463f35`, 800 `#2f2a23`, 900 `#1f1b16`, 950 `#14110d`; `--color-brand: #1f1b16`;
  shadcn `--primary` = ipê com `--primary-foreground` ink, `--ring` ink, `--destructive` `#b42318`; `::selection` em
  `ipe-soft`; `:focus-visible` global 3px ink offset 2px; `body` em `ground`). Fontes no `layout.tsx`
  (`Bricolage_Grotesque` 500–800, `Figtree` 400–700; remover Inter, Plus Jakarta e JetBrains). Marca e `Shell`.
  `icon.svg` = quadrado `#f4bf3a` raio 10/34 com o "V" e o ponto de `brand.tsx`. Restilizar os `ui/` conforme a seção
  "Forma" da spec (campos h-11, raio 10px, texto 16px, foco com borda ink; diálogos raio 16px com `shadow-card-hover`).
  Trocar cada `font-mono` por `tabular-nums` (ou removê-lo onde não há número).
- [ ] **Step 4: Run** `pnpm vitest run tests/unit/brand.test.tsx && pnpm tsc --noEmit; echo TSC=$?` — Expected: PASS, `TSC=0`.
- [ ] **Step 5: Commit** `feat(ui): fundação da identidade Ipê (tokens, fontes, marca, componentes)`.

### Task 2: Casca (cabeçalho, rodapé, menu)

**Files:**
- Modify: `src/components/layout/site-header.tsx`, `site-footer.tsx`, `user-menu.tsx`, `src/app/layout.tsx`
- Create: `src/components/layout/nav-pill.tsx`, `src/lib/navigation.ts`
- Test: `tests/unit/navigation.test.ts`, `e2e/entrada.spec.ts`, `e2e/home.spec.ts` (bloco de cabeçalho)

**Interfaces:**
- Consumes: `Brand`, `Shell`, tokens (Task 1).
- Produces: `isNavActive(href: "/" | "/publicar" | "/minhas-candidaturas" | "/painel", pathname: string): boolean`
  (`/` ativo em `/` e `/processo/…`; demais por prefixo de segmento). `<NavPill href label className? />` client,
  `aria-current="page"` quando ativo, fundo `ipe` ativo, contorno inativo.

- [ ] **Step 1: Write the failing test** `navigation.test.ts`: `isNavActive("/", "/")` true; `("/", "/processo/x")`
  true; `("/", "/processos")` true; `("/", "/painel")` false; `("/painel", "/painel")` true; `("/painel", "/painelx")`
  false; `("/publicar", "/publicar")` true.
- [ ] **Step 2: Run** `pnpm vitest run tests/unit/navigation.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** `isNavActive`, `NavPill` (via `usePathname`), cabeçalho conforme spec "Casca": barra
  `bg-surface rounded-[20px] shadow-card` dentro de `Shell` com `mt-4`/`mt-5`; esquerda `Brand` + pílulas "Processos" e
  "Publicar processo"; direita com sessão pílulas "Minhas candidaturas" e "Painel" (`hidden min-[1100px]:inline-flex`)
  + `UserMenu`; sem sessão "Publicar processo" `hidden sm:inline-flex` e pílula "Entrar". Rodapé sobre `ground` com
  `BrandMark` 20px, frase atual e link da Privacidade. `UserMenu`: gatilho = avatar 44px (iniciais em `rosa-soft`/`rosa-ink`).
  `layout.tsx`: `main` sem fundo próprio.
- [ ] **Step 4: Update E2E** em `entrada.spec.ts` para os nomes de link atuais (sem mudança de texto, só confirme que
  os seletores por papel/nome continuam passando) e adicione em `home.spec.ts` o teste
  `"a pílula Processos fica marcada como página atual"`: `getByRole("link", { name: "Processos" })` tem
  `aria-current="page"` em `/`.
- [ ] **Step 5: Run** `pnpm vitest run tests/unit/navigation.test.ts && pnpm exec playwright test e2e/entrada.spec.ts` — Expected: PASS.
- [ ] **Step 6: Commit** `feat(ui): cabeçalho e rodapé da identidade Ipê`.

### Task 3: Dados da vitrine (parâmetros, consultas e rótulos)

**Files:**
- Modify: `src/lib/public/search-params.ts`, `src/lib/public/queries.ts`, `src/lib/public/labels.ts`
- Create: `src/lib/public/highlight.ts`, `src/lib/projects/initials.ts`
- Test: `tests/unit/vitrine-params.test.ts`, `tests/unit/public-labels.test.ts`, `tests/unit/highlight.test.ts`,
  `tests/unit/project-initials.test.ts`, `tests/integration/public-queries.test.ts`

**Interfaces:**
- Produces: `VitrineSituation = "" | "encerrando" | "em-breve"`; `VitrineParams.situation: VitrineSituation` (parâmetro
  de URL `situacao`; inválido → `""`); `vitrineHref` passa a devolver `/` ou `/?…` (inclui `situacao` quando não vazio).
- Produces: `PublicCard` ganha `excerpt: string` (via `plainTextExcerpt(description, 180)`), `publishedAt: Date`
  (`createdAt`), `maxSemester: number | null`, `internalSelectionEnabled: boolean`, `hasExternalUrl: boolean`.
- Produces: `searchOpportunities(...)` devolve também `situationCounts: { all: number; closing: number; soon: number }`
  e `categoryCounts: Record<ProjectCategory, number>` (cada uma com os mesmos filtros e busca, mudando só a dimensão:
  abas ignoram `situation`; categorias ignoram `categories`, mas respeitam `situation`).
- Produces: `listFilterOptions` → `courses: { code; name; institute }[]` ordenado por instituto e nome.
- Produces: `deadlineChip(deadlineAt, now)` → `{ text, urgent }` com "Encerra hoje" / "Encerra amanhã" /
  "Encerra em N dias", `urgent` quando N ≤ 3; `deadlineDate(deadlineAt): string` → "12 nov" (dia + mês abreviado sem
  ponto, Brasília); `publishedLabel(publishedAt, now): string` → "Publicado hoje" | "Publicado ontem" |
  "Publicado há N dias" (N ≤ 30) | "Publicado em 3 out"; `applicationRouteLabel(card): "Inscrição pelo Vértice" |
  "Edital externo" | "Pelo Vértice ou pelo edital"`; `coursesLabel(courseCount): string`.
- Produces: `projectInitials(name: string, acronym: string | null): string` (sigla se houver, senão até 3 iniciais
  ignorando `de, da, do, das, dos, e, em, para, a, o`, maiúsculas pt-BR).
- Produces: `highlightParts(text: string, q: string): { text: string; hit: boolean }[]` (termos ≥ 2 letras, sem
  acento e sem caixa, escapando regex).

- [ ] **Step 1: Write the failing tests:**
  - `vitrine-params`: `parseVitrineParams({ situacao: "encerrando" }).situation === "encerrando"`; `{ situacao: "x" }` → `""`;
    `vitrineHref(base)` === `"/"`; `vitrineHref({...base, situation: "em-breve", page: 3}, { categories: [] })` ===
    `"/?situacao=em-breve"`; `vitrineHref({...base, q: "robô", page: 3, sort: "deadline"}, { q: "" })` ===
    `"/?sort=deadline"`.
  - `public-labels`: `deadlineChip` em D+1 → `{ text: "Encerra amanhã", urgent: true }`, D+3 urgente, D+4 não;
    `deadlineDate(endOfDay("2026-11-12"))` === `"12 nov"`; `publishedLabel` para hoje, ontem, 5 dias e 40 dias
    (`"Publicado em 3 out"`); `applicationRouteLabel` nas três combinações; `coursesLabel(0|1|4)`.
  - `project-initials`: `("Grupo de Dados Abertos", null)` → `"GDA"`; `("Robótica", null)` → `"R"`;
    `("x", "LRM")` → `"LRM"`; `("laboratório de óptica e física aplicada", null)` → `"LÓF"`.
  - `highlight`: `highlightParts("Robôs agrícolas", "robo")` → `[{text:"Robô",hit:true},{text:"s agrícolas",hit:false}]`;
    `highlightParts("C++ e Python", "c++")` realça `"C++"`; `highlightParts("abc", "(")` → `[{text:"abc",hit:false}]`.
  - `public-queries` (integração): `situation: "encerrando"` só traz prazo ≤ 7 dias já recebendo inscrições;
    `"em-breve"` só `applicationsOpenOn` futuro; `situationCounts` e `categoryCounts` batem com listas filtradas
    equivalentes e respeitam `q` e `scholarship`; card traz `excerpt` sem Markdown, `publishedAt`, `hasExternalUrl`;
    `listFilterOptions` traz `institute`.
- [ ] **Step 2: Run** `pnpm vitest run tests/unit/vitrine-params.test.ts tests/unit/public-labels.test.ts tests/unit/highlight.test.ts tests/unit/project-initials.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** os itens de "Produces". `situation` entra em `filtersSql`: `encerrando` = aberto, não
  `opensInFuture`, `deadline_at` até o fim do dia D+7 em Brasília; `em-breve` = `applications_open_on > hoje`
  (Brasília). Contagens com `count(*) filter (where …)` numa só consulta por dimensão.
- [ ] **Step 4: Run** `pnpm vitest run tests/unit tests/integration/public-queries.test.ts` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(vitrine): situação, contagens e dados novos do card`.

### Task 4: A lista vira a página inicial

**Files:**
- Modify: `src/app/(public)/page.tsx` (passa a ser a vitrine), `src/app/(public)/processos/page.tsx` (só redireciona),
  `src/proxy.ts` (matcher `/` e link `/`), `src/components/vitrine/auto-submit.tsx` (navega para `/`),
  `src/components/vitrine/search-box.tsx` (`action="/"`), `src/components/vitrine/empty-results.tsx`, `pagination.tsx`,
  `src/app/(student)/painel/page.tsx` (link "Ver processos abertos" → `/`)
- Delete: `src/components/vitrine/home-row.tsx`, `carousel.tsx`; `listHomeRows` em `queries.ts` e seus testes
- Test: `e2e/processos.spec.ts` (migrado), `tests/unit/search-limit.test.ts`, `tests/unit/next-path.test.ts`

**Interfaces:**
- Consumes: `VitrineParams.situation`, `situationCounts`, `categoryCounts` (Task 3).
- Produces: rota `/` com o formulário GET `id="filtros-processos"` e `action="/"`; `/processos?x` →
  `permanentRedirect("/?x")`.

- [ ] **Step 1: Write the failing E2E** em `processos.spec.ts`: `"/processos com filtros redireciona para / com os
  mesmos parâmetros"` (`page.goto("/processos?category=PET&q=robo")` termina em `/?category=PET&q=robo`); trocar todo
  `goto("/processos…")` por `goto("/…")` e expectativas de URL `/processos?` por `/?`. Teste
  `"sem filtros, a lista começa pelo último publicado"` (fixture com três processos de datas diferentes).
- [ ] **Step 2: Run** `pnpm exec playwright test e2e/processos.spec.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** a página `/` reaproveitando o corpo atual de `processos/page.tsx` (layout antigo por ora;
  Task 5 troca os componentes), redirect, proxy (`config.matcher: "/"`), `AutoSubmit` (`router.replace(qs ? "/?"+qs : "/")`),
  remoções. Remover de `home.spec.ts` os testes de slogan, atalhos de categoria e carrossel; manter o do atalho "/" e o
  de "busca envia", agora esperando `/?q=`.
- [ ] **Step 4: Run** `pnpm exec playwright test e2e/processos.spec.ts e2e/home.spec.ts e2e/busca-inteligente.spec.ts && pnpm vitest run tests/unit` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(vitrine): a lista de processos passa a ser a página inicial`.

### Task 5: Componentes da vitrine Ipê

**Files:**
- Create: `src/components/vitrine/filter-panel.tsx` (server), `filter-sheet.tsx` (client), `active-filters.tsx`,
  `situation-tabs.tsx`, `project-tile.tsx`, `publish-tip.tsx` (client, cookie `vertice_dica_publicar=0`, 1 ano),
  `highlighted.tsx`
- Modify: `opportunity-card.tsx`, `filters.tsx` (vira o conteúdo dos grupos ou é absorvido por `filter-panel.tsx`),
  `filters-disclosure.tsx`, `sort-select.tsx`, `pagination.tsx`, `correction-notice.tsx`, `empty-results.tsx`,
  `search-box.tsx`, `src/app/(public)/page.tsx`
- Test: `e2e/home.spec.ts` (novo comportamento), `e2e/processos.spec.ts`

**Interfaces:**
- Consumes: tudo do Task 3; `Button`, tokens (Task 1).
- Produces: `<ProjectTile category name acronym size?: "md" | "lg" | "sm" />` (60/48 px; `lg` 72px para páginas de
  projeto/processo), cores por categoria da spec; `<OpportunityCard card q? selectedTags? />` usado também nas páginas
  de projeto; `CATEGORY_COLORS: Record<ProjectCategory, { bg: string; ink: string }>` em `project-tile.tsx`.

- [ ] **Step 1: Write the failing E2E** em `home.spec.ts`:
  - `"sem filtros não mostra Filtrando por nem Limpar tudo"`;
  - `"marcar categoria mostra Filtrando por; o x da etiqueta volta ao estado limpo"` (URL volta a `/`);
  - `"abas filtram e contam"` (fixture: um processo encerrando em 2 dias, um abrindo no futuro, um comum; contadores
    3/1/1; clicar "Abrem em breve" deixa só o futuro e marca `aria-current`);
  - `"aba vazia oferece ver todos os abertos"`;
  - `"fechar a dica para quem publica persiste após recarregar"`;
  - `"no celular, Filtros abre a folha, Esc fecha e devolve o foco"` (viewport 390×844);
  - `"card com título e projeto de 160 caracteres não cria rolagem horizontal a 360px"`;
  - `"termo buscado aparece realçado no título"` (`mark` com o texto).
- [ ] **Step 2: Run** `pnpm exec playwright test e2e/home.spec.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** conforme spec (seções "Página inicial" e "Card de processo") e o mockup. Painel desktop
  `sticky top-5` só quando `lg`; folha < 1100px como diálogo Radix (`Dialog`) cujos campos usam `form="filtros-processos"`;
  sem JS (`:not([data-js])`) o painel aparece colapsado acima da lista. Botão "Aplicar" só sem JS, como hoje. h1 com
  a contagem. Entrada dos cards: `animate-in` de 280ms `cubic-bezier(.16,1,.3,1)` desativada por `motion-reduce`.
- [ ] **Step 4: Run** `pnpm exec playwright test e2e/home.spec.ts e2e/processos.spec.ts e2e/busca-inteligente.spec.ts` — Expected: PASS.
- [ ] **Step 5: Visual check** screenshots 1440 e 390 (padrão, filtrado, vazio, folha aberta) comparados ao mockup.
- [ ] **Step 6: Commit** `feat(vitrine): painel de filtros, abas e cards da identidade Ipê`.

### Task 6: Páginas públicas de processo e projeto

**Files:**
- Modify: `src/app/(public)/processo/[slug]/page.tsx`, `src/app/(public)/projeto/[slug]/page.tsx`,
  `src/components/vitrine/{requirements,schedule,safe-markdown}.tsx`, `src/components/moderation/report-dialog.tsx`
- Test: `e2e/paginas-publicas.spec.ts`

**Interfaces:**
- Consumes: `ProjectTile` (lg), `OpportunityCard`, `deadlineChip`, `deadlineDate` (Tasks 3 e 5).

- [ ] **Step 1: Write the failing E2E** `"processo: a ação principal fica no card de inscrição"` (desktop: o botão
  "Candidatar-se" ou "Abrir edital" está dentro de `getByRole("complementary", { name: "Inscrição" })`) e
  `"projeto lista seus processos como cards"`.
- [ ] **Step 2: Run** `pnpm exec playwright test e2e/paginas-publicas.spec.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** o layout da spec ("Processo" e "Projeto") mantendo todo o conteúdo, a telemetria e os avisos atuais.
- [ ] **Step 4: Run** `pnpm exec playwright test e2e/paginas-publicas.spec.ts e2e/candidatura.spec.ts e2e/denuncia.spec.ts` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(ui): páginas de processo e projeto na identidade Ipê`.

### Task 7: Páginas do aluno e login

**Files:**
- Modify: `src/app/(auth)/entrar/page.tsx`, `src/components/layout/sign-in-button.tsx`,
  `src/app/(student)/painel/page.tsx`, `src/app/(student)/minhas-candidaturas/page.tsx`,
  `src/app/(student)/processo/[slug]/candidatar/page.tsx`, `src/components/applications/{apply-form,application-funnel}.tsx`
- Test: `e2e/entrada.spec.ts`, `e2e/candidatura.spec.ts`, `e2e/auth.spec.ts`

**Interfaces:**
- Consumes: `ProjectTile`, `Shell`, `Button` (Tasks 1 e 5). `listMyApplications` precisa expor `category`, `projectAcronym`
  se ainda não expõe (adicionar ao tipo e à consulta, com asserção no teste de integração `application-queries.test.ts`).

- [ ] **Step 1: Write the failing test** em `application-queries.test.ts`: item de `listMyApplications` tem `category`
  e `projectAcronym`.
- [ ] **Step 2: Run** `pnpm vitest run tests/integration/application-queries.test.ts` — Expected: FAIL (se os campos faltarem; se já existirem, siga).
- [ ] **Step 3: Implement** o layout da spec (Entrar centrado; painel com metades em `surface`; candidaturas em cards
  com tile; funil com etapa atual em `ipe`; formulário de candidatura em card).
- [ ] **Step 4: Run** `pnpm vitest run tests/integration/application-queries.test.ts && pnpm exec playwright test e2e/entrada.spec.ts e2e/candidatura.spec.ts e2e/auth.spec.ts` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(ui): login, painel e candidaturas na identidade Ipê`.

### Task 8: Páginas de quem publica (publicar, gestão, Kanban)

**Files:**
- Modify: `src/app/(organizer)/**/page.tsx`, `src/components/projects/*.tsx`, `src/components/applications/{board,move-dialog}.tsx`,
  `src/components/tags/tag-combobox.tsx`
- Test: `e2e/publicar.spec.ts`, `e2e/painel-projeto.spec.ts`, `e2e/kanban.spec.ts`

**Interfaces:**
- Consumes: `ProjectTile`, `Shell`, `Button` (destrutivo novo), campos `ui/` (Task 1).

- [ ] **Step 1: Write the failing E2E** em `kanban.spec.ts`: `"o quadro fica alinhado ao cabeçalho"` (a borda esquerda
  da primeira coluna e a do cabeçalho diferem em até 1px a 1440px) e em `painel-projeto.spec.ts`
  `"a gestão mostra as abas do projeto com a atual marcada"` (`aria-current="page"`).
- [ ] **Step 2: Run** `pnpm exec playwright test e2e/kanban.spec.ts e2e/painel-projeto.spec.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** formulários em cards de seção, cabeçalho de gestão com tile e abas em pílula, Kanban em
  colunas `surface-2` com cards brancos na largura da casca.
- [ ] **Step 4: Run** `pnpm exec playwright test e2e/publicar.spec.ts e2e/painel-projeto.spec.ts e2e/kanban.spec.ts` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(ui): publicação, gestão e Kanban na identidade Ipê`.

### Task 9: Admin, privacidade, erro e 404

**Files:**
- Modify: `src/app/admin/**/page.tsx`, `src/components/moderation/{admin-queue,moderation-dialog}.tsx`,
  `src/app/(public)/privacidade/page.tsx`, `src/app/{error,global-error,not-found}.tsx`
- Test: `tests/unit/error-pages.test.tsx`, `tests/unit/privacy-page.test.tsx`, `e2e/admin-moderacao.spec.ts`

- [ ] **Step 1: Run** `pnpm vitest run tests/unit/error-pages.test.tsx tests/unit/privacy-page.test.tsx` antes de mexer — Expected: PASS (linha de base).
- [ ] **Step 2: Implement** a casca e os componentes novos; `global-error` usa só estilos inline com as cores Ipê (não carrega o CSS global).
- [ ] **Step 3: Run** os dois unitários e `pnpm exec playwright test e2e/admin-moderacao.spec.ts` — Expected: PASS.
- [ ] **Step 4: Commit** `feat(ui): admin e páginas de sistema na identidade Ipê`.

### Task 10: Documentação, varredura e entrega

**Files:**
- Modify: `docs/DESIGN_SYSTEM.md` (reescrito), `docs/DECISIONS.md` (D51; D25–D27 marcadas como substituídas),
  `CLAUDE.md` (estética e rota da vitrine), `PRODUCT.md` (rotas e compromisso visual), `docs/ARCHITECTURE.md` (rota `/`)
- Test: suíte completa

- [ ] **Step 1: Sweep** `grep -rn "font-mono\|text-brand\|/processos" src` — só `/processos` no redirect e no proxy podem restar.
- [ ] **Step 2: Run** `pnpm biome check --write src tests e2e && pnpm lint && pnpm tsc --noEmit; echo TSC=$? && pnpm test && pnpm exec playwright test` — Expected: tudo verde, `TSC=0`.
- [ ] **Step 3: Run** o detector do Impeccable sobre `src/app src/components` e corrigir o que for mecânico.
- [ ] **Step 4: Visual check** 1440 e 360 de `/`, processo, projeto, entrar, painel, candidaturas, publicar, Kanban, admin.
- [ ] **Step 5: Write** os documentos.
- [ ] **Step 6: Commit and push** `docs: design system Ipê e D51` e `git push`.
