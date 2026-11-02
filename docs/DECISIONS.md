# Registro de Decisões — Vértice (MVP UNIFEI)

Este documento resolve as divergências entre `PRD.md`, `ARCHITECTURE.md`, `DESIGN_SYSTEM.md` e `CLAUDE.md`.
**Em caso de conflito, este arquivo prevalece** até que os demais documentos sejam atualizados para refleti-lo.

Status: **APROVADO** (2026-10-27). Os demais documentos já foram atualizados para refletir estas decisões.

---

## 1. Stack e Estrutura

| # | Tema | Decisão | Motivo |
|---|---|---|---|
| D1 | Versão do Next.js | Última versão estável (≥ 15) com App Router, fixada no `package.json` no scaffold. Tailwind CSS v4. | `CLAUDE.md` dizia 14+, `ARCHITECTURE.md` 15+; não há motivo para começar em versão antiga. |
| D2 | Autenticação | **Better-Auth** (adapter Drizzle). Auth.js descartado. | Já é a escolha detalhada na arquitetura; manter uma só opção evita ambiguidade para os agentes. |
| D3 | Estrutura de pastas | A de `ARCHITECTURE.md §3` (`src/app/(public)`, `(auth)`, `(student)`, `(organizer)`, `admin`, `src/db`, `src/lib`, `src/actions`). | É a mais detalhada; `CLAUDE.md` será corrigido. |
| D4 | Chaves primárias | `uuid` com `defaultRandom()` (UUIDv4) em todas as tabelas. CUID2/UUIDv7 descartados. URLs públicas usam `slug`. | UUIDv4 já elimina enumeração (IDOR); PostgreSQL 16 não gera UUIDv7 nativamente e não precisamos de ordenação por ID. |
| D5 | Testes | **Vitest** para unidades puras (match, normalização de tags, validador de URL) e para integração de Server Actions/guards contra um Postgres real de teste (container `postgres-test` no `docker-compose`). **Playwright** para 2–3 fluxos críticos E2E (publicar vaga, candidatar-se, mover no Kanban), adicionados nos subprojetos correspondentes. | O fluxo Superpowers usa TDD; guards de segurança precisam ser testados contra o banco real, não mocks. |
| D6 | Specs e planos | Specs em `docs/superpowers/specs/YYYY-MM-DD-<tema>-design.md`; planos em `docs/plans/YYYY-MM-DD-<tema>.md`. | Convenção do Superpowers + pasta já prevista na arquitetura. |
| D30 | Gerenciador de pacotes | **pnpm** (lockfile `pnpm-lock.yaml`; Dockerfile usa `corepack enable` + `pnpm install --frozen-lockfile`). | Preferência do autor. |

## 2. Motor de Match

Adota-se o **modelo de `ARCHITECTURE.md §5`** (é o mais preciso e implementável). O PRD será atualizado para referenciá-lo em vez de repetir uma fórmula diferente.

| # | Tema | Decisão |
|---|---|---|
| D7 | Fórmula | `A = round(Φ · (0.35·S_tema + 0.45·S_hab + 0.20·S_ctx) · 100)`, com `S_tema` = cobertura + Jaccard (0.7/0.3) e `S_hab` = `S_learn` (25%) + `S_tech` (20%), conforme ARCHITECTURE. |
| D8 | Proficiência | ρ ∈ {0.7, 0.9, 1.0} (Iniciante/Intermediário/Avançado). Sem proficiência preenchida → 0.7. O α ∈ {1.0, 1.25, 1.5} do PRD é descartado (poderia passar de 1 e quebrar o intervalo [0,1]). |
| D9 | Elegibilidade | Φ = 1.0 (curso elegível ou vaga aberta a todos) / **0.45** (curso restrito), com aviso `WARNING` na explicação. |
| D10 | Bolsa | Se o aluno prefere bolsa e a vaga é só `VOLUNTARY`, o sub-eixo bolsa vale **0.25**. |
| D11 | Objetivo de carreira no score | **Não entra no score do MVP** (fica só no perfil/currículo). `S_ctx` = 50% categoria + 50% bolsa. Pode virar trabalho futuro na monografia. |
| D12 | Faixas | **HIGH ≥ 80**, MEDIUM ≥ 50, LOW < 50. O mesmo limiar de 80 vale para o badge esmeralda e para o *Match Digest* por e-mail. |
| D13 | Cache | Sem cache persistente no MVP: o score é calculado em memória na requisição (função pura) sobre as vagas abertas. Na escala de uma universidade (centenas de vagas) isso é barato. Snapshot salvo apenas em `applications.matchScoreSnapshot`. |

## 3. Domínio e Schema

| # | Tema | Decisão |
|---|---|---|
| D14 | Nomes de enums | Valem os do schema: `application_status` = `APPLIED, IN_REVIEW, INTERVIEW, ACCEPTED, REJECTED`; `application_mode` = `INTERNAL, EXTERNAL`. O PRD (`SUBMITTED`, `INTERNAL_APPLY`) será ajustado. |
| D15 | Objetivo de carreira | Vira `pgEnum career_goal` = `ACADEMIC, INDUSTRY, IMPACT, LEADERSHIP, EXPLORING` (inclui "Liderança e gestão" do PRD). |
| D16 | Better-Auth × `users` | A tabela `users` é a tabela de usuário do Better-Auth (via `modelName` + `additionalFields`: `institutionId`, `systemRole`, `isBanned`), com IDs UUID. As tabelas próprias do Better-Auth (`sessions`, `accounts`, `verifications`) são geradas pelo CLI dele e incluídas no schema Drizzle. Banir usuário apaga suas linhas em `sessions`. |
| D17 | Novas tabelas (lacunas do PRD) | **`application_events`** — histórico do Kanban: `applicationId, fromStatus, toStatus, message, actorUserId, createdAt`. |
| | | **`external_application_marks`** — botão "Já me inscrevi neste edital": `userId, opportunityId, createdAt`, único por par. Aparece em "Minhas Candidaturas". |
| | | **`opportunity_external_clicks`** — deduplicação de cliques: `opportunityId, visitorHash, day`, único pelo trio. `visitorHash` = HMAC(segredo, IP + User-Agent); **IP bruto nunca é armazenado** (LGPD). O contador `externalClicksCount` só incrementa quando a inserção é nova. |
| | | **`reports`** — denúncias: `institutionId, targetType (PROJECT/OPPORTUNITY), targetId, reporterUserId, reason, createdAt`, único por (reporter, alvo). |
| D18 | Denúncias | Ao atingir **5 denúncias distintas**, o alvo vai para o novo status **`UNDER_REVIEW`** (adicionado a `project_status` e `opportunity_status`), some da timeline e o admin recebe e-mail. |
| D19 | Vaga externa | ~~`applicationMode = EXTERNAL` exige `externalUrl` https (Zod `refine` + `CHECK` no banco). `INTERNAL` ignora `externalUrl`.~~ **Substituída pela D34.** |
| D20 | Unsubscribe | Link de *one-click unsubscribe* com token HMAC assinado (sem tabela extra); desliga `emailAlertsEnabled`. |
| D21 | Texto das vagas | Markdown restrito (negrito, itálico, listas, links https) renderizado sem HTML bruto; validado e limitado por Zod no servidor. |
| D31 | Cadastro restrito ao domínio institucional | **Só e-mails `@unifei.edu.br` podem criar conta ou entrar.** Validado no servidor (hook do Better-Auth) contra `institutions.allowedEmailDomains`. Substitui o PRD §2.3 ("qualquer e-mail pode criar conta"). Consequências: o campo `users.isInstitutionalEmail` deixa de existir (todo usuário é institucional); `projects.hasInstitutionalBadge` passa a significar **"projeto verificado pelo admin"**, concedido/revogado manualmente no `/admin`; `projects.contactEmail` continua aceitando qualquer e-mail (é só contato público). | Decisão do autor (2026-10-27): reduz spam e contas falsas. Custo aceito: calouros sem e-mail institucional ativo ainda não conseguem se cadastrar. |
| D34 | Edital e seleção pela plataforma não são excludentes | Substitui D19 e o "Modo A × Modo B" do PRD RF05. Cada vaga tem **dois canais independentes**: (a) **link do edital** (`externalUrl`, opcional, https) — acesso livre sem login, com contagem de cliques; (b) **seleção pela plataforma** (`internalSelectionEnabled`, boolean) — candidatura no Vértice e gestão no Kanban. A vaga precisa ter **pelo menos um** dos dois (Zod + `CHECK`); pode ter ambos. O enum `application_mode` deixa de existir (migration no subprojeto Projeto + Vaga). O botão "Já me inscrevi neste edital" só aparece quando a vaga **não** usa seleção pela plataforma. | Decisão do autor (2026-10-27): na UNIFEI o edital oficial é a formalização, mas o controle do processo fica a cargo de cada equipe; adotar o Vértice para a gestão é opcional e cabe ao projeto. |
| D35 | Cronograma e requisitos do processo seletivo | A vaga ganha: (a) **Cronograma** — encerramento das inscrições passa a ser obrigatório (`deadlineAt` NOT NULL); datas **opcionais** de abertura das inscrições, entrevista/dinâmica, resultado e início das atividades; (b) **Requisitos formais**, todos opcionais — período mínimo do curso, disponibilidade de horário exigida (texto curto) e vedação de acúmulo de bolsa (boolean). **Sem CR mínimo** (descartado pelo autor). | Decisão do autor (2026-10-27): os editais da UNIFEI trazem cronograma e requisitos formais; são os dados que o aluno usa para decidir se vale abrir o link do edital. |
| D36 | Visibilidade de processos encerrados | A vitrine e as telas iniciais mostram **apenas processos abertos**. Encerrados são acessíveis só por filtro explícito ("incluir encerrados") e no histórico da página pública do projeto — nunca priorizados em busca ou ordenação. A página pública do projeto permanece acessível mesmo sem processo aberto. | Decisão do autor (2026-10-27): o produto é uma gestão/consulta de processos seletivos — o que importa é quais editais estão abertos, quando fecham e o que pedem; o histórico serve só de referência. |
| D37 | Rotas públicas | `/processos` (busca), `/processo/[slug]`, `/processo/[slug]/edital` (redirect com contagem) e `/projeto/[slug]`. `/projetos/[uuid]` segue privada. Público = processo não `UNDER_REVIEW` de projeto `ACTIVE` ou `ARCHIVED`. | Decisão técnica (Claude, 2026-11-02). |
| D38 | Popularidade | `viewsCount + externalClicksCount`, sem janela de 30 dias. Substitui D29 até existirem candidaturas e dados por período. | Decisão técnica (Claude, 2026-11-02): as contagens atuais são acumuladas. |
| D39 | Busca | Cascata no PostgreSQL: FTS `portuguese` em duas formas, corretor por vocabulário público, sinônimos em tabela e `LIKE` para siglas. Sem motor dedicado, BM25 ou `pgvector` por ora. Toda correção é visível e reversível. Refina a busca da spec da vitrine §5.4. | Pesquisa de 2026-11-02 (`reports/Busca inteligente em português.md`); autorizada pelo autor. |
| D40 | Quando pedir conta | Busca, filtros e edital seguem sem login. Conta é **obrigatória só para candidatura pela plataforma**. Para match e "Já me inscrevi neste edital", o login é opcional. | Decisão do autor (2026-11-02): quem segue 100% pelo edital não precisa de registro. |
| D41 | Processo com abertura futura | Aparece na vitrine com o selo "Abre em dd/mm" e o link do edital disponível. O card mostra o selo e o prazo juntos, em duas linhas (o prazo mantém o âmbar quando urgente). A candidatura pela plataforma só libera na data de abertura e deve checar `opensInFuture`, pois `isOpen` segue `true` antes dela. | Decisão do autor (2026-11-02). |
| D42 | Log de buscas | Registra **só buscas sem resultado**: termo e contagem por dia, sem IP nem sessão, apagados em **90 dias**. Termo raro pode conter nome de pessoa, daí a retenção curta. Teto de 1000 termos novos por instituição por dia, para a tabela não crescer sem limite. | Decisão do autor (2026-11-02). |
| D43 | Moderação | Versão mínima **depois de Candidatura + Kanban e antes do lançamento público**: ocultar processo ou projeto, motivo no log de auditoria, denúncias e reindexação automática. Métricas e demais telas de `/admin` ficam para depois. | Decisão do autor (2026-11-02). Até lá, ocultar exige SQL manual seguido de `pnpm db:search:rebuild`. |
| D44 | Deploy e limite da busca | `Dockerfile` com imagem separada para migrations, seed e rebuild, rodada antes do site, porque a imagem standalone não traz `pnpm`, `drizzle-kit` nem `tsx`. Node fixado em `>=22.9`. `/processos` tem limite por IP na aplicação, e o Caddy sobrescreve `x-forwarded-for`. Texto de prazo usa `amber-700`, ajustando D25 só para texto pequeno. | Decisão técnica (Claude, 2026-11-02). |
| D45 | Seleção pela plataforma | A opção "Seleção pela plataforma" do processo é liberada. `match_score_snapshot` aceita nulo até existir o motor de match: gravar 0 pareceria um score real. O Kanban usa "Mover para", sem arrastar (teclado e celular funcionam e não há dependência nova). Processo com candidaturas não pode desligar a seleção. **Pergunta fixa:** depois da primeira candidatura, `customQuestion` não muda, para toda resposta continuar ligada à pergunta que o aluno viu. **Candidato que vira membro:** quem se candidatou e depois entra na equipe vê os concorrentes (exige ato do OWNER, e todo candidato já foi avisado de que a equipe vê seus dados), mas não move a própria candidatura: ela conta como não movida e o card aparece sem controles. | Decisão técnica (Claude, 2026-11-02). Spec `2026-11-02-candidatura-kanban-design.md`. |

## 4. Segurança e Limites

| # | Tema | Decisão |
|---|---|---|
| D22 | Limite de projetos | **3 projetos por usuário por dia** (o mais restritivo, do PRD). 20 candidaturas por hora. Limiter em memória (LRU) — válido porque o deploy é de instância única. **Emenda (2026-10-27, spec do Subprojeto 1):** o limite de projetos é contado no banco (projetos em que o usuário é OWNER criados nas últimas 24 h), para sobreviver a reinícios; os demais limites seguem em memória. |
| D23 | Turnstile | Somente na **criação de projeto** (cadastro/login passam pelo Google — ver D32). |
| D24 | Acesso ao `/admin` por não-admin | Responde 404 e registra em `audit_logs`. |
| D32 | Método de login | **Somente "Entrar com Google"** (o e-mail da UNIFEI é Google Workspace). Parâmetro `hd=unifei.edu.br` na tela do Google apenas como conveniência; o servidor revalida domínio (D31) e `email_verified` do token. Sem senha, sem recuperação de senha, sem e-mail de verificação; `requireVerifiedEmail()` deixa de existir. O primeiro login cria a conta. | Decisão do autor (2026-10-27). |
| D33 | Login em testes | Provider de login de teste (sem Google) habilitado **apenas** quando `ENABLE_TEST_AUTH=true` e `NODE_ENV !== "production"`; a aplicação recusa iniciar em produção com a flag ligada. Usado pelos testes de integração e Playwright. | Decisão técnica (Claude): fluxos com Google não são automatizáveis. |

## 5. Visual

| # | Tema | Decisão |
|---|---|---|
| D25 | Cor de destaque | **`#0F3D75`** (azul institucional do PRD). Teal/blue-900 do Design System descartados. Esmeralda `#059669` para match alto, Âmbar `#D97706` para prazo próximo. |
| D26 | Fundo | `stone-50` (`#fafaf9`) — usa o token nativo do Tailwind em vez do `#FAF9F6` customizado (diferença imperceptível). |
| D27 | Fontes | Títulos: **Plus Jakarta Sans**; corpo: **Inter**; dados técnicos: **JetBrains Mono**. Via `next/font`. |
| D28 | Modo escuro | Tokens preparados como variáveis CSS, mas **o modo escuro não entra no MVP**. |
| D29 | Ordenação "Mais populares" | Visitantes: `viewsCount + externalClicksCount + nº de candidaturas` dos últimos 30 dias. |

---

## Próximos passos após aprovação

1. Atualizar `PRD.md`, `ARCHITECTURE.md`, `DESIGN_SYSTEM.md` e `CLAUDE.md` para refletir estas decisões (e o schema com as novas tabelas).
2. Primeiro commit do repositório.
3. Brainstorming → spec → plano do **Subprojeto 0 — Fundação** (scaffold, Docker/Postgres, schema completo, seed, Better-Auth, guards).
