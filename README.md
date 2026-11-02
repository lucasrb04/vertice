# Vértice

Plataforma de divulgação de vagas, ICs, extensão e projetos especiais da UNIFEI (Campus Itajubá).
Next.js (App Router) + TypeScript, Tailwind v4 + shadcn/ui, PostgreSQL + Drizzle, Better-Auth (somente Google, contas `@unifei.edu.br`).

Decisões, regras de negócio e arquitetura: veja `docs/` (`DECISIONS.md` prevalece em caso de conflito).

## Pré-requisitos

- Node 24 (mínimo 22.9, conforme `engines` do `package.json`)
- pnpm (o projeto usa somente pnpm; não use npm)
- Docker com acesso sem `sudo` (o usuário deve estar no grupo `docker`)

## Configuração

```bash
pnpm install
docker compose up -d        # sobe os dois bancos e espera ficarem healthy
cp .env.example .env        # drizzle.config.ts e db:seed leem o arquivo .env
```

Preencha em `.env` pelo menos `BETTER_AUTH_SECRET` (mínimo 32 caracteres, ex.: `openssl rand -base64 32`),
`GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` (veja a seção de OAuth abaixo) e, opcionalmente,
`INITIAL_ADMIN_EMAIL` (primeiro `SYSTEM_ADMIN`). Em produção, `VISITOR_HASH_SECRET` (mínimo 32 caracteres) é obrigatório:
é o segredo do HMAC que anonimiza visitantes nos contadores de cliques e visualizações. Fora de produção, vazio usa um
valor fixo de desenvolvimento.

Portas no host:

| Banco | Porta | Uso |
| --- | --- | --- |
| `vertice_db` | **5434** | desenvolvimento (a 5432 costuma estar ocupada por um Postgres nativo) |
| `vertice_test` | 5433 | testes de integração e E2E (em tmpfs, descartável) |

Migrations e seed (idempotente):

```bash
pnpm db:migrate
pnpm db:seed
```

`pnpm db:seed` precisa rodar antes da primeira requisição em qualquer ambiente, inclusive produção: as páginas públicas
consultam a instituição padrão e respondem 500 enquanto ela não existir.

Deploy da busca inteligente, nesta ordem:

```bash
pnpm db:migrate         # antes do deploy: o código novo grava nas tabelas de busca
# deploy da aplicação
pnpm db:seed            # traz os sinônimos
pnpm db:search:rebuild  # indexa os processos que já existem
```

`pnpm db:search:rebuild` precisa rodar depois de qualquer deploy desta funcionalidade: não há backfill em SQL, e sem ele
os processos existentes ficam fora do índice e do vocabulário. É idempotente e pode rodar com o site no ar.

Dados fictícios para ver a vitrine preenchida (opcional, nunca em produção):

```bash
pnpm db:seed:demo
```

Roda depois de `pnpm db:seed`, é idempotente, recusa `NODE_ENV=production` e bancos que não sejam locais (`localhost`, `127.0.0.1`, `[::1]`) e cria projetos e processos com prefixo
"Demo" (slugs `demo-*`, dono `demo@unifei.edu.br`), com datas relativas a hoje: abertos, encerrado, verificado, arquivado e um com abertura futura (`demo-abertura-futura`, com o selo "Abre em dd/mm").

## Comandos

| Ação | Comando |
| --- | --- |
| Servidor de desenvolvimento (porta 3000) | `pnpm dev` |
| Lint e type-check | `pnpm lint && pnpm exec tsc --noEmit` |
| Testes unitários e de integração (Vitest) | `pnpm test` |
| Testes E2E (Playwright, porta 3100) | `pnpm test:e2e` |
| Dados fictícios de demonstração | `pnpm db:seed:demo` |
| Reconstruir índice e vocabulário de busca | `pnpm db:search:rebuild` |
| Gerar migrations após mudar o schema | `pnpm db:generate` |
| Build de produção | `pnpm build` |

Rode `docker compose up -d` antes dos testes: os de integração e os E2E usam o banco de teste (5433).
Na primeira vez, instale o navegador do Playwright: `pnpm exec playwright install chromium`.
Os E2E migram, zeram e semeiam o banco de teste sozinhos e usam o login de teste (`ENABLE_TEST_AUTH=true`
em `.env.test`), que nunca deve ser habilitado em produção (a aplicação recusa iniciar assim).

## Credenciais OAuth do Google

1. No Google Cloud Console, crie (ou escolha) um projeto e abra **APIs e serviços > Tela de consentimento OAuth**.
2. Tipo de usuário **Interno**, que restringe o login ao Workspace da UNIFEI, se a conta dona do projeto
   pertencer a ele. Caso contrário, use **Externo**; o servidor continua recusando e-mails fora de
   `@unifei.edu.br`.
3. Em **Credenciais**, crie um **ID do cliente OAuth** do tipo **Aplicativo da Web**.
4. Origem JavaScript autorizada: `http://localhost:3000`.
5. URI de redirecionamento autorizado: `http://localhost:3000/api/auth/callback/google`.
6. Copie o ID e o segredo para `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` no `.env`.

Em produção, adicione também a origem e o redirect do domínio público.

## Limite de buscas

O `src/proxy.ts` limita a 120 buscas (`/processos?q=`) por minuto por IP, em memória. O IP vem de
`x-forwarded-for`/`x-real-ip`, então o limite só vale se o Caddy reescrever esses cabeçalhos; sem ele, o
cliente os forja e escapa do limite.
