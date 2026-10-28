# Spec — Subprojeto 0: Fundação

- **Data:** 2026-10-27
- **Status:** Rascunho para aprovação
- **Documentos de referência:** [`DECISIONS.md`](../../DECISIONS.md) (prevalece), [`ARCHITECTURE.md`](../../ARCHITECTURE.md), [`PRD.md`](../../PRD.md), [`DESIGN_SYSTEM.md`](../../DESIGN_SYSTEM.md), [`CLAUDE.md`](../../../CLAUDE.md)

---

## 1. Intenção

O Vértice vai ser construído em cerca de 10 subprojetos (match, tags/busca, projeto + vaga, vitrine, onboarding, candidatura/Kanban, e-mails, admin, deploy). Esta Fundação existe para que **todos os subprojetos seguintes apenas adicionem funcionalidade**, sem precisar mexer em infraestrutura, schema base, autenticação ou autorização.

Ela também concentra as garantias de segurança que o restante do sistema vai assumir como verdadeiras: só entra quem tem conta Google `@unifei.edu.br`; usuário banido não tem sessão; ninguém mexe em projeto sem ser membro dele; a superfície do `/admin` é invisível para não-admins.

## 2. Objetivos

1. Repositório Next.js funcionando com a estrutura de pastas de `ARCHITECTURE.md §3`, pnpm, TypeScript estrito, Tailwind v4, shadcn/ui e ESLint.
2. Base visual do Design System aplicada (tokens, fontes, layout mínimo) para que as telas futuras já nasçam no padrão.
3. Postgres local e de teste via Docker, com o **schema completo do MVP** (todas as tabelas de `ARCHITECTURE.md §4.2`, já com as decisões D14–D21, D31), migrations e seed idempotente.
4. Login com Google restrito a `@unifei.edu.br`, com sessão no banco e banimento efetivo.
5. Guards de autorização centralizados e testados contra banco real.
6. Infraestrutura de testes (Vitest + Playwright) pronta para os próximos subprojetos usarem TDD.

## 3. Não-objetivos (ficam para outros subprojetos)

- Telas de vitrine/timeline, detalhes de vaga, onboarding, perfil, wizard de projeto, Kanban, portal admin real (só um placeholder protegido).
- Motor de match, resolução de aliases de tags, busca com `pg_trgm` (inclusive índices GIN de busca). *(Exceção: a função pura `normalizeTagSlug` entra aqui — ver 6.4.)*
- E-mails (Resend), Turnstile, rate limiting.
- Dockerfile de produção, Caddy e deploy na OCI.
- CI (GitHub Actions).
- Modo escuro (D28).

## 4. Anti-objetivos (seria fracasso mesmo "funcionando")

- Qualquer caminho em que uma conta fora de `@unifei.edu.br` consiga sessão, inclusive pelo login de teste.
- O login de teste existir ou poder ser ligado em produção.
- Guards testados só com mocks (a garantia de segurança tem de ser verificada contra o Postgres real).
- Aparência de template genérico de IA (gradientes, sombras pesadas, `rounded-3xl`, ícones de brilho) — ver `DESIGN_SYSTEM.md §4`.
- IDs sequenciais em qualquer tabela.

## 5. Restrições

- **Stack fixa:** Next.js (última estável ≥ 15, App Router), TypeScript, pnpm (D30), Tailwind v4, shadcn/ui, Drizzle ORM + drizzle-kit, PostgreSQL 16, Better-Auth (D2), Zod, Vitest, Playwright.
- Ambiente do autor: Linux, Node 24, Docker 29 + Compose v5.
- Chaves primárias `uuid` com `defaultRandom()` (D4).
- Toda leitura de variável de ambiente passa por um módulo validado com Zod; a aplicação falha ao iniciar se faltar variável obrigatória.
- Multi-tenant no banco, tenant único na UI: `institutionId` resolvido por `DEFAULT_INSTITUTION_SLUG`.

## 6. Design

### 6.1. Projeto e ferramentas

- Scaffold com `create-next-app` (TypeScript, App Router, `src/`, Tailwind, ESLint), depois `shadcn init`.
- `next.config` com `output: "standalone"` e os headers de segurança de `ARCHITECTURE.md §7.4` (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`).
- Scripts no `package.json`: `dev`, `build`, `start`, `lint`, `test` (Vitest), `test:e2e` (Playwright), `db:generate`, `db:migrate`, `db:seed`.
- `.env.example` documentando todas as variáveis; `.gitignore` cobrindo `.env*` (exceto o exemplo).
- `README.md` curto: pré-requisitos, como subir o ambiente, como rodar testes, como criar credenciais OAuth do Google.

### 6.2. Base visual

- Tokens como variáveis CSS em `globals.css` (bloco `@theme` do Tailwind v4): fundo `stone-50`, superfície branca com borda `stone-200`, texto `stone-900`/`stone-600`, `--brand: #0F3D75`, esmeralda `#059669` (match alto), âmbar `#D97706` (prazo). Os tokens do shadcn/ui (`--primary`, `--border`, `--ring` etc.) são mapeados para esses valores.
- Fontes via `next/font/google`: Plus Jakarta Sans (`font-heading`), Inter (`font-sans`, padrão do corpo), JetBrains Mono (`font-mono`).
- Layout raiz com cabeçalho (nome "Vértice", e à direita "Entrar com Google" ou nome do usuário + "Sair") e rodapé discreto. Visual editorial: bordas finas, sem sombras pesadas.

### 6.3. Rotas desta fase

URLs em português (decisão do Claude):

| Rota | Grupo | Acesso | Conteúdo nesta fase |
|---|---|---|---|
| `/` | `(public)` | Público | Placeholder da futura timeline (título + texto curto) |
| `/entrar` | `(auth)` | Público; usuário logado é redirecionado para `/painel` | Botão "Entrar com Google" + mensagem de erro quando o domínio é recusado |
| `/painel` | `(student)` | `requireAuth` | Placeholder "Olá, {nome}" (prova o fluxo de sessão) |
| `/admin` | `admin` | `requireSystemAdmin` | Placeholder "Portal do administrador" |

### 6.4. Banco de dados

- **`docker-compose.yml` (desenvolvimento)** com dois serviços: `postgres` (porta 5432, volume persistente) e `postgres-test` (porta 5433, `tmpfs`, descartável). Ambos `postgres:16-alpine`. O compose de produção de `ARCHITECTURE.md §8.3` não é escopo desta fase.
- **Extensões** (`uuid-ossp`, `pg_trgm`, `unaccent`) criadas pela **primeira migration** (SQL customizado), para que qualquer banco — dev, teste ou produção — as receba só rodando as migrations. O `init-extensions.sql` do Docker fica opcional.
- **Schema completo** em `src/db/schema/` (modular por domínio, reexportado por um `index.ts`), conforme `ARCHITECTURE.md §4.2` atualizado, incluindo:
  - enums com `UNDER_REVIEW`, `career_goal`, `report_target`;
  - `application_events`, `external_application_marks`, `opportunity_external_clicks`, `reports`;
  - `CHECK` no banco garantindo `external_url` não nula quando `application_mode = 'EXTERNAL'` (D19; o "é https" fica no Zod);
    > Substituído pela D34 no Subprojeto 1: CHECK `opportunities_has_channel`.
  - tabelas do Better-Auth (`sessions`, `accounts`, `verifications`) geradas pelo CLI dele e integradas ao schema, com chaves `uuid` (D16).
- Conexão em `src/db/index.ts` (pool `pg`).
- **Seed** (`pnpm db:seed`), idempotente, conforme `ARCHITECTURE.md §9`: instituição `unifei-itajuba`, cursos, tags verificadas (`AREA` e `SKILL`). Promoção do admin: se `INITIAL_ADMIN_EMAIL` estiver definido e o usuário já existir, vira `SYSTEM_ADMIN`.
  - O seed faz **upsert** pela chave natural (`slug` da instituição, `institutionId + code` do curso, `institutionId + normalizedSlug` da tag), para que correções nos dados do seed cheguem a bancos já populados.
  - Os dados (cursos com instituto, tags) ficam num arquivo de dados separado e fácil de revisar. O **instituto de cada curso é um palpite marcado com comentário `// TODO: revisar instituto`** — o mapeamento de `ARCHITECTURE.md §9` está incorreto e não é crítico (o instituto é só informativo na UI); a lista de cursos e códigos é mantida.
  - Os `normalizedSlug` das tags são gerados pela função pura **`normalizeTagSlug`** (`src/lib/search/tags.ts`, regras de `ARCHITECTURE.md §6.1`), entregue e testada já nesta fase, para que o seed e o cadastro futuro de tags usem exatamente a mesma normalização.
  - Tags compostas do catálogo são desmembradas: "C/C++" vira **C** e **C++**; "PCB / Altium" vira **Design de PCB** e **Altium**.

### 6.5. Autenticação (D31, D32, D33)

- Better-Auth com adapter Drizzle, sessões no banco, provider **Google**. O parâmetro `hd=unifei.edu.br` é enviado só como conveniência de UX.
- **Validação no servidor no momento da criação do usuário e a cada login**: a parte do e-mail após o `@`, em minúsculas, precisa ser **exatamente igual** a um dos domínios de `institutions.allowedEmailDomains` (sem aceitar subdomínios nem sufixos parecidos, como `evilunifei.edu.br`; confirmado pelo autor: alunos e professores usam somente `@unifei.edu.br`) **e** o Google precisa reportar o e-mail como verificado. Caso contrário, nenhuma conta ou sessão é criada e o usuário volta para `/entrar` com mensagem clara ("Use sua conta @unifei.edu.br").
- Na criação do usuário: `institutionId` = instituição padrão; se o e-mail for igual a `INITIAL_ADMIN_EMAIL`, `systemRole = SYSTEM_ADMIN` (cobre o caso em que o admin entra pela primeira vez depois do seed).
- **Banimento:** a Fundação entrega uma função de servidor `banUser(userId, actorId)` que marca `isBanned`, apaga todas as linhas de `sessions` do usuário e grava em `audit_logs`. A tela que a chama é do subprojeto Admin. Um usuário banido que tenta entrar de novo com o Google tem a **criação da sessão recusada** e volta para `/entrar` com a mensagem "Conta suspensa".
- **Login de teste (D33):** um mecanismo para criar sessão sem Google, disponível **somente** com `ENABLE_TEST_AUTH=true` e `NODE_ENV !== "production"`. A aplicação recusa iniciar se a flag estiver ligada em produção (verificação feita na inicialização do servidor, não durante o `next build`). Nesta fase, o E2E roda contra `next dev`; rodar E2E contra o build standalone fica para o subprojeto de deploy. O login de teste **também** aplica a regra de domínio. O mecanismo exato (plugin, rota interna, helper de teste) fica a critério do builder.

### 6.6. Guards e tenant (`src/lib/auth/guards.ts`, `src/lib/tenant.ts`)

- `getDefaultInstitution()`: busca a instituição por `DEFAULT_INSTITUTION_SLUG`, com cache em memória; erro claro se o seed não rodou.
- `requireAuth()`: exige sessão válida e `isBanned = false`; retorna o usuário. Em páginas, banido é redirecionado para `/entrar` com "Conta suspensa".
- `requireProjectRole(projectId, roles)`: exige `requireAuth`, projeto existente da mesma instituição do usuário e membership em `project_members` com papel dentro de `roles`. `SYSTEM_ADMIN` passa sempre, e o acesso é registrado em `audit_logs` (`ADMIN_MAINTENANCE_ACCESS`). Retorna `{ user, project, membership | null }`. Por padrão, só projetos `ACTIVE` passam para membros; uma opção `{ allowInactive: true }` permite **leitura** de projetos `SUSPENDED`, `UNDER_REVIEW` ou `ARCHIVED` (o dono vê o projeto suspenso, mas não edita). `SYSTEM_ADMIN` passa em qualquer status.
- `requireSystemAdmin()`: exige `SYSTEM_ADMIN`; qualquer outro caso (inclusive visitante anônimo) resulta em **404**. Apenas tentativas de **usuários autenticados** são registradas em `audit_logs` (`ADMIN_ACCESS_DENIED`, `targetType = "ROUTE"`, `institutionId` do usuário); visitantes anônimos não geram registro, para que o log não possa ser inundado sem rate limiting.
- **Comportamento por contexto:** em páginas, falta de sessão redireciona para `/entrar`; em Server Actions, os guards lançam erros tipados (`UnauthorizedError`, `ForbiddenError`, `NotFoundError`) que as actions futuras traduzem para resposta. Projeto inexistente e projeto sem permissão são indistinguíveis para quem chama (ambos "não encontrado"), para não revelar a existência de IDs.
  - **Nota (revisão final da Fundação):** `ForbiddenError` **não** foi implementado, de propósito. Recurso sem permissão lança o mesmo `NotFoundError` de recurso inexistente, para que os dois casos continuem indistinguíveis também para as Server Actions. Variantes entregues: `requireAuth`/`requireAuthPage`, `requireProjectRole`/`requireProjectRolePage` e `requireSystemAdmin`/`requireSystemAdminPage` (a variante `*Page` redireciona ou chama `notFound()`; a outra lança `UnauthorizedError` ou `NotFoundError`).
- `logAudit(...)`: helper único para gravar em `audit_logs` (usado pelos guards e por `banUser`). O IP gravado vem do header do proxy quando houver.

### 6.7. Testes

- **Vitest** com dois níveis:
  - unidade: validação de domínio de e-mail, módulo de env;
  - integração contra `postgres-test`: migrations aplicadas no setup global; cada teste começa com banco limpo (truncate ou transação — a critério do builder).
- Casos mínimos obrigatórios de integração:
  - domínio permitido cria usuário com `institutionId` correto; domínio não permitido, subdomínio/sufixo parecido e e-mail não verificado são recusados;
  - usuário banido não consegue criar nova sessão;
  - `normalizeTagSlug` (unidade) segue os exemplos de `ARCHITECTURE.md §6.1`;
  - `INITIAL_ADMIN_EMAIL` vira `SYSTEM_ADMIN` no primeiro login;
  - `requireAuth` recusa sem sessão e recusa usuário banido;
  - `banUser` apaga as sessões e grava auditoria;
  - `requireProjectRole`: OWNER/ADMIN/REVIEWER conforme a lista; não-membro recusado; membro de projeto de outra instituição recusado; projeto suspenso recusado por padrão e liberado com `allowInactive`; `SYSTEM_ADMIN` passa e é auditado;
  - `requireSystemAdmin`: não-admin e anônimo recebem not-found; só o não-admin autenticado gera auditoria;
  - seed idempotente (rodar duas vezes não duplica nada);
  - `CHECK` de `external_url` rejeita vaga `EXTERNAL` sem URL.
- **Playwright**, um fluxo E2E usando o login de teste: entrar → ver `/painel` com o nome → sair → `/painel` redireciona para `/entrar`; e usuário comum em `/admin` vê 404.

## 7. Critérios de aceite

1. `docker compose up -d` sobe os dois bancos; `pnpm db:migrate && pnpm db:seed` popula o banco de dev sem erros (e de novo, sem duplicar).
2. `pnpm lint`, `pnpm tsc --noEmit`, `pnpm test` e `pnpm test:e2e` passam.
3. Com credenciais OAuth reais, `pnpm dev` permite entrar com conta `@unifei.edu.br`; conta Gmail pessoal é recusada com a mensagem de domínio.
4. O conta definida em `INITIAL_ADMIN_EMAIL` acessa `/admin`; outra conta recebe 404.
5. Iniciar a aplicação com `NODE_ENV=production` e `ENABLE_TEST_AUTH=true` falha imediatamente.
6. Visual do layout e da página `/entrar` segue o Design System (fundo stone-50, azul `#0F3D75`, fontes definidas).

## 8. Decisões tomadas pelo Claude nesta spec (para revisão)

- URLs em português (`/entrar`, `/painel`).
- Extensões do Postgres criadas na primeira migration.
- `docker-compose` de dev separado do de produção, com banco de teste em `tmpfs` na porta 5433.
- `banUser` entregue já na Fundação (sem tela).
- Projeto inexistente e sem permissão retornam o mesmo "não encontrado".
- Admin inicial promovido também no primeiro login, não só no seed.
- Domínio de e-mail comparado por igualdade exata (sem subdomínios).
- Banido é barrado já na criação de sessão, com mensagem "Conta suspensa".
- Guard de projeto bloqueia projetos não-`ACTIVE` por padrão, com opção de leitura.
- Acessos anônimos negados ao `/admin` não são auditados.
- E2E desta fase roda contra `next dev`.
- `normalizeTagSlug` antecipado para a Fundação; seed com upsert; tags compostas desmembradas.

## 9. Deixado a critério do builder

- Mecanismo exato do login de teste, respeitando as restrições de 6.5.
- Estratégia de isolamento entre testes de integração.
- Organização interna dos arquivos de schema por domínio.
- Componentes shadcn/ui instalados nesta fase (apenas os necessários: botão, por exemplo).
- Uso ou não de Prettier.
