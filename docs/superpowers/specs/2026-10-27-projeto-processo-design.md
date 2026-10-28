# Spec — Subprojeto 1: Projeto + Processo Seletivo (cadastro e painel)

- **Data:** 2026-10-27
- **Status:** Rascunho para aprovação
- **Documentos de referência:** [`DECISIONS.md`](../../DECISIONS.md) (prevalece; em especial D34, D35, D36), [`PRD.md`](../../PRD.md) RF04/RF05, [`ARCHITECTURE.md`](../../ARCHITECTURE.md), [`DESIGN_SYSTEM.md`](../../DESIGN_SYSTEM.md), [`CLAUDE.md`](../../../CLAUDE.md), spec da [Fundação](2026-10-27-fundacao-design.md)

> Vocabulário: na interface o termo é **"processo seletivo"** (ou "processo"); no código e no banco a entidade continua sendo `opportunities`. Não renomear tabelas.

---

## 1. Intenção

Hoje cada projeto da UNIFEI divulga seus processos seletivos por redes sociais, quadros físicos do instituto e e-mail institucional. A divulgação fica fragmentada e chega quase só a conhecidos dos membros atuais. A inscrição formal passa por um edital oficial da universidade, mas não existe um lugar único onde o aluno veja **quais processos estão abertos, quando fecham e o que pedem**.

O Vértice é essa base unificada e pública. A maioria dos alunos vai só **consultar**, sem login. Quem precisa entrar é quem **publica**: o líder ou professor responsável pelo projeto.

Este subprojeto entrega o lado de quem publica: cadastrar o projeto, publicar processos seletivos com cronograma, requisitos e link do edital, e manter isso atualizado num painel. A vitrine pública que consome esses dados é o Subprojeto 2. Sem este cadastro, a vitrine não tem o que mostrar.

## 2. Objetivos

1. Um líder com conta `@unifei.edu.br` publica seu **primeiro processo em menos de 2 minutos**, num wizard de 2 passos que cria projeto e processo na mesma jornada (PRD RF04).
2. Quem já tem projeto publica novos processos direto pelo painel do projeto, sem refazer os dados do projeto.
3. Cada processo guarda **cronograma** e **requisitos formais** (D35), **link do edital** opcional e a opção de **seleção pela plataforma** (D34), além dos dados já previstos: título, descrição, bolsa, carga horária, número de vagas, cursos elegíveis e tags.
4. **Painel do projeto:** ver os processos (abertos e encerrados), editar, encerrar e duplicar um processo para um novo ciclo; editar os dados do projeto; arquivar o projeto.
5. **Gestão de membros** com os papéis `OWNER` / `ADMIN` / `REVIEWER` (PRD §2.2).
6. **Tags abertas:** combobox com busca e criação de tag na hora, usando a normalização e os aliases existentes (PRD RF01.3).
7. **Proteções da criação de projeto:** Turnstile (D23) e limite de 3 projetos por usuário por dia (D22).
8. **Migration de schema** com D34/D35 e a documentação atualizada.

## 3. Não-objetivos (ficam para outros subprojetos)

- **Vitrine pública, busca, filtros, página pública do processo e do projeto, contagem de cliques no edital:** Subprojeto 2. Aqui o painel não tem link "ver página pública".
- **Renderização do Markdown restrito (D21)** para exibição: fica no Subprojeto 2. Aqui só validamos tamanho e conteúdo no servidor (texto puro com a sintaxe Markdown permitida, sem HTML).
- **Candidatura pela plataforma, Kanban, `customQuestion` em uso, e-mails:** subprojeto de Candidatura/Kanban. Ver 6.5 sobre o que acontece com a opção de seleção pela plataforma.
- **Onboarding do aluno e match.**
- **Funções do `SYSTEM_ADMIN`** (transferir posse, selo de verificado, suspender): subprojeto Admin.
- **Importação de processos a partir de edital ou e-mail:** PRD §7, a refinar com o autor.
- **Convite de pessoas que ainda não têm conta** (ver 6.6).

## 4. Anti-objetivos (seria fracasso mesmo "funcionando")

- O wizard virar um formulário longo e burocrático. O caminho mínimo precisa caber em 2 minutos: os campos opcionais (cronograma além do prazo final, requisitos, tags) não podem bloquear nem poluir o caminho principal.
- Um usuário conseguir editar, encerrar ou ver o painel de um projeto do qual não é membro, ou descobrir que um projeto existe por mensagens de erro diferentes (zero IDOR, mesmo `NotFoundError` da Fundação).
- Um link de edital não-`https` chegar ao banco.
- Um processo publicado sem nenhuma forma de o aluno se inscrever (sem edital e sem seleção pela plataforma).
- Um processo encerrado continuar contando como "aberto" para a vitrine futura.

## 5. Restrições

- Todas as de `CLAUDE.md` e da Fundação: uuid em todas as PKs, Zod em toda Server Action, URLs externas só `https://`, toda ação de projeto passa por `requireProjectRole` (checagem em `project_members` no banco), pnpm, Design System, TDD para validadores e guards.
- Server Actions em `src/actions/` por domínio (`project.actions.ts`, `opportunity.actions.ts`, `tag.actions.ts`, `member.actions.ts` se o builder preferir separar), como em `ARCHITECTURE.md §3`.
- Fuso horário de referência: **`America/Sao_Paulo`**.
- O banco ainda não tem dados reais; a migration pode ser destrutiva no enum `application_mode`.

## 6. Design

### 6.1. Rotas

URLs em português, como na Fundação. Rotas do organizador usam o **uuid** do projeto e do processo (são privadas e sempre passam pelo guard, que valida o uuid antes de consultar); URLs públicas com slug são do Subprojeto 2.

| Rota | Grupo | Acesso | Conteúdo |
|---|---|---|---|
| `/painel` | `(student)` | `requireAuthPage` | Passa a listar **"Meus projetos"** (projetos em que o usuário é membro, com o papel) e o botão **"Publicar processo seletivo"** |
| `/publicar` | `(organizer)` | `requireAuthPage` | Sem projetos onde é `OWNER`/`ADMIN`: wizard de 2 passos (projeto + processo). Com projetos: escolher o projeto (leva ao formulário de novo processo) ou "Criar novo projeto" (wizard) |
| `/projetos/[projectId]` | `(organizer)` | qualquer papel | Painel: dados do projeto, processos abertos e encerrados, atalhos conforme o papel |
| `/projetos/[projectId]/editar` | `(organizer)` | `OWNER`, `ADMIN` | Editar dados do projeto |
| `/projetos/[projectId]/processos/novo` | `(organizer)` | `OWNER`, `ADMIN` | Formulário de processo (o mesmo do passo 2). Aceita `?duplicar=<opportunityId>` para pré-preencher |
| `/projetos/[projectId]/processos/[opportunityId]/editar` | `(organizer)` | `OWNER`, `ADMIN` | Editar processo |
| `/projetos/[projectId]/membros` | `(organizer)` | `OWNER` gerencia; demais papéis só veem a lista | Membros e papéis |

- O cabeçalho passa a mostrar **"Publicar processo"** para usuários logados.
- Projeto inexistente, de outra instituição ou sem permissão: 404 (`requireProjectRolePage`).
- Projeto `ARCHIVED`, `SUSPENDED` ou `UNDER_REVIEW`: o painel abre só para leitura (`allowInactive`), com aviso do status; nenhuma ação de edição é oferecida nem aceita.

### 6.2. Schema (migration nova)

**`opportunities`:**

| Mudança | Detalhe |
|---|---|
| Remove `application_mode` e o enum `application_mode` | D34 |
| Adiciona `internal_selection_enabled boolean NOT NULL DEFAULT false` | D34 |
| `external_url` continua `varchar(500)`, opcional | https validado no Zod |
| Troca o CHECK `opportunities_external_url_required` por `opportunities_has_channel`: `internal_selection_enabled OR external_url IS NOT NULL` | D34 |
| `deadline_at` passa a `NOT NULL` | D35 — encerramento das inscrições |
| Adiciona `applications_open_on date`, `interview_starts_on date`, `interview_ends_on date`, `result_on date`, `activities_start_on date`, todos opcionais | D35 — cronograma |
| Adiciona `availability_requirement varchar(200)` opcional e `no_other_scholarship boolean NOT NULL DEFAULT false` | D35 — requisitos formais |
| Adiciona `closed_at timestamptz` opcional | Momento em que o processo foi encerrado manualmente |
| `min_semester` (já existe) é o "período mínimo"; `max_semester` permanece no schema mas não aparece no formulário | D35 |

**`projects`:** adiciona `acronym varchar(20)` opcional (a "Sigla" do PRD RF04; não existia no schema).

Os campos de data do cronograma são `date` (dia, sem hora). Só o prazo final é `timestamptz`: no formulário o organizador informa o **dia**, e o servidor grava **23:59:59 de `America/Sao_Paulo`** daquele dia. A tela mostra "Inscrições até dd/mm/aaaa, 23h59 (horário de Brasília)".

### 6.3. Quando um processo está "aberto"

Regra única, implementada como função/condição reutilizável em `src/lib/` (o Subprojeto 2 vai usar a mesma):

- **Aberto** = `status = 'OPEN'` **e** `deadline_at > now()` **e** projeto `ACTIVE`.
- **Encerrado** = **tudo que não é aberto** (inclui `CLOSED`, prazo vencido, `UNDER_REVIEW`, `PAUSED` e qualquer processo de projeto não-`ACTIVE`). A "data de encerramento" exibida é `closed_at` quando existe; senão, o prazo (`deadline_at`) se já venceu; senão (processo de projeto inativo ou em revisão), nenhuma.

Não há cron: o vencimento do prazo encerra o processo implicitamente. "Encerrar agora" no painel grava `status = 'CLOSED'` e `closed_at`. Um processo encerrado (por qualquer motivo) **não pode ser reaberto**: o caminho para um novo ciclo é **duplicar**. O painel oferece "Duplicar" em todo processo, aberto ou encerrado, pré-preenchendo um novo processo com tudo exceto as datas. Enquanto o processo está aberto, todos os campos são editáveis, inclusive o prazo. `PAUSED` não é usado nesta fase.

### 6.4. Wizard e formulários

**Passo 1 — Sobre o projeto** (também é o formulário de editar projeto):

| Campo | Regra |
|---|---|
| Nome | obrigatório, 3–140 |
| Sigla | opcional, até 20 |
| Categoria | obrigatória, enum `project_category` |
| Instituto/Departamento | opcional, até 32 |
| Professor orientador / coordenador | opcional, até 120; destacado quando a categoria é IC (`SCIENTIFIC_INIT`) |
| Descrição curta | obrigatória, até 280 |
| Descrição longa | opcional, Markdown restrito (D21), até 5.000 |
| E-mail de contato | obrigatório, qualquer domínio (D31) |
| Site, Instagram | opcionais, `https` estrito |

**Passo 2 — Sobre o processo** (também é o formulário de novo/editar processo). Organizado em blocos, com os opcionais recolhidos ou visivelmente secundários:

1. **Essencial:** título (5–160), descrição das atividades (Markdown restrito, até 5.000), área/função (opcional, `roleArea`, até 80), número de vagas (1–99, padrão 1), **prazo final de inscrição** (obrigatório, dia ≥ hoje na criação).
2. **Como se inscrever** (pelo menos um, D34):
   - **Link do edital/formulário** (`https` estrito, até 500);
   - **Seleção pela plataforma**: ver 6.5.
3. **Bolsa e dedicação:** modalidade (`scholarship_type`: Voluntário, Com bolsa, Ambos), agência de fomento (opcional, até 64), valor mensal em reais (opcional, convertido para centavos, > 0), carga horária semanal (opcional, 4–20 h, como no PRD RF04).
4. **Cronograma** (opcional): abertura das inscrições, entrevista/dinâmica (início e fim), resultado, início das atividades.
5. **Requisitos** (opcional): cursos elegíveis (*Todos* ou seleção dos cursos da instituição), período mínimo (1–12), disponibilidade de horário (texto curto, até 200), "não pode acumular com outra bolsa" (sim/não).
6. **Tags** (opcional): três grupos, um por `opportunity_tag_relation`: **Tema** (`THEME`), **Desejável** (`DESIRED_SKILL`), **O que vai aprender** (`DEVELOPED_SKILL`).

**Validação de datas** (Zod no servidor, mensagens em pt-BR):
- abertura das inscrições ≤ dia do prazo final;
- início da entrevista ≤ fim da entrevista, quando ambos existem; fim da entrevista exige início;
- resultado e início das atividades ≥ dia do prazo final;
- prazo final ≥ hoje só é exigido na **criação** e na **duplicação**; na edição de um processo aberto, o prazo pode ser antecipado mas não para antes de hoje.

**Presets por categoria** (PRD RF04.2), apenas sugestões que o usuário pode alterar: IC pré-seleciona "Com bolsa", sugere agências PIBIC/FAPEMIG/CNPq e destaca o campo de orientador; Projeto Especial sugere áreas comuns como sugestão no campo `roleArea` (Elétrica, Mecânica, Software, Gestão, Marketing).

**Cursos elegíveis:** os uuids enviados precisam pertencer à instituição do usuário (validado no servidor); lista vazia = todos os cursos.

**Slugs** (usados pelas URLs públicas do Subprojeto 2): gerados no servidor a partir do nome/título com `normalizeTagSlug` ou função equivalente, sem acentos. Projeto: slug do nome; se colidir na instituição, sufixo `-2`, `-3`… Processo: slug do título + sufixo curto aleatório (ex.: `-k3f9`), porque títulos se repetem entre ciclos. Slugs **não mudam** quando o nome ou título é editado (URLs estáveis).

**Wizard em uma transação:** o passo 1 não grava nada sozinho; o envio final cria projeto, membership `OWNER` do criador, processo e tags numa única transação. Se o usuário sair no meio, nada fica salvo (o estado do passo 1 pode ser mantido no cliente entre os passos).

### 6.5. Seleção pela plataforma (D34) nesta fase

O schema e a validação suportam `internal_selection_enabled`, mas a candidatura e o Kanban só existem no subprojeto de Candidatura. Para não publicar um botão "Candidatar-se" que não funciona:

- **Nesta fase, a opção aparece no formulário desabilitada, com o texto "Em breve".** O link do edital é, na prática, obrigatório até lá. A validação já implementa a regra final ("pelo menos um dos dois"), e o servidor recusa `internal_selection_enabled = true` enquanto a funcionalidade não existir (flag em código, removida pelo subprojeto de Candidatura).
- `customQuestion` não aparece no formulário nesta fase.

### 6.6. Membros e papéis

| Ação | OWNER | ADMIN | REVIEWER |
|---|---|---|---|
| Ver painel do projeto e processos | ✓ | ✓ | ✓ |
| Editar projeto | ✓ | ✓ | |
| Criar, editar, encerrar, duplicar processo | ✓ | ✓ | |
| Ver lista de membros | ✓ | ✓ | ✓ |
| Adicionar/remover membro, mudar papel | ✓ | | |
| Arquivar projeto | ✓ | | |

- **Exatamente um `OWNER` por projeto.** O OWNER atribui só `ADMIN` ou `REVIEWER`; transferir a posse é função do admin do sistema (PRD RF07). O OWNER não pode remover a si mesmo.
- **Adicionar membro:** pelo e-mail `@unifei.edu.br` de alguém que **já entrou no Vértice ao menos uma vez**. Se o e-mail não tem conta, a mensagem orienta: "Essa pessoa ainda não entrou no Vértice. Peça para ela entrar uma vez com a conta da UNIFEI e tente de novo." Não há convite pendente nem e-mail nesta fase. Usuário banido não pode ser adicionado (mesma mensagem genérica de "não encontrado", para não revelar banimento).
- Qualquer membro pode **sair** de um projeto, exceto o OWNER.
- **`SYSTEM_ADMIN` nesta fase:** o guard da Fundação o deixa **ver** o painel de qualquer projeto da instituição (com a auditoria `ADMIN_MAINTENANCE_ACCESS` que já existe). **Toda escrita** (projeto, processo, membros, arquivamento) exige membership real com o papel da tabela acima: se `membership` vier `null`, a action responde `NotFoundError`. Os poderes de suporte do admin (editar qualquer projeto, transferir posse, suspender) ficam para o subprojeto Admin. No cabeçalho do painel, o admin sem membership aparece como "Administrador do sistema (somente leitura)".
- **A checagem de projeto `ACTIVE` vale em cada action de escrita**, não só no guard, porque o guard deixa o `SYSTEM_ADMIN` passar em qualquer status.
- Adição, remoção, mudança de papel e arquivamento gravam em `audit_logs` via `logAudit` (o `targetId` é o uuid do projeto; detalhes em `metadata`).
- **Arquivar** (`status = 'ARCHIVED'`) pede confirmação na tela, encerra implicitamente todos os processos do projeto (projeto não-`ACTIVE` não tem processo aberto, ver 6.3) e deixa o painel só para leitura. Não há desarquivar nem excluir nesta fase.

### 6.7. Tags

- Componente **TagCombobox** (`src/components/tags/`): busca instantânea nas tags da instituição (por nome e `normalizedSlug`, prefixo/contém — a busca com `pg_trgm` é do Subprojeto 2) e, ao digitar um termo sem correspondência e pressionar Enter, cria a tag.
- **Quando a tag é gravada:** no **envio do formulário**, dentro da mesma transação do processo (nada fica salvo se o usuário abandonar o wizard). O combobox mantém as tags novas só no cliente, como nome, até o envio; o payload da action leva ids das tags existentes **e** nomes das novas.
- **Criação no servidor:** normaliza com `normalizeTagSlug`; se o slug existe em `tags` ou em `tag_aliases`, reutiliza a tag (canônica, no caso de alias) em vez de criar; senão cria com `category = TOPIC`, `isVerified = false`, `createdByUserId`. Nome de exibição: o termo digitado, aparado, 2–64 caracteres.
- Limites: até 10 tags por grupo; criação de tag exige login e conta para o rate limit (até 30 tags novas por usuário por hora — decisão do Claude).
- `usageCount` conta **processos distintos** que usam a tag (uma tag em dois grupos do mesmo processo conta uma vez), atualizado na mesma transação em que o processo ganha ou perde a tag.
- O limite de 30 tags novas por usuário por hora é verificado no envio, contando as tags novas daquele envio.

### 6.8. Proteções

- **Turnstile (D23)** só na criação de projeto (o envio final do wizard). Variáveis `NEXT_PUBLIC_TURNSTILE_SITE_KEY` e `TURNSTILE_SECRET_KEY` entram no `src/env.ts`: **obrigatórias em produção**; fora de produção, se ausentes, usam as chaves de teste da Cloudflare que sempre aprovam. O token é validado no servidor antes de qualquer escrita; falha → mensagem "Não foi possível verificar que você não é um robô. Tente de novo."
- **Rate limit (D22, emendada nesta spec):** 3 projetos criados por usuário por dia, contados **no banco** (projetos em que o usuário é `OWNER` criados nas últimas 24 h), para sobreviver a reinícios. Limiter em memória (LRU, `src/lib/security/`) para a criação de tags e, a critério do builder, para as demais actions.
- Toda Server Action: `requireAuth`/`requireProjectRole` → Zod `safeParse` → regra de negócio. Erros de validação voltam por campo; `NotFoundError` vira 404/"não encontrado"; nunca há mensagem que diferencie "não existe" de "sem permissão".
- Os ids de projeto, processo, curso e tag vindos do cliente são sempre revalidados no servidor contra a instituição e o projeto da rota (um processo de outro projeto não pode ser editado trocando o id na URL ou no formulário).

### 6.9. Painel do projeto

- Cabeçalho com nome, sigla, categoria, status e o papel do usuário.
- **Processos abertos** primeiro (título, prazo em `font-mono` com destaque âmbar quando faltam ≤ 7 dias, número de vagas, canais de inscrição), depois **encerrados** (recolhidos, com data de encerramento).
- Ações por processo conforme o papel: Editar, Encerrar agora (com confirmação), Duplicar.
- Visual segundo o Design System: denso e escaneável, bordas `stone-200`, sem sombras pesadas.

### 6.10. Documentação a atualizar no mesmo trabalho

- `ARCHITECTURE.md §4.2`: schema de `opportunities` e `projects` conforme 6.2; remover `application_mode`.
- `docs/superpowers/specs/2026-10-27-fundacao-design.md`: nota de que o CHECK de `external_url` foi substituído (D34).
- Comentários do enum `project_member_role` (`src/db/schema/enums.ts` e `ARCHITECTURE.md §4.2`): `ADMIN` "gerencia processos e o projeto", não membros (alinha com PRD §2.2).
- `tests/integration/schema.test.ts`: o teste do CHECK antigo (`applicationMode`) é reescrito para o CHECK `opportunities_has_channel`.

### 6.11. Testes

- **Unidade (Vitest):** schemas Zod do projeto e do processo (https estrito, rejeição de `javascript:`/`http:`; pelo menos um canal; regras de data; limites de tamanho; conversão de valor em reais para centavos); cálculo do prazo 23:59:59 em `America/Sao_Paulo`; regra "aberto/encerrado"; geração de slug.
- **Integração (Postgres de teste), mínimo obrigatório:**
  - wizard cria projeto + membership OWNER + processo + tags numa transação; falha em qualquer parte não deixa nada gravado;
  - quarto projeto no mesmo dia é recusado; Turnstile inválido é recusado sem escrita;
  - não-membro, membro de outro projeto e usuário de outra instituição recebem `NotFoundError` em todas as actions de projeto/processo/membros;
  - REVIEWER não edita projeto nem processo; ADMIN não gerencia membros nem arquiva;
  - editar processo de outro projeto trocando o `opportunityId` é recusado;
  - processo encerrado não pode ser editado nem reaberto; duplicar cria novo processo aberto com slug novo;
  - projeto arquivado recusa toda escrita;
  - CHECK `opportunities_has_channel` rejeita processo sem canal; servidor recusa `internal_selection_enabled = true` nesta fase;
  - cursos de outra instituição são recusados;
  - criação de tag reutiliza slug existente e alias; `usageCount` correto após adicionar/remover;
  - adicionar membro por e-mail sem conta → mensagem orientadora; adicionar banido → mesma resposta de não encontrado; OWNER único não pode ser removido nem rebaixado;
  - ações de membros e arquivamento geram `audit_logs`.
- **E2E (Playwright, login de teste):** usuário sem projeto → `/publicar` → passo 1 → passo 2 com link do edital → aparece no painel; encerrar o processo → vai para "Encerrados"; duplicar → formulário pré-preenchido sem datas; REVIEWER não vê botões de edição.

## 7. Critérios de aceite

1. `pnpm lint`, `pnpm tsc --noEmit`, `pnpm test` e `pnpm test:e2e` passam; `pnpm db:migrate` aplica a nova migration num banco já com a migration da Fundação.
2. Um usuário novo publica projeto + processo (só com os campos obrigatórios) em menos de 2 minutos no `pnpm dev`.
3. Nenhuma action de projeto, processo ou membros funciona para quem não tem o papel exigido em `project_members`, e a resposta é indistinguível de "não existe".
4. Link de edital `http://` ou `javascript:` é recusado com mensagem clara.
5. Processo com prazo vencido ou encerrado aparece como encerrado no painel sem nenhuma ação manual.
6. `ARCHITECTURE.md` reflete o schema novo.

## 8. Decisões tomadas pelo Claude nesta spec (para revisão)

- "Processo seletivo" na interface; `opportunities` no código.
- Rotas do organizador por uuid (privadas, guardadas); slug só nas públicas.
- `/painel` vira "Meus projetos"; botão "Publicar processo" no cabeçalho.
- Prazo informado como dia, gravado como 23:59:59 de Brasília; demais datas do cronograma como `date`.
- Entrevista como intervalo (início/fim). Ordem de datas validada só onde é óbvia.
- Sem cron: prazo vencido = encerrado. Encerrado não reabre; novo ciclo = duplicar. `PAUSED` não usado.
- Seleção pela plataforma visível mas desabilitada ("Em breve") até o subprojeto de Candidatura; servidor recusa ligar.
- Adição de `projects.acronym` (Sigla do PRD, faltava no schema). `max_semester` fica fora do formulário.
- Exatamente um OWNER; só ele gerencia membros e arquiva. Adicionar membro só por e-mail de quem já tem conta; sem convites.
- Arquivar é definitivo nesta fase (sem desarquivar nem excluir).
- Limite de 3 projetos/dia contado no banco (emenda à D22, que previa LRU em memória); limite de 30 tags novas/usuário/hora em memória, verificado no envio.
- "Encerrado" = tudo que não é aberto, incluindo processos de projetos inativos.
- Tags novas gravadas só no envio, na mesma transação; `usageCount` por processo distinto.
- `SYSTEM_ADMIN` só lê o painel nesta fase; escrever exige membership real.
- Carga horária 4–20 h, como no PRD.
- Turnstile obrigatório só em produção; chaves de teste da Cloudflare fora dela.
- Slugs gerados no servidor e imutáveis; sufixo aleatório curto no slug do processo.
- Wizard grava tudo numa única transação no envio final.
- Limites de tamanho dos campos (descrições até 5.000, até 10 tags por grupo, carga horária 4–20 h, vagas 1–99).

## 9. Deixado a critério do builder

- Componentes shadcn/ui a instalar (form, input, select, combobox/command, dialog, date picker ou `<input type="date">` nativo).
- Biblioteca de formulário no cliente (ou nenhuma) e como manter o estado entre os passos do wizard.
- Organização interna das Server Actions e dos schemas Zod (ex.: `src/lib/validation/`).
- Forma exata do limiter em memória.
- Layout fino do painel e do wizard, dentro do Design System.
