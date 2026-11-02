# Candidatura + Kanban Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que projetos recebam candidaturas no Vértice e conduzam a seleção num Kanban, com o aluno acompanhando etapa e mensagens.

**Architecture:** Serviços em `src/lib/applications/` recebem `AuthUser`, sem `next/*`. Server Actions finas com `runAction`. E-mail isolado em `src/lib/email/`, chamado depois do commit.

**Tech Stack:** Next.js 16, Drizzle, Better-Auth, Zod 4, Resend, React Email, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-02-candidatura-kanban-design.md`

## Global Constraints

- Candidatos só para membros reais do projeto. Não membro recebe `NotFoundError`, igual a inexistente. `SYSTEM_ADMIN` sem membership também.
- Todo input passa por Zod. URLs de perfil: só `https`.
- Regra de aberto: `isOpportunityOpen` mais `opensInFuture` falso, checados no servidor.
- Textos em pt-BR. Datas no fuso de São Paulo.
- pnpm apenas. `pnpm add` falha com `ERR_PNPM_UNEXPECTED_STORE`; passe `--store-dir` com o store que o erro indicar.
- Falha de e-mail nunca desfaz operação nem registra dado do aluno.
- Sem `pkill` amplo.

## Review Focus

1. Aluno com dois cliques simultâneos em "Enviar": uma candidatura, e o segundo vê mensagem amigável.
2. `next=//evil.com` ou `next=/\evil.com`: volta para `/painel`.
3. Lote com candidatura de outro processo ou id inexistente: nada dela é movido nem revelado.
4. Processo com prazo vencendo entre abrir a página e enviar: recusado com mensagem clara.
5. Aluno banido ou sessão expirada no envio: não grava, e o texto digitado não some.

---

### Task 1: Ligar a seleção pela plataforma

**Files:**
- Modify: `src/db/schema/applications.ts`, `src/lib/validation/opportunity.ts`, `src/lib/opportunities/service.ts`, `src/components/projects/opportunity-form.tsx`, `docs/DECISIONS.md`, `docs/ARCHITECTURE.md`
- Create: migration gerada em `drizzle/`, `src/lib/applications/labels.ts`
- Test: `tests/unit/`, `tests/integration/`, `e2e/publicar.spec.ts`

**Interfaces:**
- Produces: `matchScoreSnapshot` aceita nulo. `APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string>` e `APPLICATION_STATUSES` na ordem Inscrito, Em análise, Entrevista, Aprovado, Não selecionado.

- [ ] **Step 1: Testes que falham**

Validação aceita `internalSelectionEnabled: true` sem `externalUrl`; aceita `customQuestion` até 280 e recusa 281; `customQuestion` é descartada quando a seleção está desligada. Serviço: desligar a seleção com candidatura existente lança `DomainError` com "Este processo já tem candidaturas."; desligar sem candidaturas funciona. E2E: publicar processo só com seleção pela plataforma e pergunta.

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test`
Expected: FAIL nos novos casos.

- [ ] **Step 3: Implementar**

Remover `INTERNAL_SELECTION_AVAILABLE`, a mensagem de indisponível e o "Em breve". Mostrar o campo da pergunta quando a opção estiver ligada. Gerar a migration com `pnpm db:generate`. Registrar em `docs/DECISIONS.md` a D45: `match_score_snapshot` aceita nulo até existir match, e o Kanban usa "Mover para", sem arrastar. Atualizar o schema em `docs/ARCHITECTURE.md`.

- [ ] **Step 4: Rodar e confirmar**

Run: `pnpm test && pnpm test:e2e e2e/publicar.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -m "feat(candidatura): liga a seleção pela plataforma no processo"`

### Task 2: Candidatar-se

**Files:**
- Create: `src/lib/applications/service.ts`, `src/lib/validation/application.ts`, `src/actions/application.actions.ts`, `src/app/(student)/processo/[slug]/candidatar/page.tsx`, `src/components/applications/apply-form.tsx`, `src/lib/auth/next-path.ts`
- Modify: `src/app/(public)/processo/[slug]/page.tsx`, `src/app/(auth)/entrar/page.tsx`, `src/components/layout/sign-in-button.tsx`, `src/lib/security/rate-limit.ts`
- Test: `tests/integration/applications.test.ts`, `tests/unit/next-path.test.ts`, `e2e/candidatura.spec.ts`

**Interfaces:**
- Consumes: `isOpportunityOpen`, `opensInFuture`, `createRateLimiter`.
- Produces: `applyToOpportunity(user: AuthUser, input: ApplyInput): Promise<{ applicationId: string; opportunitySlug: string }>`. `safeNextPath(raw: string | undefined, fallback?: string): string`, com fallback `/painel`. `applicationLimiter` com 20 por hora.

- [ ] **Step 1: Testes que falham**

`applyToOpportunity`: cria candidatura `APPLIED` com `matchScoreSnapshot` nulo, evento com `fromStatus` nulo e perfil atualizado na mesma transação. Recusa com `DomainError`: processo encerrado, prazo vencido, abertura futura, sem seleção pela plataforma, projeto arquivado, repetida (duas chamadas concorrentes geram uma linha e uma mensagem "Você já se candidatou a este processo."), aluno membro do projeto. Slug inexistente ou `UNDER_REVIEW`: `NotFoundError`. Sem resposta quando há pergunta: `ValidationError`. A 21ª em uma hora: `RateLimitError`.

`safeNextPath`: `/processo/x/candidatar` passa; `//evil.com`, `/\evil.com`, `https://evil.com`, vazio e `undefined` dão `/painel`.

E2E: sem sessão, clicar em "Candidatar-se" leva a `/entrar?next=`; com login de teste, preencher e enviar leva a `/minhas-candidaturas` (a rota é criada na Task 3; até lá, confira o redirecionamento). Antes da abertura o botão está desabilitado com "Candidaturas abrem em".

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Bloquear a linha do processo com `FOR SHARE` na transação e tratar a violação de unicidade por `src/lib/db-errors.ts`. Limite: consumir só depois de validar o input. Formulário cliente que mantém o texto em erro, usando `useActionState` ou o padrão de `opportunity-form.tsx`. Página protegida por `requireAuthPage`, com `next` na ida ao login. Mostrar requisitos não atendidos como aviso.

- [ ] **Step 4: Rodar e confirmar**

Run: `pnpm test && pnpm test:e2e e2e/candidatura.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -m "feat(candidatura): candidatura do aluno com perfil curto"`

### Task 3: Minhas candidaturas

**Files:**
- Create: `src/lib/applications/queries.ts`, `src/app/(student)/minhas-candidaturas/page.tsx`
- Modify: `src/app/(student)/painel/page.tsx`, `src/app/(public)/processo/[slug]/page.tsx`
- Test: `tests/integration/application-queries.test.ts`, `e2e/candidatura.spec.ts`

**Interfaces:**
- Produces: `listMyApplications(user: AuthUser): Promise<MyApplication[]>`, com `MyApplication = { id; opportunityTitle; opportunitySlug; projectName; status; appliedAt; messages: { toStatus; message; createdAt }[] }`. `getMyApplicationId(userId: string, opportunityId: string): Promise<string | null>`.

- [ ] **Step 1: Testes que falham**

Lista só as candidaturas do próprio usuário, mais recentes primeiro. `messages` traz só eventos com mensagem, do mais recente ao mais antigo, sem `actorUserId`. Processo de projeto arquivado continua na lista; `UNDER_REVIEW` mostra título sem link. E2E: a página mostra a etapa; na página do processo aparece "Ver minha candidatura" e some "Candidatar-se".

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test:integration tests/integration/application-queries.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

A página do processo é pública: consultar a sessão sem exigir login e só então `getMyApplicationId`. Trocar no painel o texto "Suas candidaturas e seu perfil aparecerão aqui." por link para `/minhas-candidaturas`.

- [ ] **Step 4: Rodar e confirmar**

Run: `pnpm test && pnpm test:e2e e2e/candidatura.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -m "feat(candidatura): página Minhas candidaturas"`

### Task 4: Kanban da equipe

**Files:**
- Create: `src/lib/applications/board.ts`, `src/app/(organizer)/projetos/[projectId]/processos/[opportunityId]/candidatos/page.tsx`, `src/components/applications/board.tsx`, `src/components/applications/move-dialog.tsx`
- Modify: `src/lib/validation/application.ts`, `src/actions/application.actions.ts`, `src/lib/projects/queries.ts`, `src/components/projects/opportunity-row.tsx`
- Test: `tests/integration/application-board.test.ts`, `e2e/kanban.spec.ts`

**Interfaces:**
- Consumes: `requireProjectRole`, `effectiveMembership`, `ALL_ROLES`, `APPLICATION_STATUSES`.
- Produces: `getBoard(user: AuthUser, projectId: string, opportunityId: string): Promise<Board>`. `moveApplications(user: AuthUser, input: MoveInput): Promise<{ moved: { applicationId: string; toStatus: ApplicationStatus; message: string | null }[]; skipped: number }>`, com `MoveInput = { projectId; opportunityId; items: { applicationId; fromStatus }[]; toStatus; message? }`, 1 a 50 itens, mensagem até 2000.

- [ ] **Step 1: Testes que falham**

`getBoard`: agrupa por etapa; não membro e `SYSTEM_ADMIN` sem membership levam `NotFoundError`; processo de outro projeto leva `NotFoundError`.

`moveApplications`: move um e vários, grava evento e `updatedByUserId` e aceita voltar de etapa. `REVIEWER` move. Projeto arquivado lança `DomainError`, processo encerrado move. Item com `fromStatus` antigo é contado em `skipped`, sem evento. Id de outro processo ou inexistente é contado em `skipped` e não muda nada. Mesma etapa de destino é `skipped`. 51 itens: `ValidationError`.

E2E: REVIEWER seleciona dois candidatos, move para Entrevista com mensagem; o aluno vê etapa e mensagem. Fluxo completo só com teclado.

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test:integration tests/integration/application-board.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`moveApplications` trava as linhas por `id` e `opportunity_id` com `FOR UPDATE`, em ordem de `id`, e compara `fromStatus`. Mensagem é gravada em `organizerFeedback` e no evento. Link "Candidatos (N)" em `opportunity-row.tsx` para processos com seleção pela plataforma. Colunas com rolagem horizontal no desktop e lista no celular, sem rolagem horizontal da página. Seguir `docs/DESIGN_SYSTEM.md`.

- [ ] **Step 4: Rodar e confirmar**

Run: `pnpm test && pnpm test:e2e e2e/kanban.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -m "feat(kanban): quadro de candidatos e movimentação em lote"`

### Task 5: E-mails

**Files:**
- Create: `src/lib/email/send.ts`, `src/lib/email/templates/application-received.tsx`, `src/lib/email/templates/status-changed.tsx`, `src/lib/email/notify.ts`
- Modify: `src/env.ts`, `.env.example`, `src/actions/application.actions.ts`, `README.md`, `docs/ARCHITECTURE.md`
- Test: `tests/unit/email.test.ts`, `tests/integration/application-notify.test.ts`

**Interfaces:**
- Consumes: resultados de `applyToOpportunity` e `moveApplications`.
- Produces: `sendEmail(input: { to: string; subject: string; react: ReactElement }): Promise<boolean>`. `notifyApplicationReceived(applicationId: string): Promise<void>`. `notifyStatusChanged(moved: { applicationId: string; toStatus: ApplicationStatus; message: string | null }[]): Promise<void>`.

- [ ] **Step 1: Testes que falham**

`getEnv` em produção sem `RESEND_API_KEY` ou `EMAIL_FROM` lança erro; fora de produção aceita. Sem chave, `sendEmail` não chama a rede e devolve `false`. Com fake: `notifyStatusChanged` envia um e-mail por item, com etapa em pt-BR e mensagem. Falha do provedor em um item não impede os outros e não lança. O log de falha não contém e-mail, nome nem mensagem. Mensagem com `<script>` sai escapada no HTML.

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test:unit tests/unit/email.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Instalar `resend`, `@react-email/components` e `@react-email/render` com `pnpm add` (ver Global Constraints). Chamar as notificações nas actions dentro de `after()`, com `try/catch`. Enviar em sequência. Documentar variáveis no README e em `docs/ARCHITECTURE.md`.

- [ ] **Step 4: Rodar e confirmar**

Run: `pnpm lint && pnpm tsc --noEmit && pnpm test && pnpm test:e2e && pnpm build`
Expected: tudo PASS.

- [ ] **Step 5: Commit**

`git commit -m "feat(email): confirmação de candidatura e mudança de etapa"`
