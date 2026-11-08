# Deploy: pipeline e produção na OCI

Spec do subprojeto de deploy. O fluxo veio do autor: código no GitHub, pipeline com testes e cobertura de 90%, portão de segurança de dependências e, se tudo passar, publicação na máquina da Oracle Cloud. O destino já estava definido em `ARCHITECTURE.md §8` e D44. Também do autor: o repositório é público (o projeto é open source, para qualquer aluno sugerir melhorias), o site sobe primeiro sem domínio próprio, e o proxy da Cloudflare só entra depois que tudo estiver no ar. O que veio do Claude está em §8.

## 1. Por quê

O Vértice está pronto para ir ao ar e hoje só roda na máquina do autor. Não há repositório remoto, pipeline, Dockerfile nem configuração de produção. Publicar à mão é lento e deixa passar teste quebrado ou dependência vulnerável.

## 2. Objetivos

- Todo push e pull request para `main` roda a pipeline de verificação no GitHub Actions.
- A pipeline barra o deploy quando:
  - lint, type-check ou testes falham;
  - a cobertura de linhas, funções, branches ou statements fica abaixo de 90% (§5.2);
  - há dependência de produção com vulnerabilidade **alta ou crítica** (`pnpm audit`);
  - a imagem Docker tem vulnerabilidade **alta ou crítica** com correção disponível (Trivy).
- Push em `main` com tudo verde publica a versão na VM da OCI sem passo manual.
- O deploy roda migrations e seed antes do app novo e reconstrói a busca depois (§5.5).
- Deploy que deixa o site fora do ar volta sozinho para a versão anterior.
- O Dependabot abre PRs semanais de atualização.
- Um passo a passo no repositório leva de uma conta OCI vazia até o primeiro deploy.

## 3. Fora do escopo

- Testes E2E (Playwright) na pipeline. Ficam locais por ora.
- Infraestrutura como código (Terraform). A VM é criada uma vez, à mão, pelo passo a passo.
- Ambiente de homologação, mais de uma instância e deploy sem nenhuma interrupção. Uma troca de container de poucos segundos é aceita (D22: instância única).
- Monitoramento e alertas externos.
- Varredura de segredos no código e análise estática de segurança (SAST).

## 4. Anti-objetivos

- Segredo de produção dentro da imagem, do repositório ou dos logs da pipeline.
- Deploy que pula um portão: nenhum caminho publica sem os quatro verdes.
- Migration rodando depois do app novo, ou app novo subindo com migration falha.
- Postgres ou porta 3000 expostos à internet. Só 80 e 443 ficam abertas.
- Dados perdidos num deploy ou numa falha da VM sem cópia recente.
- Cliente forjando `x-forwarded-for` para escapar do limite de buscas (§5.4).

## 5. Comportamento

### 5.1. Pipeline (`.github/workflows/ci.yml`)

Disparo: push e pull request para `main`. Jobs:

1. **verify**: `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm tsc --noEmit` e testes com cobertura (`pnpm test:coverage`). O Postgres 16 de teste sobe como serviço do job, no lugar do `postgres-test` do Compose, com as variáveis de `.env.test` apontando para ele.
2. **dependencies**: `pnpm audit --prod --audit-level high`.
3. **image**, depois de 1 e 2 passarem: build da imagem do app e da imagem de migrations (§5.3) e Trivy nas duas, com `severity: HIGH,CRITICAL`, `ignore-unfixed: true` e `exit-code: 1`. Em push para `main`, as imagens vão para o GitHub Container Registry (GHCR), com tag no SHA do commit.
4. **deploy**: só em push para `main`, depois de 3 (§5.5). Usa um Environment `production` do GitHub, com os segredos de SSH.

Pull request roda 1 a 3 sem publicar imagem nem fazer deploy. Dois deploys nunca rodam juntos (`concurrency`).

Como o repositório é público e aceita PR de fork:

- O disparo é `pull_request`, nunca `pull_request_target`, para que código de fork rode sem acesso a segredos.
- Cada job declara `permissions` mínimas. Só o job `image` em `main` ganha `packages: write`.
- Nenhum segredo é necessário para os jobs 1 a 3: o `.env` de teste é montado no próprio job.

### 5.2. Cobertura

- `@vitest/coverage-v8`, com unitários e integração somados numa única medição.
- O limite de 90% vale para o código que esses testes alcançam: `src/lib`, `src/actions`, `src/db` (sem os dados do seed), `src/env.ts` e `src/proxy.ts`.
- Ficam de fora:
  - páginas e componentes React (`src/app`, `src/components`), que são cobertos pelos E2E e não por estes testes;
  - `src/components/ui`, que é código gerado pelo shadcn;
  - os templates de e-mail.
- Os limites ficam em `vitest.config.ts` (`thresholds`), para que a mesma regra valha localmente e na pipeline.
- Se a medição inicial ficar abaixo de 90%, o plano inclui escrever testes até chegar lá, sem baixar o limite. O autor aprovou esse trabalho.
- Ainda não há medição: `@vitest/coverage-v8` e `test:coverage` não existem. O primeiro passo do plano é instalar e medir. O resultado decide o tamanho do trabalho de testes, que pode ser a maior parte deste subprojeto.

### 5.3. Imagens

`Dockerfile` multi-stage com dois alvos finais:

- **`app`**: Next.js standalone em `node:22-alpine`, rodando com usuário sem privilégio, só com `.next/standalone` e `.next/static`. Não existe `public/`. As variáveis `NEXT_PUBLIC_*` entram como argumentos de build vindos de Variables do GitHub. Nenhum segredo entra no build. Healthcheck do container em `/`.
- **`migrate`**: mesma base, para rodar as migrations (`db:migrate:deploy`, migrador do drizzle-orm; emenda de 2026-11-08), `db:seed` e `db:search:rebuild` (D44). Ela não é exposta e só roda quando chamada. Leva só as dependências de produção mais `drizzle-kit` e `tsx`, sem vitest, eslint, playwright nem as outras ferramentas de desenvolvimento, para o Trivy seguir o mesmo critério do `pnpm audit --prod`. Leva também o código-fonte que esses scripts importam (`src/db`, `src/lib` e `drizzle/`).

Ambas para `linux/arm64`, a arquitetura da VM Ampere A1 do plano gratuito. O build roda nativo no runner ARM do GitHub (`ubuntu-24.04-arm`), gratuito para repositório público, sem emulação.

### 5.4. Produção na VM (`deploy/`)

- `deploy/compose.prod.yml` com os serviços `postgres`, `app`, `migrate` (perfil manual) e `caddy`, a partir do §8.3 da arquitetura, sem o script de init: as extensões vêm da migration `0000`.
- O app e o Postgres ficam só na rede interna. O Caddy publica 80 e 443.
- `deploy/Caddyfile` com o domínio vindo de `APP_DOMAIN`, HTTPS automático, compressão, HSTS e `header_up X-Forwarded-For {remote_host}`, que sobrescreve o cabeçalho em vez de acrescentar ao dele.
- Os segredos de produção vivem só no Environment `production` do GitHub. A cada deploy o job monta o `.env` e o envia pelo stdin do SSH; o `deploy.sh` valida chaves e valores e grava `/opt/vertice/.env` com permissão 600. `deploy/.env.production.example` lista cada variável e sua origem. (Emenda de 2026-11-08, pedido do autor: configurar tudo pelo GitHub.)
- Backup: `pg_dump` diário às 3h (horário de Brasília) via cron, guardando 7 dias em `/opt/vertice/backups`, com script e instrução de restauração no passo a passo.

### 5.5. Deploy (job da pipeline)

Por SSH, com o usuário `deploy`. Ele está no grupo `docker`, o que na prática equivale a root na VM, então a chave da pipeline não abre shell: no `authorized_keys`, ela fica presa a `command="/opt/vertice/bin/deploy.sh"`, com `no-pty`, `no-port-forwarding`, `no-agent-forwarding` e `no-X11-forwarding`. O script aceita só uma tag de imagem no formato de SHA (`SSH_ORIGINAL_COMMAND`) e recusa qualquer outra coisa. Os arquivos de `deploy/` vão junto, dentro da imagem `migrate`, e o script os copia para `/opt/vertice`, sem `scp`. O `.env`, o cron de backup e os backups são do `deploy`, com permissão 600 no `.env`.

1. Atualiza `compose.prod.yml` e `Caddyfile` em `/opt/vertice` a partir da imagem `migrate` da tag pedida.
2. `docker compose pull` com a tag do SHA. Os pacotes no GHCR são públicos, como o código, então a VM não guarda token do registro. As imagens não levam segredo (§5.3).
3. `migrate`: `db:migrate:deploy` e depois `db:seed`. Falhou, para tudo, e o app antigo continua no ar.
4. `docker compose up -d app caddy`.
5. Verificação: `https://APP_DOMAIN/` responde 200 em até 60 s. Se não responder, sobe de novo a tag anterior, gravada em `/opt/vertice/RELEASE`, e a pipeline falha.
6. `migrate`: `db:search:rebuild`, idempotente, com o site no ar.
7. Grava a tag nova em `/opt/vertice/RELEASE` e apaga imagens antigas, guardando as 3 últimas.

O rollback automático só troca o app. Migration que já rodou não é desfeita, por isso migrations seguem aditivas, como já são.

### 5.6. Dependabot (`.github/dependabot.yml`)

Semanal, para `npm` (lê o `pnpm-lock.yaml`), `github-actions` e `docker`. Agrupa atualizações menores e de patch num PR por ecossistema.

### 5.7. Domínio

**Emenda de 2026-11-08:** o autor comprou `verticehub.online` antes do primeiro deploy, então o `sslip.io` saiu do plano. O registro `A` aponta para o IP reservado `144.22.241.118`, na Cloudflare com proxy desligado (§9). Google OAuth, Turnstile e Resend usam o domínio desde o início, e os e-mails chegam a todos os usuários.

### 5.8. Passo a passo (`docs/DEPLOY.md`)

1. Criar a VM Ampere A1 (Ubuntu 24.04) e abrir 80 e 443 na security list e no firewall da VM.
2. Instalar o Docker e criar o usuário `deploy`.
3. Montar o `APP_DOMAIN` provisório no `sslip.io` (§5.7).
4. Criar repositório no GitHub, proteger `main` (PR com a pipeline verde) e ligar os alertas do Dependabot.
5. Cadastrar os segredos e as Variables do Environment `production`.
6. Preencher `/opt/vertice/.env`.
7. Adicionar a origem e o redirect do domínio no OAuth do Google e o hostname no Turnstile.
8. Fazer o primeiro deploy, criar o primeiro `SYSTEM_ADMIN` via `INITIAL_ADMIN_EMAIL` e testar a restauração de um backup.
9. Seções avulsas: trocar para o domínio definitivo (§5.7) e ligar o proxy da Cloudflare (§9).

## 6. Aceite

1. PR com teste quebrado, cobertura abaixo de 90% ou dependência vulnerável alta fica vermelho e não publica.
2. Push em `main` verde coloca o commit no ar em `https://APP_DOMAIN`, com migrations, seed e rebuild rodados.
3. Imagem que não sobe faz o site voltar sozinho à versão anterior.
4. `X-Forwarded-For` forjado pelo cliente não chega ao app: o limite de buscas conta o IP real.
5. Na VM, só 22, 80 e 443 respondem de fora, e o SSH aceita só chave.
6. Um backup do dia restaura num banco vazio.
7. `pnpm lint`, `pnpm tsc --noEmit`, `pnpm test:coverage` e `docker build` passam localmente.

## 7. Restrições

- pnpm com `corepack` e `--frozen-lockfile` (D30). Node 22 nas imagens (`engines >=22.9`).
- Instância única com limitadores em memória (D22): `app` com uma réplica só.
- O app recusa subir em produção sem `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `VISITOR_HASH_SECRET`, `RESEND_API_KEY` e `EMAIL_FROM` (`src/env.ts`), e com `ENABLE_TEST_AUTH=true`.
- `db:seed` precisa rodar antes da primeira requisição: sem a instituição, as páginas respondem 500.

## 8. Decisões do Claude (revisar)

- `pnpm audit` em vez do OWASP dependency-check, que é lento e fraco para Node, mais o Trivy para a imagem. O Dependabot abre PRs, mas não é portão.
- Bloqueia só alta e crítica; no Trivy, só com correção disponível. Só dependências de produção.
- Cobertura somando unitários e integração, medida em `src/lib`, `src/actions`, `src/db`, `src/env.ts` e `src/proxy.ts` (§5.2).
- GHCR como registro de imagens, com tag por SHA.
- Build da imagem no runner ARM nativo do GitHub para `linux/arm64` (VM Ampere A1 gratuita).
- Pacotes do GHCR públicos, sem token de registro na VM.
- `sslip.io` como domínio provisório. Se o Google recusar o nome no OAuth, o plano B é um subdomínio gratuito (DuckDNS), que tem o mesmo papel.
- Rollback automático só do app, guiado por `/opt/vertice/RELEASE`.
- Backup diário local com 7 dias de retenção.
- Imagem `migrate` enxuta: só dependências de produção e `tsx`, sem `drizzle-kit`, npm, corepack nem yarn (emenda de 2026-11-08, exigida pelo Trivy).
- Usuário `deploy` no grupo `docker`, com a chave da pipeline presa a um script de deploy que só aceita a tag.
- E2E fora da pipeline.

## 9. Temas em aberto

- Ligar o proxy da Cloudflare depois do domínio. **Antes de ligar a nuvem laranja**, o Caddyfile precisa trocar o `header_up X-Forwarded-For {remote_host}` por `trusted_proxies` com as faixas da Cloudflare e ler o IP de `CF-Connecting-IP`. Sem isso, todos os visitantes dividem um único limite de buscas. O passo a passo deixa esse aviso escrito; a mudança em si fica para quando o proxy entrar.
- Copiar o backup para fora da VM (OCI Object Storage), para sobreviver à perda da VM.
- Rodar os E2E na pipeline.
- Monitoramento de disponibilidade.
