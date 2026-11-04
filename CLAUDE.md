# CLAUDE.md

Este arquivo define as diretrizes, comandos e padrões arquiteturais para o agente de IA autônomo atuar no desenvolvimento do projeto **Vértice** (plataforma de vagas e projetos da UNIFEI - Campus Itajubá).

## 1. Visão Geral do Projeto

- **Nome do Projeto:** Vértice (Plataforma de Divulgação de Vagas, ICs, Extensão e Projetos Especiais da UNIFEI).
- **Objetivo:** MVP robusto, seguro, rápido e com estética Editorial Acadêmica ("Anti-cara de IA"), pronto para deploy em container na Oracle Cloud Infrastructure (OCI).

### Stack Tecnológica

- **Framework:** Next.js (última versão estável, ≥ 15, App Router) com TypeScript.
- **Estilização & UI:** Tailwind CSS v4 + shadcn/ui (seguindo estritamente [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md)).
- **Banco de Dados & ORM:** PostgreSQL + Drizzle ORM (com extensões `pg_trgm` e `unaccent` para busca e tags).
- **Autenticação:** Better-Auth (adapter Drizzle) — **login somente com Google, restrito a contas `@unifei.edu.br`** (D31, D32).
- **Validação:** Zod em todas as rotas e Server Actions.
- **E-mails:** Resend + React Email.
- **Testes:** Vitest (unidade + integração contra Postgres real de teste) e Playwright (fluxos E2E críticos).

## 2. Comandos de Desenvolvimento Úteis

| Ação | Comando |
| --- | --- |
| Instalar dependências | `pnpm install` |
| Subir ambiente local (PostgreSQL via Docker) | `docker compose up -d` |
| Gerar migrations do Drizzle | `pnpm drizzle-kit generate` |
| Aplicar migrations | `pnpm drizzle-kit migrate` |
| Popular banco (seed idempotente) | `pnpm db:seed` |
| Rodar servidor de desenvolvimento | `pnpm dev` |
| Rodar testes | `pnpm test` |
| Rodar linters e type-check | `pnpm lint && pnpm tsc --noEmit` |
| Formatar e aplicar correções seguras (Biome) | `pnpm lint:fix` |
| Build de produção (Standalone) | `pnpm build` |

## 3. Diretrizes de Código e Arquitetura

### Segurança em Primeiro Lugar (Anti-Alunos de TI)

- **Zero IDOR:** Nunca exponha IDs sequenciais (1, 2, 3). Todas as chaves primárias são `uuid` com `defaultRandom()` (UUIDv4); URLs públicas usam `slug`.
- **Validação Estrita:** Todos os inputs de formulário e parâmetros de Server Actions devem passar por schemas Zod rígidos. URLs externas de editais devem ser validadas estritamente para o protocolo `https://`.
- **Controle de Acesso por Tenant & Role:** Toda ação de edição de projeto ou visualização de candidatos deve verificar no banco se o usuário logado possui permissão ativa na tabela `project_members`.

### Estética Visual

Siga rigorosamente o guia em [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md). Proibidos gradientes neon, fundos totalmente pretos sem propósito ou sombras exageradas. Priorize o estilo Editorial Acadêmico (limpo, bordas finas `border-stone-200`, fontes mono para dados técnicos).

### Organização de Pastas (Next.js App Router)

Estrutura completa em [`docs/ARCHITECTURE.md §3`](docs/ARCHITECTURE.md). Resumo:

- `src/app/(public)`: Timeline pública, detalhes de vagas e páginas de projetos.
- `src/app/(auth)`: Página de login ("Entrar com Google").
- `src/app/(student)`: Onboarding, perfil e "Minhas Candidaturas".
- `src/app/(organizer)`: Wizard de projeto + vaga, painel do projeto e Kanban.
- `src/app/admin`: Portal do `SYSTEM_ADMIN`.
- `src/db`: Schemas do Drizzle, conexão e seed.
- `src/lib`: Auth/guards, motor de match, busca/tags, segurança, e-mail e tenant.
- `src/actions`: Server Actions tipadas por domínio.

## 4. Fluxo de Trabalho com o Superpowers (Spec-Driven Development)

Sempre consulte os arquivos em `docs/` antes de implementar uma nova funcionalidade:

- [`docs/DECISIONS.md`](docs/DECISIONS.md): Registro de decisões. **Prevalece sobre os demais documentos em caso de conflito.**
- [`docs/PRD.md`](docs/PRD.md): Regras de negócio, fluxos e escopo do MVP.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): Schema do banco, algoritmo de match e topologia de deploy.
- [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md): Padrões visuais de UI/UX.

### Artefatos do fluxo

- Specs de design: `docs/superpowers/specs/YYYY-MM-DD-<tema>-design.md`.
- Planos de implementação: `docs/plans/YYYY-MM-DD-<tema>.md`.
- Desenvolvimento guiado por testes (TDD): escreva o teste que falha antes do código de produção, especialmente para o motor de match, guards de autorização e validadores.
