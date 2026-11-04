# Moderação mínima Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Denúncias da comunidade, ocultação automática e ações de ocultar e restaurar em `/admin`, com auditoria e reindexação.

**Architecture:** O serviço `src/lib/moderation/` concentra as mudanças de estado e é o único caminho de escrita de status por moderação. As actions são finas. A busca é atualizada pelas funções de `src/lib/search/index-documents.ts`.

**Tech Stack:** Next.js 16, Drizzle, Zod 4, Vitest, Playwright, Resend (já instalado).

**Spec:** `docs/superpowers/specs/2026-11-04-moderacao-design.md`

## Global Constraints

- Ações de admin passam por `requireSystemAdmin` ou `authorizeSystemAdmin`; não admin recebe `NotFoundError` com registro (D24).
- Todo input passa por Zod. Textos em pt-BR.
- Ordem de travas: trava do projeto (`lockProjectSearchDocuments`) primeiro, depois linhas.
- Reconstrução do vocabulário sempre depois do commit, por `scheduleVocabularyRebuild`.
- Log nunca leva objeto de erro nem dado pessoal: só nome e `cause.code`.
- E-mail depois do commit, em `after()`, sem afetar a operação.
- pnpm apenas. Sem `pkill` amplo.

## Review Focus

1. Cinco denúncias simultâneas de usuários distintos: o alvo é ocultado uma vez, com um único e-mail aos admins.
2. Restaurar um projeto que estava `ARCHIVED` antes: volta a `ARCHIVED`, não a `ACTIVE`.
3. Ocultar o projeto e depois restaurar um processo dele: o processo continua fora do ar enquanto o projeto estiver oculto.
4. Denúncia com id inexistente ou de alvo de outra instituição: mesma resposta, nada gravado.
5. Admin que também é membro denunciado: as ações de admin continuam valendo e ficam auditadas.

---

### Task 1: Serviço de moderação

**Files:**
- Modify: `src/db/schema/moderation.ts`, `src/db/schema/projects.ts`, `src/db/schema/opportunities.ts`, `src/lib/security/audit.ts`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`
- Create: migration em `drizzle/`, `src/lib/moderation/service.ts`, `src/lib/validation/moderation.ts`
- Test: `tests/integration/moderation.test.ts`

**Interfaces:**
- Produces:
  - Colunas `reports.reason_code` (`SPAM | FALSE_INFO | INAPPROPRIATE | OTHER`), `reports.resolved_at`, índice em `(target_type, target_id)` onde `resolved_at` é nulo.
  - `projects.status_before_moderation` e `opportunities.status_before_moderation`, ambas nulas.
  - `hideTarget(admin: AuthUser, input: { targetType: "PROJECT" | "OPPORTUNITY"; targetId: string; reason: string }, opts?: { ipAddress?: string | null }): Promise<void>`.
  - `restoreTarget(admin, input, opts?)` com a mesma forma.
  - `dismissReports(admin, { targetType, targetId, reason }, opts?)`.
  - `applyAutomaticReview(tx: Tx, target: { targetType; targetId }): Promise<boolean>`, que devolve `true` se ocultou agora.
  - `REPORT_THRESHOLD = 5`.
  - Ações de auditoria `PROJECT_SUSPENDED`, `PROJECT_RESTORED`, `OPPORTUNITY_HIDDEN`, `OPPORTUNITY_RESTORED`, `REPORTS_DISMISSED`, `TARGET_AUTO_REVIEW`.

- [ ] **Step 1: Testes que falham**

`hideTarget` em projeto `ACTIVE` grava `SUSPENDED`, `status_before_moderation = ACTIVE` e auditoria com motivo, estado anterior e novo; os processos somem de `search_documents`/vitrine. Em processo `OPEN` grava `UNDER_REVIEW`. `restoreTarget` volta ao estado guardado (inclusive `ARCHIVED` e `CLOSED`), zera a coluna, resolve as denúncias pendentes do alvo e reindexa. Restaurar algo não oculto: `DomainError`. Processo restaurado com projeto oculto continua fora da vitrine. Não admin: `NotFoundError` com auditoria `ADMIN_ACCESS_DENIED`. Motivo com 9 ou 501 caracteres: `ValidationError`. Alvo de outra instituição: `NotFoundError`.

`applyAutomaticReview`: com 4 denúncias pendentes distintas, nada; com 5, `UNDER_REVIEW`, `status_before_moderation` guardado, auditoria `TARGET_AUTO_REVIEW` sem ator e retorno `true`. Alvo já oculto: retorno `false`. Denúncias resolvidas não contam.

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test:integration tests/integration/moderation.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Gerar a migration com `pnpm db:generate`. Tudo numa transação: trava do projeto, linha com `FOR UPDATE`, mudança de estado, auditoria e `refreshProjectSearchDocuments` ou `refreshSearchDocument`. Depois do commit, `scheduleVocabularyRebuild`. Atualizar o comentário de `publicOpportunitySql` em `src/lib/public/queries.ts` para apontar para o serviço. Registrar D46 em `docs/DECISIONS.md` com as decisões da spec §7 e atualizar `docs/ARCHITECTURE.md`.

- [ ] **Step 4: Rodar e confirmar**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -m "feat(moderacao): ocultar, restaurar e revisão automática"`

### Task 2: Denunciar

**Files:**
- Create: `src/lib/moderation/reports.ts`, `src/actions/report.actions.ts`, `src/components/moderation/report-dialog.tsx`, `src/lib/email/templates/review-alert.tsx`
- Modify: `src/lib/validation/moderation.ts`, `src/lib/email/notify.ts`, `src/app/(public)/processo/[slug]/page.tsx`, `src/app/(public)/projeto/[slug]/page.tsx`, `src/lib/security/rate-limit.ts`
- Test: `tests/integration/reports.test.ts`, `e2e/denuncia.spec.ts`

**Interfaces:**
- Consumes: `applyAutomaticReview`, `REPORT_THRESHOLD`.
- Produces: `reportTarget(user: AuthUser, input: { targetType; targetId; reasonCode; description? }): Promise<{ autoHidden: boolean; institutionId: string; targetType; targetId }>`. `notifyReviewAlert(target: { institutionId: string; targetType; targetId }): Promise<void>`. `reportLimiter` com 10 por dia.

- [ ] **Step 1: Testes que falham**

`reportTarget` grava a denúncia e chama a revisão automática na mesma transação. Repetida retorna sucesso sem nova linha. Membro do projeto recebe `DomainError`. Id inexistente, de outra instituição ou alvo já oculto antes de qualquer denúncia própria têm o mesmo comportamento observável que um alvo válido para quem denuncia, sem gravar nada quando o alvo não existe. A 11ª no dia dá `RateLimitError`. Com 5 chamadas concorrentes de usuários distintos, o retorno `autoHidden: true` aparece exatamente uma vez. `notifyReviewAlert` envia um e-mail a cada `SYSTEM_ADMIN` não banido da instituição, com tipo, nome e link `/admin`.

E2E: usuário logado denuncia um processo e vê "Recebemos sua denúncia."; visitante sem sessão não vê o botão; membro não vê o botão.

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test:integration tests/integration/reports.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Trava do projeto do alvo antes de contar, para a concorrência. A resposta da action é sempre "Recebemos sua denúncia." quando não há erro de validação ou limite. O e-mail é disparado na action, em `after()`, só quando `autoHidden`. O diálogo usa componentes de `src/components/ui` e devolve o foco ao botão.

- [ ] **Step 4: Rodar e confirmar**

Run: `pnpm test && pnpm test:e2e e2e/denuncia.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -m "feat(moderacao): denúncias da comunidade"`

### Task 3: Fila e ações em /admin

**Files:**
- Create: `src/lib/moderation/queries.ts`, `src/actions/moderation.actions.ts`, `src/components/moderation/admin-queue.tsx`, `src/components/moderation/moderation-dialog.tsx`
- Modify: `src/app/admin/page.tsx`
- Test: `tests/integration/moderation-queries.test.ts`, `e2e/admin-moderacao.spec.ts`

**Interfaces:**
- Consumes: `hideTarget`, `restoreTarget`, `dismissReports`.
- Produces: `listReportQueue(admin: AuthUser): Promise<QueueItem[]>`, com `QueueItem = { targetType; targetId; name; projectName; status; pendingCount; reasons: { code; count }[]; descriptions: string[] }`. `searchModerationTargets(admin: AuthUser, q: string): Promise<TargetRow[]>`, até 20 itens, por nome sem acento.

- [ ] **Step 1: Testes que falham**

A fila traz só alvos com denúncias pendentes, ordenados por `pendingCount` decrescente, sem id nem nome de quem denunciou. A busca encontra projeto ou processo em qualquer estado, inclusive oculto. Não admin: `NotFoundError`.

E2E com admin de teste: ocultar processo com motivo e conferir que some de `/processos`; restaurar e conferir que volta; descartar denúncias e conferir que a fila esvazia. Fluxo só com teclado.

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test:integration tests/integration/moderation-queries.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Página protegida por `requireSystemAdminPage("/admin")`. A busca usa parâmetro `q` na URL. As actions passam o IP para a auditoria. Seguir `docs/DESIGN_SYSTEM.md`.

- [ ] **Step 4: Rodar e confirmar**

Run: `pnpm test && pnpm test:e2e e2e/admin-moderacao.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -m "feat(admin): fila de denúncias e ações de moderação"`

### Task 4: Efeitos visíveis e logs

**Files:**
- Modify: `src/app/(organizer)/projetos/[projectId]/page.tsx`, `src/lib/projects/queries.ts`, `src/lib/applications/queries.ts`, `src/lib/public/telemetry.ts`, `src/app/(public)/processo/[slug]/page.tsx`, `src/app/(public)/processo/[slug]/edital/route.ts`, `src/lib/search/query.ts`, `src/lib/search/index-documents.ts`
- Create: `src/lib/log.ts`
- Test: `tests/integration/application-queries.test.ts`, `tests/unit/log.test.ts`, `e2e/painel-projeto.spec.ts`

**Interfaces:**
- Produces: `logError(context: string, error: unknown): void`, que registra o contexto, `error.name` e `cause.code` quando houver, e nada mais.

- [ ] **Step 1: Testes que falham**

`logError("x", erro com mensagem secreta e cause.code "23505")` não imprime a mensagem e imprime `23505`. Em "Minhas candidaturas", processo de projeto `SUSPENDED` ou `UNDER_REVIEW` vem com `opportunitySlug` nulo. E2E: painel de projeto oculto mostra "Oculto pela moderação" e o motivo.

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test:unit tests/unit/log.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Trocar por `logError` os `console.error` que recebem objeto de erro nos arquivos listados e em `src/actions/result.ts`, se a forma ali for equivalente. Achar o restante com `grep -rn "console.error" src`. O motivo exibido ao membro vem do último registro de moderação do projeto em `audit_logs`.

- [ ] **Step 4: Rodar e confirmar**

Run: `pnpm lint && pnpm tsc --noEmit && pnpm test && pnpm test:e2e && pnpm build`
Expected: tudo PASS.

- [ ] **Step 5: Commit**

`git commit -m "feat(moderacao): aviso ao projeto oculto e logs sem dados"`
