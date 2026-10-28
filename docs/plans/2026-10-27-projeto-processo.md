# Projeto + Processo Seletivo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um líder `@unifei.edu.br` cadastra o projeto e publica processos seletivos (cronograma, requisitos, link do edital, tags), e mantém tudo num painel com membros e papéis.

**Architecture:** Regras de domínio em serviços puros de servidor em `src/lib/**` que recebem `AuthUser` explicitamente e não importam `next/*` (mesmo padrão dos `authorize*` da Fundação), testados contra o Postgres real. Server Actions finas em `src/actions/*.actions.ts` fazem só sessão → Turnstile (quando aplicável) → serviço → `ActionResult`. As páginas do grupo `(organizer)` são Server Components que usam `requireProjectRolePage` e passam dados a formulários client.

**Tech Stack:** Next.js 16.4.3 (App Router), React 19.3, TypeScript estrito, Drizzle ORM 0.45 + Postgres 16, Zod 4, Better-Auth 1.7, Tailwind v4 + shadcn (estilo `radix-nova`, base stone), Vitest 5, Playwright 1.64, pnpm.

**Spec:** [`docs/superpowers/specs/2026-10-27-projeto-processo-design.md`](../superpowers/specs/2026-10-27-projeto-processo-design.md) — leia junto com este plano. Decisões: [`docs/DECISIONS.md`](../DECISIONS.md) D21, D22 (emendada), D23, D31, D34, D35, D36.

## Global Constraints

- Somente pnpm (`pnpm add`, `pnpm dlx shadcn@latest add …`); nunca npm/npx.
- Toda PK `uuid` com `defaultRandom()`. Rotas do organizador usam uuid; slugs são gerados no servidor e **imutáveis**.
- Zod `safeParse` em toda entrada de Server Action; mensagens de erro em pt-BR.
- URLs externas (`externalUrl`, `websiteUrl`, `instagramUrl`, links no Markdown): `new URL(v.trim())` e `protocol === "https:"`, senão recusa.
- Toda escrita em projeto/processo/membros exige **membership real** em `project_members` com o papel da tabela da spec §6.6 **e** projeto `ACTIVE`; qualquer recusa lança o `NotFoundError` da Fundação (`src/lib/auth/errors.ts`). `SYSTEM_ADMIN` sem membership só lê.
- Serviços em `src/lib/**` não importam `next/*`.
- Fuso: `America/Sao_Paulo`. Prazo informado como dia `YYYY-MM-DD`, gravado como 23:59:59 desse dia em Brasília.
- Interface diz "processo seletivo"/"processo"; código e banco continuam `opportunities`.
- Visual: `docs/DESIGN_SYSTEM.md` + D25–D28 (fundo stone-50, bordas `border-stone-200`, `--brand #0F3D75`, âmbar `#D97706` para prazo, `font-mono` para datas/números, sem `dark:`, sem sombras pesadas).
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Ao final de cada task: `pnpm lint && pnpm tsc --noEmit && pnpm test` verdes (Docker com `postgres-test` rodando).

Textos fixos (copiar exatamente):

| Chave | Texto |
|---|---|
| `MEMBER_NO_ACCOUNT` | `Essa pessoa ainda não entrou no Vértice. Peça para ela entrar uma vez com a conta da UNIFEI e tente de novo.` |
| `TURNSTILE_FAILED` | `Não foi possível verificar que você não é um robô. Tente de novo.` |
| `PROJECT_RATE_LIMIT` | `Você atingiu o limite de 3 projetos criados por dia. Tente de novo amanhã.` |
| `TAG_RATE_LIMIT` | `Você criou muitas tags novas na última hora. Tente de novo mais tarde.` |
| `OPPORTUNITY_CLOSED` | `Este processo já foi encerrado e não pode ser alterado. Duplique-o para abrir um novo ciclo.` |
| `INTERNAL_SELECTION_UNAVAILABLE` | `A seleção pela plataforma ainda não está disponível.` |
| `NO_CHANNEL` | `Informe o link do edital ou ative a seleção pela plataforma.` |
| `HTTPS_ONLY` | `Use um link começando com https://` |
| `DEADLINE_LABEL` | `Inscrições até {dd/mm/aaaa}, 23h59 (horário de Brasília)` |

## Review Focus

1. **Virada do dia em Brasília:** às 23h30 de 27/10 (02h30 UTC de 28/10), "hoje" é 27/10 e prazo 27/10 é aceito e conta como aberto. Testes nas Tasks 2 e 3.
2. **Link colado com espaços ou protocolo em maiúsculas** (`"  HTTPS://unifei.edu.br/edital.pdf "`) é aceito e gravado aparado; `http://` e `javascript:` recusados. Teste na Task 3.
3. **Nome sem caracteres aproveitáveis** (`"🚀🚀"`) gera slug de fallback (`projeto-…`/`processo-…`), e dois projetos com o mesmo nome geram `equipe-baja` e `equipe-baja-2`. Testes nas Tasks 2 e 5.
4. **Mesma tag digitada com caixa/acento diferente** (`"python "`, `"Python"`; `"Visão Computacional"` vs. existente `visao-computacional`), ou o mesmo nome novo em dois grupos do mesmo envio, reutiliza/cria **uma** tag. Teste na Task 4.
5. **Tirar todas as tags de um processo ou mover uma tag entre grupos** mantém `usageCount` correto e nunca negativo. Teste na Task 4.

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `src/db/schema/opportunities.ts`, `projects.ts`, `enums.ts` | Schema D34/D35 + `acronym` |
| `drizzle/0003_*.sql`, `drizzle/0004_*.sql` | Migrations geradas |
| `src/lib/time.ts` | Datas em `America/Sao_Paulo` |
| `src/lib/slug.ts` | `slugify`, sufixo aleatório |
| `src/lib/opportunities/status.ts` | Regra única aberto/encerrado (TS + SQL) |
| `src/lib/opportunities/features.ts` | Flag `INTERNAL_SELECTION_AVAILABLE` |
| `src/lib/validation/common.ts` | `httpsUrl`, `restrictedMarkdown`, `dayString`, `parseBrlToCents` |
| `src/lib/validation/project.ts`, `opportunity.ts` | Schemas Zod de projeto, processo, wizard |
| `src/lib/domain-errors.ts` | `DomainError`, `RateLimitError`, `ValidationError` |
| `src/lib/security/rate-limit.ts` | Limiter em memória |
| `src/lib/security/turnstile.ts` | Chaves + verificação |
| `src/lib/tags/service.ts` | Busca, resolução e sincronização de tags |
| `src/lib/projects/permissions.ts` | `loadProjectForWrite` |
| `src/lib/projects/service.ts` | Wizard, editar e arquivar projeto |
| `src/lib/opportunities/service.ts` | Criar, editar, encerrar, duplicar processo |
| `src/lib/projects/members.ts` | Membros e papéis |
| `src/lib/projects/queries.ts` | Leituras de painel, meus projetos, cursos |
| `src/actions/result.ts`, `project.actions.ts`, `opportunity.actions.ts`, `member.actions.ts`, `tag.actions.ts` | Server Actions |
| `src/components/tags/tag-combobox.tsx` | Combobox de tags |
| `src/components/projects/*` | Formulários e painel |
| `src/app/(organizer)/**` | Rotas do organizador |
| `tests/helpers/inputs.ts`, `tests/helpers/fixtures.ts` | Builders de entrada e de dados |

---

### Task 1: Schema D34/D35, migrations e documentação

**Files:**
- Modify: `src/db/schema/enums.ts`, `src/db/schema/opportunities.ts`, `src/db/schema/projects.ts`
- Create: `drizzle/0003_*.sql`, `drizzle/0004_*.sql` (geradas)
- Modify: `tests/integration/schema.test.ts`, `docs/ARCHITECTURE.md` (§4.2), `docs/superpowers/specs/2026-10-27-fundacao-design.md` (§6.4)

**Interfaces:**
- Produces: colunas Drizzle `opportunities.internalSelectionEnabled: boolean`, `externalUrl: string | null`, `deadlineAt: Date` (NOT NULL), `applicationsOpenOn`, `interviewStartsOn`, `interviewEndsOn`, `resultOn`, `activitiesStartOn` (`date` com `mode: "string"` → `string | null` `YYYY-MM-DD`), `availabilityRequirement: string | null` (varchar 200), `noOtherScholarship: boolean` (default false), `closedAt: Date | null`; `projects.acronym: string | null` (varchar 20). CHECK `opportunities_has_channel`. Enum `application_mode` e coluna `applicationMode` removidos. Tipo exportado `Opportunity = typeof opportunities.$inferSelect` em `src/db/schema/index.ts`.

- [ ] **Step 1: Reescrever o teste do CHECK** em `tests/integration/schema.test.ts`: substitua o caso "recusa vaga EXTERNAL sem external_url" por dois casos:
  - `"recusa processo sem link do edital e sem seleção pela plataforma (CHECK)"`: insert com `internalSelectionEnabled: false`, sem `externalUrl`, `deadlineAt: new Date()` → `err?.cause?.constraint === "opportunities_has_channel"`.
  - `"aceita processo só com link do edital"`: mesmo insert com `externalUrl: "https://unifei.edu.br/edital.pdf"` → sucesso.

- [ ] **Step 2: Rodar e ver falhar:** `pnpm test:integration -- tests/integration/schema.test.ts` → FAIL (tipo/coluna inexistente).

- [ ] **Step 3: Migration em duas etapas (evita o prompt interativo de rename do drizzle-kit):**
  1. Remova de `opportunities` a coluna `applicationMode`, o CHECK `opportunities_external_url_required` e, de `enums.ts`, `applicationModeEnum`. Rode `pnpm db:generate` → `0003_*.sql` só com DROPs.
  2. Adicione as colunas do bloco Interfaces, `deadlineAt` com `.notNull()`, o `check("opportunities_has_channel", sql\`${t.internalSelectionEnabled} OR ${t.externalUrl} IS NOT NULL\`)` e `projects.acronym`. Atualize o comentário de `externalUrl` ("Opcional; https validado no Zod — D34"). Rode `pnpm db:generate` → `0004_*.sql`.
  - Se mesmo assim o drizzle-kit perguntar algo, a resposta é sempre "create column" (nunca rename).
  - Corrija o comentário de `"ADMIN"` em `projectMemberRoleEnum` para `// Edita o projeto e gerencia processos (não gerencia membros)`.

- [ ] **Step 4: Aplicar e rodar:** `pnpm db:migrate` (banco de dev, porta 5434) e `pnpm test` → PASS. Rode `pnpm db:seed` duas vezes sem erro.

- [ ] **Step 5: Documentação:** em `ARCHITECTURE.md §4.2`, reflita o schema novo de `opportunities`/`projects` (remova `application_mode`, inclua as colunas e o CHECK, corrija o comentário de `ADMIN`). Na spec da Fundação §6.4, acrescente após o item do CHECK: `> Substituído pela D34 no Subprojeto 1: CHECK opportunities_has_channel.`

- [ ] **Step 6: Commit:** `git add -A src/db drizzle tests/integration/schema.test.ts docs && git commit -m "feat(db): canais independentes, cronograma e requisitos do processo (D34, D35)"`

---

### Task 2: Datas, slugs e a regra aberto/encerrado

**Files:**
- Create: `src/lib/time.ts`, `src/lib/slug.ts`, `src/lib/opportunities/status.ts`
- Test: `tests/unit/time.test.ts`, `tests/unit/slug.test.ts`, `tests/unit/opportunity-status.test.ts`, `tests/integration/opportunity-status-sql.test.ts`

**Interfaces:**
- Produces (`src/lib/time.ts`):
  - `TIMEZONE = "America/Sao_Paulo"`
  - `todayInSaoPaulo(now?: Date): string` → `YYYY-MM-DD` (via `Intl.DateTimeFormat("en-CA", { timeZone })`)
  - `deadlineFromDay(day: string): Date` → 23:59:59.000 do dia em Brasília (offset fixo `-03:00`; o Brasil não tem horário de verão desde 2019 — comente isso)
  - `dayFromDeadline(deadline: Date): string` (inverso, em Brasília)
  - `formatDay(value: Date | string): string` → `dd/mm/aaaa` (Date interpretado em Brasília; string `YYYY-MM-DD` formatada sem conversão de fuso)
  - `daysUntil(deadline: Date, now?: Date): number` → dias de calendário em Brasília (hoje = 0)
- Produces (`src/lib/slug.ts`):
  - `slugify(input: string, maxLength: number): string` → `[a-z0-9-]`, sem acentos, hífens colapsados, pode retornar `""`
  - `randomSlugSuffix(): string` → 4 caracteres `[a-z0-9]` (`crypto.randomInt`)
  - `opportunitySlug(title: string, suffix?: string): string` → `${slugify(title, 130) || "processo"}-${suffix ?? randomSlugSuffix()}`
  - `projectSlugBase(name: string): string` → `slugify(name, 90) || "projeto-" + randomSlugSuffix()`
- Produces (`src/lib/opportunities/status.ts`):
  - `isOpportunityOpen(o: { status: OpportunityStatus; deadlineAt: Date }, projectStatus: ProjectStatus, now?: Date): boolean`
  - `openOpportunitySql(now?: Date): SQL` → `opportunities.status = 'OPEN' AND opportunities.deadline_at > now AND projects.status = 'ACTIVE'` (exige join com `projects`; doc-comment dizendo que o Subprojeto 2 reusa)
  - `closedOnDate(o: { status; deadlineAt: Date; closedAt: Date | null }, now?: Date): Date | null` → `closedAt` se existe; senão `deadlineAt` se `deadlineAt <= now`; senão `null`
  - Exporte de `src/db/schema/index.ts`: `OpportunityStatus`, `ProjectStatus`, `ProjectCategory` e `Opportunity` (do `enumValues`/`$inferSelect`).

- [ ] **Step 1: Testes que falham**

```ts
// tests/unit/time.test.ts
expect(todayInSaoPaulo(new Date("2026-10-28T02:30:00Z"))).toBe("2026-10-27"); // Review Focus 1
expect(todayInSaoPaulo(new Date("2026-10-28T03:00:00Z"))).toBe("2026-10-28");
expect(deadlineFromDay("2026-11-10").toISOString()).toBe("2026-11-11T02:59:59.000Z");
expect(dayFromDeadline(new Date("2026-11-11T02:59:59.000Z"))).toBe("2026-11-10");
expect(formatDay("2026-03-05")).toBe("05/03/2026");
expect(formatDay(new Date("2026-11-11T02:59:59.000Z"))).toBe("10/11/2026");
expect(daysUntil(deadlineFromDay("2026-11-03"), new Date("2026-10-27T12:00:00Z"))).toBe(7);
expect(daysUntil(deadlineFromDay("2026-10-27"), new Date("2026-10-28T02:30:00Z"))).toBe(0);

// tests/unit/slug.test.ts
expect(slugify("Equipe Baja — Fórmula SAE!", 90)).toBe("equipe-baja-formula-sae");
expect(slugify("  C++ & Python  ", 90)).toBe("c-python");
expect(slugify("🚀🚀", 90)).toBe("");
expect(projectSlugBase("🚀🚀")).toMatch(/^projeto-[a-z0-9]{4}$/);           // Review Focus 3
expect(opportunitySlug("Vaga de Telemetria", "k3f9")).toBe("vaga-de-telemetria-k3f9");
expect(opportunitySlug("!!!", "ab12")).toBe("processo-ab12");
expect(slugify("a".repeat(200), 90)).toHaveLength(90);
expect(randomSlugSuffix()).toMatch(/^[a-z0-9]{4}$/);

// tests/unit/opportunity-status.test.ts
const now = new Date("2026-10-27T12:00:00Z");
const future = new Date("2026-11-01T02:59:59Z"), past = new Date("2026-10-20T02:59:59Z");
expect(isOpportunityOpen({ status: "OPEN", deadlineAt: future }, "ACTIVE", now)).toBe(true);
expect(isOpportunityOpen({ status: "OPEN", deadlineAt: past }, "ACTIVE", now)).toBe(false);
expect(isOpportunityOpen({ status: "CLOSED", deadlineAt: future }, "ACTIVE", now)).toBe(false);
expect(isOpportunityOpen({ status: "UNDER_REVIEW", deadlineAt: future }, "ACTIVE", now)).toBe(false);
expect(isOpportunityOpen({ status: "PAUSED", deadlineAt: future }, "ACTIVE", now)).toBe(false);
expect(isOpportunityOpen({ status: "OPEN", deadlineAt: future }, "ARCHIVED", now)).toBe(false);
const closedAt = new Date("2026-10-25T15:00:00Z");
expect(closedOnDate({ status: "CLOSED", deadlineAt: future, closedAt }, now)).toEqual(closedAt);
expect(closedOnDate({ status: "OPEN", deadlineAt: past, closedAt: null }, now)).toEqual(past);
expect(closedOnDate({ status: "OPEN", deadlineAt: future, closedAt: null }, now)).toBeNull();
```

Integração `opportunity-status-sql.test.ts`: cria (após `resetDb` + `runSeed`) projeto ACTIVE com 4 processos (aberto; prazo vencido; CLOSED; UNDER_REVIEW) e projeto ARCHIVED com 1 OPEN no futuro; `select … from opportunities join projects … where openOpportunitySql(now)` retorna **só** o primeiro.

- [ ] **Step 2: Rodar e ver falhar:** `pnpm test -- tests/unit/time.test.ts tests/unit/slug.test.ts tests/unit/opportunity-status.test.ts tests/integration/opportunity-status-sql.test.ts` → FAIL (módulos inexistentes).
- [ ] **Step 3: Implementar** as funções do bloco Interfaces.
- [ ] **Step 4: Rodar de novo** → PASS.
- [ ] **Step 5: Commit:** `git commit -m "feat: datas em Brasília, slugs e regra única de processo aberto"`

---

### Task 3: Schemas Zod de projeto, processo e wizard

**Files:**
- Create: `src/lib/validation/common.ts`, `src/lib/validation/project.ts`, `src/lib/validation/opportunity.ts`, `src/lib/opportunities/features.ts`, `tests/helpers/inputs.ts`
- Test: `tests/unit/validation-common.test.ts`, `tests/unit/validation-project.test.ts`, `tests/unit/validation-opportunity.test.ts`

**Interfaces:**
- Consumes: `todayInSaoPaulo` (Task 2).
- Produces (`features.ts`): `export const INTERNAL_SELECTION_AVAILABLE = false;` (comentário: o subprojeto de Candidatura muda para `true`).
- Produces (`common.ts`):
  - `httpsUrl(max: number)`: `z.string().trim().max(max)` + refine `new URL(v).protocol === "https:"` (mensagem `HTTPS_ONLY`); transforma para o valor aparado.
  - `optionalHttpsUrl(max)`: `""`/ausente → `null`.
  - `restrictedMarkdown(max: number)`: string aparada até `max`; recusa `/<\/?[a-z!][^>]*>/i` (mensagem `"HTML não é permitido. Use a formatação Markdown."`) e links/imagens Markdown `\]\(([^)\s]+)` cujo destino não seja `https:` (mensagem `HTTPS_ONLY`).
  - `dayString`: `z.string().regex(/^\d{4}-\d{2}-\d{2}$/)` + data de calendário válida.
  - `parseBrlToCents(input: string): number | null` — regras nos testes.
- Produces (`project.ts`): `projectInputSchema` (campos e limites da spec §6.4 passo 1; `acronym` até 20; `description` = `restrictedMarkdown(5000)` opcional; `contactEmail` = `z.email()`; `websiteUrl`/`instagramUrl` = `optionalHttpsUrl(255)`), `type ProjectInput = z.output<typeof projectInputSchema>`, `type ProjectFormValues = z.input<typeof projectInputSchema>`.
- Produces (`opportunity.ts`):
  - `tagRefSchema = z.union([z.object({ id: z.uuid() }), z.object({ name: z.string().trim().min(2).max(64) })])`, `type TagRef`.
  - `TAG_GROUPS = ["THEME", "DESIRED_SKILL", "DEVELOPED_SKILL"] as const`.
  - `makeOpportunitySchema(opts: { today: string })` → schema com os campos da spec §6.4 passo 2 (vagas 1–99 default 1; `weeklyHours` 4–20 opcional; `minSemester` 1–12 opcional; `scholarshipValue` string opcional → `scholarshipValueCents` via `parseBrlToCents`, inválido → erro de campo `"Valor inválido."`; `targetCourseIds: z.array(z.uuid()).max(50)` sem duplicatas; `tags: Record<TagGroup, TagRef[]>` até 10 por grupo; `externalUrl: optionalHttpsUrl(500)`; `internalSelectionEnabled: z.boolean().default(false)`; `deadline: dayString`; datas do cronograma `dayString` opcionais) e `superRefine` com: `NO_CHANNEL` (path `externalUrl`), `INTERNAL_SELECTION_UNAVAILABLE` quando ligado e a flag é `false` (path `internalSelectionEnabled`), e as regras de data da spec §6.4 (prazo ≥ `today`; abertura ≤ prazo; início entrevista ≤ fim; fim sem início é erro; resultado e início das atividades ≥ prazo).
  - `type OpportunityInput = z.output<ReturnType<typeof makeOpportunitySchema>>`, `type OpportunityFormValues = z.input<…>`.
  - `makeWizardSchema(opts: { today: string })` → `z.object({ project: projectInputSchema, opportunity: makeOpportunitySchema(opts) })`.
- Produces (`tests/helpers/inputs.ts`): `validProjectInput(overrides?: Partial<ProjectFormValues>): ProjectFormValues`, `validOpportunityInput(overrides?: Partial<OpportunityFormValues>): OpportunityFormValues` (com `externalUrl: "https://unifei.edu.br/edital.pdf"` e `deadline` = hoje + 14 dias em Brasília).

- [ ] **Step 1: Testes que falham (asserções mínimas)**

```ts
// common
expect(httpsUrl(500).parse("  HTTPS://unifei.edu.br/edital.pdf ")).toBe("HTTPS://unifei.edu.br/edital.pdf"); // Review Focus 2: aceito e aparado
for (const bad of ["http://unifei.edu.br", "javascript:alert(1)", "data:text/html,x", "unifei.edu.br", "ftp://x"])
  expect(httpsUrl(500).safeParse(bad).success).toBe(false);
expect(restrictedMarkdown(5000).safeParse("**negrito** e [edital](https://unifei.edu.br)").success).toBe(true);
expect(restrictedMarkdown(5000).safeParse("<script>x</script>").success).toBe(false);
expect(restrictedMarkdown(5000).safeParse("[x](javascript:alert(1))").success).toBe(false);
expect(restrictedMarkdown(5000).safeParse("2 < 3 e 5 > 4").success).toBe(true);
expect(parseBrlToCents("700")).toBe(70000);
expect(parseBrlToCents("700,5")).toBe(70050);
expect(parseBrlToCents("1.200,00")).toBe(120000);
expect(parseBrlToCents("1200.50")).toBe(120050);
expect(parseBrlToCents("1.200")).toBe(120000);
for (const bad of ["0", "abc", "-5", "1,234", ""]) expect(parseBrlToCents(bad)).toBeNull();
expect(dayString.safeParse("2026-02-30").success).toBe(false);

// project
expect(projectInputSchema.safeParse(validProjectInput()).success).toBe(true);
expect(projectInputSchema.safeParse(validProjectInput({ name: "ab" })).success).toBe(false);
expect(projectInputSchema.safeParse(validProjectInput({ websiteUrl: "http://x.com" })).success).toBe(false);
expect(projectInputSchema.parse(validProjectInput({ websiteUrl: "" })).websiteUrl).toBeNull();
expect(projectInputSchema.safeParse(validProjectInput({ contactEmail: "equipe@gmail.com" })).success).toBe(true); // D31

// opportunity (today = "2026-10-27")
const s = makeOpportunitySchema({ today: "2026-10-27" });
const v = (o: Partial<OpportunityFormValues>) => validOpportunityInput({ deadline: "2026-11-10", ...o });
expect(s.safeParse(v({ deadline: "2026-10-27" })).success).toBe(true);               // Review Focus 1
expect(s.safeParse(v({ deadline: "2026-10-26" })).success).toBe(false);
expect(issueMessages(s, v({ externalUrl: "" }))).toContain(NO_CHANNEL);
expect(issueMessages(s, v({ internalSelectionEnabled: true }))).toContain(INTERNAL_SELECTION_UNAVAILABLE);
expect(s.safeParse(v({ applicationsOpenOn: "2026-11-11" })).success).toBe(false);
expect(s.safeParse(v({ interviewEndsOn: "2026-11-20" })).success).toBe(false);          // fim sem início
expect(s.safeParse(v({ interviewStartsOn: "2026-11-21", interviewEndsOn: "2026-11-20" })).success).toBe(false);
expect(s.safeParse(v({ resultOn: "2026-11-09" })).success).toBe(false);
expect(s.safeParse(v({ activitiesStartOn: "2026-11-09" })).success).toBe(false);
expect(s.safeParse(v({ weeklyHours: 21 })).success).toBe(false);
expect(s.parse(v({ scholarshipValue: "700,00" })).scholarshipValueCents).toBe(70000);
expect(s.safeParse(v({ tags: { THEME: Array.from({ length: 11 }, (_, i) => ({ name: `tag ${i}` })), DESIRED_SKILL: [], DEVELOPED_SKILL: [] } })).success).toBe(false);
```

(`issueMessages` é um helper local do teste que retorna as mensagens do `safeParse`.)

- [ ] **Step 2: Rodar e ver falhar:** `pnpm test:unit` → FAIL.
- [ ] **Step 3: Implementar** os módulos do bloco Interfaces.
- [ ] **Step 4: Rodar de novo** → PASS.
- [ ] **Step 5: Commit:** `git commit -m "feat(validation): schemas Zod de projeto, processo e wizard"`

---

### Task 4: Erros de domínio, limiter e serviço de tags

**Files:**
- Create: `src/lib/domain-errors.ts`, `src/lib/security/rate-limit.ts`, `src/lib/tags/service.ts`, `tests/helpers/fixtures.ts`
- Test: `tests/unit/rate-limit.test.ts`, `tests/integration/tags-service.test.ts`

**Interfaces:**
- Consumes: `normalizeTagSlug` (`src/lib/search/tags.ts`), `TagRef`, `TAG_GROUPS` (Task 3), `Tx` (`src/db`).
- Produces (`domain-errors.ts`):
  - `class ValidationError extends Error { fieldErrors: Record<string, string[]> }` + `fromZodError(err: z.ZodError): ValidationError` (chaves = `path.join(".")`)
  - `class RateLimitError extends Error { userMessage: string }`
  - `class DomainError extends Error { code: "OPPORTUNITY_CLOSED" | "MEMBER_NO_ACCOUNT" | "OWNER_IMMUTABLE" | "ALREADY_MEMBER"; userMessage: string }`
- Produces (`rate-limit.ts`): `createRateLimiter(opts: { limit: number; windowMs: number; maxKeys?: number }): { consume(key: string, amount?: number): boolean; reset(): void }` (janela deslizante simples por chave; `maxKeys` padrão 10.000, descarta a chave mais antiga) e `tagCreationLimiter = createRateLimiter({ limit: 30, windowMs: 3_600_000 })`.
- Produces (`tags/service.ts`):
  - `type TagGroups = Record<(typeof TAG_GROUPS)[number], TagRef[]>`
  - `searchTags(institutionId: string, query: string, limit?: number /*10*/): Promise<Array<{ id: string; name: string }>>` → `name ILIKE %q%` ou `normalized_slug LIKE normalizeTagSlug(q)%`, ordenado por `usage_count desc, name`; query vazia → `[]`.
  - `syncOpportunityTags(tx: Tx, ctx: { institutionId: string; userId: string; opportunityId: string }, groups: TagGroups): Promise<void>` — resolve refs (ids precisam ser tags da instituição, senão `NotFoundError`; nomes → `normalizeTagSlug`; slug existente em `tags` ou `tag_aliases` reutiliza a tag canônica; senão cria `category: "TOPIC"`, `isVerified: false`, `createdByUserId`); consome `tagCreationLimiter.consume(userId, nNovas)` antes de criar (recusa → `RateLimitError(TAG_RATE_LIMIT)`); substitui as linhas de `opportunity_tags`; ajusta `usage_count` pela diferença do conjunto de **tags distintas** do processo antes/depois (+1 entrou, −1 saiu, `GREATEST(usage_count - 1, 0)`).
- Produces (`tests/helpers/fixtures.ts`): `mkUser(email, opts?: { systemRole?; isBanned?; institutionId? })`, `mkProject(opts?: { status?; institutionId?; name? })`, `addMember(projectId, userId, role)`, `mkOpportunity(projectId, overrides?)` (insert direto, `externalUrl` https, `deadlineAt` = +14 dias), `mkForeignInstitution()`. Usam `getDefaultInstitution()` por padrão.

- [ ] **Step 1: Testes que falham**
  - Unit `rate-limit`: limite 3 → `consume("u")` true ×3, a 4ª false; `consume("u", 2)` respeita a quantidade; com `vi.useFakeTimers()`, após `windowMs` volta a aceitar; `reset()` zera.
  - Integração `tags-service` (`beforeEach`: `resetDb`, `runSeed`, `tagCreationLimiter.reset()`):
    - `"reutiliza tag existente ignorando caixa, espaços e acentos"`: seed tem `Python`; `syncOpportunityTags` com `{ name: "python " }` e `{ name: "PYTHON" }` → nenhuma tag nova, 1 linha em `opportunity_tags` por grupo usado. **(Review Focus 4)**
    - `"mesmo nome novo em dois grupos cria uma tag só"`: `{ name: "Telemetria CAN" }` em `THEME` e `DEVELOPED_SKILL` → 1 tag nova `isVerified=false`, `createdByUserId` = usuário, 2 linhas em `opportunity_tags`, `usageCount = 1`. **(Review Focus 4)**
    - `"alias resolve para a tag canônica"`: insere `tag_aliases(aliasSlug "pyhton" → Python)`; `{ name: "Pyhton" }` → usa Python.
    - `"id de tag de outra instituição é recusado"` → `NotFoundError`.
    - `"usageCount acompanha adicionar, mover entre grupos e remover"`: sync com Python em THEME → 1; mover para DESIRED_SKILL → continua 1; remover todas → 0; remover de novo → 0 (nunca negativo). **(Review Focus 5)**
    - `"31ª tag nova na hora é recusada"`: 30 nomes novos passam; o 31º num segundo sync lança `RateLimitError`.
    - `"searchTags encontra por nome e por slug sem acento"`: `"visao"` encontra `Visão Computacional` do seed; `""` → `[]`.
- [ ] **Step 2: Rodar e ver falhar:** `pnpm test -- tests/unit/rate-limit.test.ts tests/integration/tags-service.test.ts` → FAIL.
- [ ] **Step 3: Implementar** conforme o bloco Interfaces.
- [ ] **Step 4: Rodar de novo** → PASS.
- [ ] **Step 5: Commit:** `git commit -m "feat(tags): busca, criação na hora com aliases e contagem de uso"`

---

### Task 5: Permissões de escrita e serviço de projeto (wizard, editar, arquivar)

**Files:**
- Create: `src/lib/projects/permissions.ts`, `src/lib/projects/service.ts`
- Modify: `src/lib/security/audit.ts` (novas `AuditAction`)
- Test: `tests/integration/project-service.test.ts`

**Interfaces:**
- Consumes: `authorizeProjectRole`, `AuthUser`, `ProjectAccess` (`src/lib/auth/guards.ts`); `makeWizardSchema`, `projectInputSchema` (Task 3); `syncOpportunityTags` (Task 4); `projectSlugBase`, `opportunitySlug` (Task 2); `deadlineFromDay`, `todayInSaoPaulo`; `ValidationError`, `RateLimitError`, `fromZodError`.
- Produces (`permissions.ts`):
  - `ALL_ROLES = ["OWNER", "ADMIN", "REVIEWER"] as const`, `EDITOR_ROLES = ["OWNER", "ADMIN"] as const`, `OWNER_ONLY = ["OWNER"] as const`
  - `loadProjectForWrite(user: AuthUser, projectId: string, roles: readonly ProjectRole[]): Promise<ProjectAccess & { membership: { role: ProjectRole } }>` → `authorizeProjectRole(user, projectId, ALL_ROLES, { allowInactive: true })`; depois `NotFoundError` se `membership` é `null`, se o papel não está em `roles` ou se `project.status !== "ACTIVE"`.
- Produces (`audit.ts`): `AuditAction` ganha `"PROJECT_ARCHIVED" | "PROJECT_MEMBER_ADDED" | "PROJECT_MEMBER_REMOVED" | "PROJECT_MEMBER_ROLE_CHANGED" | "PROJECT_MEMBER_LEFT"`.
- Produces (`service.ts`):
  - `createProjectWithOpportunity(user: AuthUser, input: unknown, opts?: { now?: Date }): Promise<{ projectId: string; opportunityId: string }>` — `makeWizardSchema({ today: todayInSaoPaulo(now) })`; falha → `fromZodError`. Conta projetos em que o usuário é OWNER com `projects.created_at > now - 24h`; ≥ 3 → `RateLimitError(PROJECT_RATE_LIMIT)`. Numa transação: slug do projeto (`projectSlugBase`; se já existe na instituição, `-2`, `-3`…), insert do projeto, membership OWNER, processo via `insertOpportunity` (abaixo) e tags. `institutionId` sempre do `user`.
  - `insertOpportunity(tx: Tx, ctx: { user: AuthUser; projectId: string }, input: OpportunityInput): Promise<string>` — exportada para a Task 6; valida que todo `targetCourseIds` é curso da instituição do usuário (senão `ValidationError({ targetCourseIds: ["Curso inválido."] })`), grava `deadlineAt = deadlineFromDay(input.deadline)`, slug `opportunitySlug(title)`, e chama `syncOpportunityTags`.
  - `updateProject(user: AuthUser, projectId: string, input: unknown): Promise<void>` — `loadProjectForWrite(…, EDITOR_ROLES)`; não muda `slug`; atualiza `updatedAt`.
  - `archiveProject(user: AuthUser, projectId: string): Promise<void>` — `OWNER_ONLY`; `status = "ARCHIVED"`; `logAudit({ action: "PROJECT_ARCHIVED", targetType: "PROJECT", targetId })` na mesma transação.

- [ ] **Step 1: Testes que falham** (`beforeEach`: `resetDb`, `runSeed`, `tagCreationLimiter.reset()`; entradas de `tests/helpers/inputs.ts`):
  - `"wizard cria projeto, OWNER, processo e tags"`: retorna ids; `project_members` tem `(user, OWNER)`; `opportunities.deadlineAt` = `deadlineFromDay(input.deadline)`; slug do projeto = `slugify(nome)`.
  - `"falha no meio não deixa nada gravado"`: `targetCourseIds` com um uuid aleatório → `ValidationError`; `projects`, `project_members`, `opportunities`, `tags` (novas) vazias.
  - `"dois projetos com o mesmo nome recebem slugs -2"`: `"Equipe Baja"` ×2 → `equipe-baja`, `equipe-baja-2`. **(Review Focus 3)**
  - `"quarto projeto em 24h é recusado"`: 3 criações ok, a 4ª → `RateLimitError` com `userMessage === PROJECT_RATE_LIMIT`; com `opts.now` 25h depois (e projetos antigos com `createdAt` ajustado) volta a aceitar.
  - `"updateProject: OWNER e ADMIN editam; REVIEWER, não-membro, outra instituição e SYSTEM_ADMIN sem membership recebem NotFoundError"`; slug não muda ao trocar o nome.
  - `"archiveProject: só OWNER; ADMIN recebe NotFoundError; grava PROJECT_ARCHIVED; depois disso updateProject recusa"`.
  - `"projeto SUSPENDED recusa updateProject mesmo para o OWNER"`.
- [ ] **Step 2: Rodar e ver falhar:** `pnpm test:integration -- tests/integration/project-service.test.ts` → FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar de novo** → PASS.
- [ ] **Step 5: Commit:** `git commit -m "feat(projetos): wizard transacional, edição e arquivamento com permissão por membership"`

---

### Task 6: Serviço de processos (criar, editar, encerrar, duplicar)

**Files:**
- Create: `src/lib/opportunities/service.ts`
- Test: `tests/integration/opportunity-service.test.ts`

**Interfaces:**
- Consumes: `loadProjectForWrite`, `EDITOR_ROLES` (Task 5), `insertOpportunity` (Task 5), `makeOpportunitySchema` (Task 3), `isOpportunityOpen` (Task 2), `syncOpportunityTags` (Task 4), `dayFromDeadline`, `DomainError`.
- Produces:
  - `createOpportunity(user: AuthUser, projectId: string, input: unknown, opts?: { now?: Date }): Promise<{ opportunityId: string }>` — `EDITOR_ROLES`.
  - `updateOpportunity(user, projectId: string, opportunityId: string, input: unknown, opts?: { now?: Date }): Promise<void>` — processo precisa ser do `projectId` (senão `NotFoundError`); se `!isOpportunityOpen(…)` → `DomainError("OPPORTUNITY_CLOSED", OPPORTUNITY_CLOSED)`; não muda `slug`; ressincroniza tags.
  - `closeOpportunity(user, projectId, opportunityId, opts?): Promise<void>` — mesmas checagens; `status = "CLOSED"`, `closedAt = now`.
  - `getOpportunityFormValues(user, projectId, opportunityId, mode: "edit" | "duplicate"): Promise<OpportunityFormValues>` — `EDITOR_ROLES`; `edit`: todos os campos (`deadline = dayFromDeadline`, valor em reais formatado `"700,00"`, tags como `{ id }` por grupo); `duplicate`: o mesmo **sem** `deadline` e sem as cinco datas do cronograma (string vazia). Funciona para processo aberto ou encerrado.

- [ ] **Step 1: Testes que falham:**
  - `"OWNER e ADMIN criam; REVIEWER, não-membro e SYSTEM_ADMIN sem membership recebem NotFoundError"`.
  - `"editar processo de outro projeto trocando o opportunityId é recusado"`: membro do projeto A tenta `updateOpportunity(user, A, idDoProjetoB, …)` → `NotFoundError`; nada muda no B.
  - `"processo encerrado não pode ser editado nem encerrado de novo"`: após `closeOpportunity`, `updateOpportunity` e `closeOpportunity` → `DomainError` com `code === "OPPORTUNITY_CLOSED"`; `closedAt` preenchido.
  - `"prazo vencido conta como encerrado"`: processo com `deadlineAt` no passado → `updateOpportunity` lança `OPPORTUNITY_CLOSED`.
  - `"duplicar gera valores sem datas e cria processo novo aberto com slug novo"`: `getOpportunityFormValues(…, "duplicate")` tem `deadline === ""` e mesmas tags; completando o prazo, `createOpportunity` cria outro id, slug diferente, `status = "OPEN"`.
  - `"edição mantém slug e atualiza tags"`.
  - `"projeto ARCHIVED recusa criar, editar e encerrar"`.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar de novo** → PASS.
- [ ] **Step 5: Commit:** `git commit -m "feat(processos): criar, editar, encerrar e duplicar processos seletivos"`

---

### Task 7: Membros e papéis

**Files:**
- Create: `src/lib/projects/members.ts`
- Test: `tests/integration/members-service.test.ts`

**Interfaces:**
- Consumes: `loadProjectForWrite`, `OWNER_ONLY`, `ALL_ROLES` (Task 5), `logAudit`, `DomainError`, `fromZodError`.
- Produces:
  - `addMemberInputSchema = z.object({ email: z.email().trim().toLowerCase(), role: z.enum(["ADMIN", "REVIEWER"]) })`
  - `addMember(user: AuthUser, projectId: string, input: unknown): Promise<void>` — `OWNER_ONLY`. E-mail sem usuário, usuário banido ou de outra instituição → **o mesmo** `DomainError("MEMBER_NO_ACCOUNT", MEMBER_NO_ACCOUNT)` (não revela banimento nem existência). Já é membro → `DomainError("ALREADY_MEMBER", "Essa pessoa já faz parte do projeto.")`. Audita `PROJECT_MEMBER_ADDED` com `metadata: { memberUserId, role }`.
  - `changeMemberRole(user, projectId, memberUserId: string, role: "ADMIN" | "REVIEWER"): Promise<void>` — `OWNER_ONLY`; alvo OWNER → `DomainError("OWNER_IMMUTABLE", "O dono do projeto não pode ser alterado aqui.")`; alvo não-membro → `NotFoundError`. Audita `PROJECT_MEMBER_ROLE_CHANGED` (`metadata: { memberUserId, from, to }`).
  - `removeMember(user, projectId, memberUserId): Promise<void>` — `OWNER_ONLY`; alvo OWNER → `OWNER_IMMUTABLE`. Audita `PROJECT_MEMBER_REMOVED`.
  - `leaveProject(user, projectId): Promise<void>` — `ALL_ROLES`; OWNER → `OWNER_IMMUTABLE` (mensagem `"O dono do projeto não pode sair dele."`). Audita `PROJECT_MEMBER_LEFT`.
  - Todo `memberUserId` é validado como uuid antes de consultar (inválido → `NotFoundError`).

- [ ] **Step 1: Testes que falham:**
  - `"OWNER adiciona ADMIN e REVIEWER por e-mail (case-insensitive)"` e auditoria gravada.
  - `"e-mail sem conta, banido e de outra instituição recebem a mesma mensagem"`: as três chamadas lançam `DomainError` com o mesmo `code` e `userMessage === MEMBER_NO_ACCOUNT`.
  - `"ADMIN e REVIEWER não gerenciam membros"` → `NotFoundError` em `addMember`, `changeMemberRole`, `removeMember`.
  - `"OWNER não pode ser rebaixado, removido nem sair"` → `OWNER_IMMUTABLE` ×3.
  - `"REVIEWER sai do projeto"` → membership removida; `PROJECT_MEMBER_LEFT` auditado.
  - `"papel OWNER não é atribuível"`: `addMember({ role: "OWNER" })` → `ValidationError`.
  - `"SYSTEM_ADMIN sem membership não gerencia membros"` → `NotFoundError`.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar de novo** → PASS.
- [ ] **Step 5: Commit:** `git commit -m "feat(projetos): gestão de membros com dono único e auditoria"`

---

### Task 8: Turnstile, consultas do painel e Server Actions

**Files:**
- Create: `src/lib/security/turnstile.ts`, `src/lib/projects/queries.ts`, `src/actions/result.ts`, `src/actions/project.actions.ts`, `src/actions/opportunity.actions.ts`, `src/actions/member.actions.ts`, `src/actions/tag.actions.ts`
- Modify: `src/env.ts`, `.env.example`
- Test: `tests/unit/env.test.ts` (casos novos), `tests/unit/turnstile.test.ts`, `tests/integration/project-queries.test.ts`, `tests/integration/actions.test.ts`

**Interfaces:**
- Produces (`env.ts`): `NEXT_PUBLIC_TURNSTILE_SITE_KEY` e `TURNSTILE_SECRET_KEY` opcionais; `superRefine`: em `production`, ambos obrigatórios (mensagem `"obrigatório em produção"`).
- Produces (`turnstile.ts`):
  - `TURNSTILE_TEST_KEYS = { siteKey: "1x00000000000000000000AA", secretKey: "1x0000000000000000000000000000000AA" }`
  - `E2E_TURNSTILE_TOKEN = "e2e-turnstile-token"`
  - `getTurnstileConfig(env?: Env): { siteKey: string; secretKey: string; bypass: boolean }` — chaves do env, ou as de teste quando ausentes (fora de produção); `bypass = env.ENABLE_TEST_AUTH && env.NODE_ENV !== "production"` (mesma condição da D33: o E2E não depende da rede da Cloudflare).
  - `verifyTurnstile(token: string, remoteIp: string | null, deps?: { fetch?: typeof fetch; config?: … }): Promise<boolean>` — `bypass` → `token === E2E_TURNSTILE_TOKEN`; senão POST `https://challenges.cloudflare.com/turnstile/v0/siteverify` (form `secret`, `response`, `remoteip` opcional) e retorna `json.success === true`; erro de rede, timeout de 5 s ou token vazio → `false`.
- Produces (`queries.ts`):
  - `listMyProjects(user: AuthUser): Promise<Array<{ id: string; name: string; acronym: string | null; category: ProjectCategory; status: ProjectStatus; role: ProjectRole }>>` (mesma instituição, ordenado por nome)
  - `listProjectsUserCanPublishIn(user): Promise<Array<{ id: string; name: string }>>` (papel OWNER/ADMIN e projeto ACTIVE)
  - `getProjectPanel(access: ProjectAccess, now?: Date): Promise<{ open: PanelOpportunity[]; closed: PanelOpportunity[] }>` com `PanelOpportunity = { id; title; deadlineAt: Date; closedOn: Date | null; vacanciesCount: number; hasExternalUrl: boolean; internalSelectionEnabled: boolean }` — classifica com `isOpportunityOpen`; `open` por prazo asc, `closed` por `closedOn` desc.
  - `listMembers(access: ProjectAccess): Promise<Array<{ userId; name; email; role }>>` (OWNER primeiro)
  - `listCourses(institutionId: string): Promise<Array<{ id; code; name }>>` (por nome)
- Produces (`result.ts`):
  - `type ActionErrorCode = "UNAUTHORIZED" | "NOT_FOUND" | "VALIDATION" | "RATE_LIMITED" | "TURNSTILE_FAILED" | "RULE"`
  - `type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: ActionErrorCode; message: string; fieldErrors?: Record<string, string[]> }`
  - `runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>>` — mapeia `UnauthorizedError` → `UNAUTHORIZED` (`"Sua sessão expirou. Entre de novo."`), `NotFoundError` → `NOT_FOUND` (`"Não encontrado."`), `ValidationError` → `VALIDATION` (`"Revise os campos destacados."` + `fieldErrors`), `RateLimitError` → `RATE_LIMITED` (`userMessage`), `DomainError` → `RULE` (`userMessage`); qualquer outro erro é relançado.
- Produces (actions, todas `"use server"`, todas via `runAction` e `requireAuth()`; após sucesso, `revalidatePath` das rotas afetadas):
  - `createProjectWithOpportunityAction(input: { turnstileToken: string; project: unknown; opportunity: unknown }): Promise<ActionResult<{ projectId: string }>>` — **antes** de qualquer escrita, `verifyTurnstile(token, getRequestIp(await headers()))`; `false` → `{ ok: false, error: "TURNSTILE_FAILED", message: TURNSTILE_FAILED }`.
  - `updateProjectAction(projectId: string, input: unknown)`, `archiveProjectAction(projectId: string)`
  - `createOpportunityAction(projectId, input)` → `ActionResult<{ opportunityId: string }>`, `updateOpportunityAction(projectId, opportunityId, input)`, `closeOpportunityAction(projectId, opportunityId)`
  - `addMemberAction(projectId, input)`, `changeMemberRoleAction(projectId, memberUserId, role)`, `removeMemberAction(projectId, memberUserId)`, `leaveProjectAction(projectId)`
  - `searchTagsAction(query: string): Promise<Array<{ id: string; name: string }>>` — exige sessão; query `z.string().trim().max(64)`.

- [ ] **Step 1: Testes que falham:**
  - `env.test.ts`: produção sem as chaves Turnstile falha com `TURNSTILE_SECRET_KEY: obrigatório em produção`; dev sem elas passa.
  - `turnstile.test.ts`: com `fetch` falso retornando `{ success: true }` → `true` e o corpo enviado contém `secret` e `response`; `{ success: false }` → `false`; `fetch` que rejeita → `false`; token `""` → `false` sem chamar `fetch`; `bypass` aceita só `E2E_TURNSTILE_TOKEN`; `getTurnstileConfig` sem chaves (dev) devolve `TURNSTILE_TEST_KEYS`.
  - `project-queries.test.ts`: `getProjectPanel` separa aberto, vencido e CLOSED e preenche `closedOn` conforme `closedOnDate`; `listMyProjects` não mostra projeto de que o usuário não é membro; `listProjectsUserCanPublishIn` exclui projeto onde é REVIEWER e projeto ARCHIVED.
  - `actions.test.ts` (mocks de `next/headers`, `next/cache` e `@/lib/auth/session` como em `tests/integration/guards-request.test.ts`; `vi.mock("@/lib/security/turnstile", …)` controlando o retorno de `verifyTurnstile`):
    - `"Turnstile inválido recusa sem gravar nada"` → `{ ok: false, error: "TURNSTILE_FAILED" }` e `projects` vazio.
    - `"sem sessão → UNAUTHORIZED"`.
    - `"erro de validação volta por campo"`: `externalUrl: "http://x"` → `error: "VALIDATION"`, `fieldErrors["opportunity.externalUrl"]` contém `HTTPS_ONLY`.
    - `"não-membro recebe NOT_FOUND com a mesma mensagem de id inexistente"`: `updateProjectAction` com projeto alheio e com uuid aleatório → resultados iguais.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.** Documente as duas variáveis no `.env.example` (comentário: vazias em dev usam as chaves de teste da Cloudflare).
- [ ] **Step 4: Rodar de novo** → PASS.
- [ ] **Step 5: Commit:** `git commit -m "feat: Server Actions de projeto, processo, membros e tags com Turnstile"`

---

### Task 9: Formulários, TagCombobox e wizard `/publicar`

**Files:**
- Create: `src/components/ui/*` (via `pnpm dlx shadcn@latest add input textarea label select checkbox command popover alert-dialog badge`), `src/components/tags/tag-combobox.tsx`, `src/components/projects/project-fields.tsx`, `src/components/projects/opportunity-form.tsx`, `src/components/projects/turnstile-widget.tsx`, `src/components/projects/publish-wizard.tsx`, `src/app/(organizer)/publicar/page.tsx`
- Modify: `src/components/layout/site-header.tsx`
- Test: `e2e/publicar.spec.ts`

**Interfaces:**
- Consumes: actions da Task 8; `listProjectsUserCanPublishIn`, `listCourses`, `getTurnstileConfig`, `E2E_TURNSTILE_TOKEN`; `ProjectFormValues`, `OpportunityFormValues`, `TAG_GROUPS`, `INTERNAL_SELECTION_AVAILABLE`; `formatDay`.
- Produces:
  - `<TagCombobox value: TagRef[] onChange(refs: TagRef[]) label: string max={10} />` — exibe tags escolhidas como badges removíveis (tags novas mostram o nome digitado); busca com debounce de 200 ms via `searchTagsAction`; Enter num termo sem resultado igual adiciona `{ name }` **só no cliente** (nada é gravado até o envio). Termos com o mesmo `normalizeTagSlug` não se repetem no mesmo grupo.
  - `<ProjectFields values onChange errors />` — campos do passo 1; IC (`SCIENTIFIC_INIT`) destaca o campo de orientador.
  - `<OpportunityForm mode: "create" | "edit" | "duplicate" projectId courses initialValues? onSubmit? />` — os 6 blocos da spec §6.4; Cronograma, Requisitos e Tags recolhidos por padrão (`<details>` ou equivalente) para o caminho mínimo caber em 2 minutos; o toggle "Seleção pela plataforma" fica `disabled` com o rótulo "Em breve" quando `INTERNAL_SELECTION_AVAILABLE` é `false`; mostra `DEADLINE_LABEL` abaixo do prazo; presets por categoria (spec §6.4) só pré-preenchem quando o campo ainda está vazio; erros por campo vindos de `fieldErrors`. Botão de envio desabilitado enquanto pendente.
  - `<TurnstileWidget siteKey bypass onToken(token) />` — `bypass` chama `onToken(E2E_TURNSTILE_TOKEN)` sem carregar script; senão carrega `https://challenges.cloudflare.com/turnstile/v0/api.js` e renderiza o widget.
  - `<PublishWizard courses siteKey bypass />` — passo 1 (`ProjectFields`) → "Continuar" valida no cliente só os obrigatórios → passo 2 (`OpportunityForm` sem envio próprio) + Turnstile → "Publicar" chama `createProjectWithOpportunityAction`; erro de campo do projeto volta ao passo 1; sucesso → `router.push(/projetos/{projectId})`. O estado do passo 1 vive no componente.
  - `/publicar`: `requireAuthPage`; se `listProjectsUserCanPublishIn` vazio → `<PublishWizard>`; senão lista os projetos (link para `/projetos/{id}/processos/novo`) e um botão "Criar novo projeto" que mostra o wizard (`?novo=1`).
  - Cabeçalho: link **"Publicar processo"** → `/publicar` para usuário logado, antes do nome.

- [ ] **Step 1: E2E que falha** (`e2e/publicar.spec.ts`, `loginAs` igual a `e2e/auth.spec.ts`):
  - `"usuário sem projeto publica projeto e processo só com os obrigatórios"`: `loginAs("lider@unifei.edu.br", "Líder")` → clica "Publicar processo" no cabeçalho → preenche nome, categoria, descrição curta, e-mail de contato → "Continuar" → título, descrição, prazo (hoje + 10 dias), link do edital `https://unifei.edu.br/edital.pdf` → "Publicar" → URL `/projetos/<uuid>`, heading com o nome do projeto, o título do processo visível em "Abertos".
  - `"link http é recusado com mensagem"`: no passo 2, link `http://x.com` → mensagem `HTTPS_ONLY` visível, URL continua `/publicar`.
  - `"seleção pela plataforma aparece como Em breve e desabilitada"`.
  - `"tag nova criada com Enter aparece como badge"`.
- [ ] **Step 2: Rodar e ver falhar:** `pnpm test:e2e -- e2e/publicar.spec.ts` → FAIL.
- [ ] **Step 3: Implementar** os componentes e a página (o painel `/projetos/[id]` mínimo para o redirect existir vem da Task 10 — implemente a Task 9 com um `page.tsx` provisório que mostra o heading e a lista "Abertos" via `getProjectPanel`, e a Task 10 o completa).
- [ ] **Step 4: Rodar de novo** → PASS; `pnpm lint && pnpm tsc --noEmit && pnpm test` verdes.
- [ ] **Step 5: Commit:** `git commit -m "feat(organizador): wizard de projeto + processo e combobox de tags"`

---

### Task 10: Painel, edição, membros e `/painel`

**Files:**
- Create/Modify: `src/app/(organizer)/projetos/[projectId]/page.tsx`, `…/editar/page.tsx`, `…/processos/novo/page.tsx`, `…/processos/[opportunityId]/editar/page.tsx`, `…/membros/page.tsx`, `src/components/projects/project-panel.tsx`, `src/components/projects/opportunity-row.tsx`, `src/components/projects/member-manager.tsx`, `src/components/projects/archive-project-button.tsx`
- Modify: `src/app/(student)/painel/page.tsx`
- Test: `e2e/painel-projeto.spec.ts`

**Interfaces:**
- Consumes: `requireProjectRolePage` com `ALL_ROLES`/`EDITOR_ROLES`/`OWNER_ONLY` e `{ allowInactive: true }` nas páginas de leitura; `getProjectPanel`, `listMembers`, `listMyProjects`, `listCourses`, `getOpportunityFormValues`; actions da Task 8; `daysUntil`, `formatDay`.
- Produces (comportamento):
  - **Painel** (spec §6.9): cabeçalho com nome, sigla, categoria, status e papel; `SYSTEM_ADMIN` sem membership vê `"Administrador do sistema (somente leitura)"` e nenhuma ação. Projeto não-`ACTIVE`: aviso do status e nenhuma ação. "Abertos": título, `DEADLINE_LABEL` em `font-mono`, âmbar quando `daysUntil ≤ 7`, vagas, canais ("Edital" / "Plataforma"). "Encerrados" recolhido, com `formatDay(closedOn)` ("Encerrado em …") ou "Encerrado" quando `closedOn` é `null`. Ações por papel: Editar e "Encerrar agora" (com `AlertDialog` de confirmação) só em abertos; Duplicar em todos (para OWNER/ADMIN em projeto ativo). Links: "Novo processo", "Editar projeto", "Membros"; OWNER vê "Arquivar projeto" (confirmação: `"Arquivar encerra todos os processos do projeto e não pode ser desfeito nesta versão."`).
  - **Editar projeto**: `ProjectFields` com os valores atuais → `updateProjectAction`.
  - **Novo processo**: `OpportunityForm mode="create"`; com `?duplicar=<uuid>`, `mode="duplicate"` e `initialValues` de `getOpportunityFormValues(…, "duplicate")` (uuid inválido ou alheio → 404).
  - **Editar processo**: `mode="edit"`; processo encerrado → página mostra `OPPORTUNITY_CLOSED` com link "Duplicar" em vez do formulário.
  - **Membros**: lista para todos os papéis; OWNER vê formulário (e-mail + papel ADMIN/REVIEWER), troca de papel e remover; não-OWNER vê "Sair do projeto".
  - **`/painel`**: título `"Olá, {nome}"` mantido; seção **"Meus projetos"** com `listMyProjects` (nome, sigla, papel; link para o painel) e botão **"Publicar processo seletivo"** → `/publicar`; vazio → texto `"Você ainda não participa de nenhum projeto."`.

- [ ] **Step 1: E2E que falha** (`e2e/painel-projeto.spec.ts`; cria o projeto pelo wizard com um helper local que reaproveita os passos da Task 9):
  - `"encerrar processo move para Encerrados"`: no painel, "Encerrar agora" → confirmar → item some de "Abertos" e aparece em "Encerrados" com `Encerrado em dd/mm/aaaa`.
  - `"duplicar abre formulário pré-preenchido sem prazo"`: "Duplicar" → título igual, campo de prazo vazio.
  - `"REVIEWER vê o painel sem botões de edição"`: em outro `browser.newContext()`, `loginAs("revisor@unifei.edu.br")` (cria a conta); o dono adiciona `revisor@unifei.edu.br` como REVIEWER em "Membros"; o revisor abre o painel → vê o processo, não vê "Editar", "Encerrar agora", "Duplicar" nem "Novo processo".
  - `"e-mail sem conta mostra mensagem orientadora"`: adicionar `ninguem@unifei.edu.br` → `MEMBER_NO_ACCOUNT` visível.
  - `"/painel lista Meus projetos"`.
  - `"painel de projeto alheio é 404"`: outro usuário abre `/projetos/<uuid do projeto>` → 404.
- [ ] **Step 2: Rodar e ver falhar:** `pnpm test:e2e -- e2e/painel-projeto.spec.ts` → FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar tudo:** `pnpm lint && pnpm tsc --noEmit && pnpm test && pnpm test:e2e` → PASS. `pnpm build` sem erro (prova que nada lê env no build).
- [ ] **Step 5: Commit:** `git commit -m "feat(organizador): painel do projeto, edição, duplicação e membros"`

---

## Self-review (feito)

- Cobertura da spec: §6.1 rotas → T9/T10; §6.2 schema → T1; §6.3 regra → T2 (+ uso em T6/T8/T10); §6.4 formulários/validação/slugs/transação → T2/T3/T5/T9; §6.5 flag → T3/T9; §6.6 membros/admin/ACTIVE → T5/T7/T10; §6.7 tags → T4/T9; §6.8 Turnstile/limites/ids → T4/T5/T8; §6.9 painel → T10; §6.10 docs → T1; §6.11 testes → distribuídos; §7 critério 2 (2 minutos) → caminho mínimo do E2E da T9 com blocos opcionais recolhidos; critério 6 → T1.
- Interpretação registrada: a spec §6.6 diz que banido recebe "a mesma mensagem genérica"; o plano usa **a mesma mensagem do e-mail sem conta** (`MEMBER_NO_ACCOUNT`) para sem conta, banido e outra instituição, porque mensagens diferentes revelariam o banimento.
- Interpretação registrada: a spec §6.4 distinguia criação e edição na regra "prazo ≥ hoje", mas as duas resultam na mesma condição (dia do prazo ≥ hoje em Brasília); o plano usa uma regra só.
- Decisão do plano: `bypass` do Turnstile só com `ENABLE_TEST_AUTH=true` fora de produção (mesma guarda da D33), para o E2E não depender da rede da Cloudflare; dev normal usa as chaves de teste com o widget real.
