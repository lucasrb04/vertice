# Deploy do Vértice na Oracle Cloud

Passo a passo de uma conta OCI vazia até o primeiro deploy automático. O desenho está na spec
`docs/superpowers/specs/2026-11-04-deploy-design.md`; a decisão, em D47.

**Como funciona.** Todo push em `main` roda a pipeline (`.github/workflows/ci.yml`): lint, tipos, testes com 90% de
cobertura, `pnpm audit` e Trivy. Com tudo verde, as imagens vão para o GHCR e o job `deploy` entra na VM por SSH com uma
chave que só executa `/opt/vertice/bin/deploy.sh`. O script recebe a tag (SHA) e o `.env` montado dos secrets do
GitHub, roda migrations e seed, sobe o app, confere `https://verticehub.online/` e, se o site não responder em 60 s,
volta para a versão anterior. Pull requests rodam os portões, mas não publicam.

| Item | Valor |
| --- | --- |
| VM | `vertice`, `VM.Standard.A1.Flex` 2 OCPU / 12 GB, Ubuntu 24.04 aarch64, `sa-saopaulo-1` |
| IP | `144.22.241.118` (reservado) |
| Domínio | `verticehub.online` (Cloudflare, DNS only) |
| Imagens | `ghcr.io/lucasrb04/vertice-app:<sha>` e `ghcr.io/lucasrb04/vertice-migrate:<sha>` |
| Na VM | `/opt/vertice` (compose, Caddyfile, `.env`, `RELEASE`, `backups/`, `bin/`) |
| Atalho SSH | `ssh vertice` (usuário `ubuntu`) |

## 1. VM na OCI (feito em 2026-11-08)

1. Criar a instância Ampere A1 (Ubuntu 24.04, 2 OCPU, 12 GB, boot de 50 GB) sem IP efêmero e anexar um IP público
   **reservado** à VNIC. Fica dentro do Always Free (4 OCPU / 24 GB e 200 GB de disco somando todas as VMs).
2. Security list da subnet: entrada TCP 22, 80 e 443 de `0.0.0.0/0`. Nada mais.
3. Firewall da VM (a imagem da Oracle bloqueia tudo além do 22):
   ```bash
   sudo iptables -I INPUT 5 -p tcp -m state --state NEW -m tcp --dport 80 -j ACCEPT
   sudo iptables -I INPUT 5 -p tcp -m state --state NEW -m tcp --dport 443 -j ACCEPT
   sudo netfilter-persistent save
   ```
4. Docker pelo repositório oficial (`docker-ce`, `docker-compose-plugin`), fuso `America/Sao_Paulo`,
   `PermitRootLogin no` em `/etc/ssh/sshd_config.d/10-vertice.conf` (senha já vem desligada).
5. Usuário e pastas:
   ```bash
   sudo adduser --disabled-password --gecos "" deploy && sudo usermod -aG docker deploy
   sudo install -d -o deploy -g deploy -m 750 /opt/vertice /opt/vertice/bin /opt/vertice/backups
   sudo install -d -o deploy -g deploy -m 700 /home/deploy/.ssh
   ```
6. Orçamento de alerta em *Billing → Budgets* (R$ 1/mês, alertas de gasto real e de previsão). Conta Pay As You Go
   não tem trava de gasto: o alerta é o aviso para agir no mesmo dia.

## 2. Domínio (feito)

Na Cloudflare, registro `A` `@` → `144.22.241.118` com **proxy desligado (nuvem cinza)**. O Caddy tira o certificado
sozinho no primeiro deploy. Não ligue a nuvem laranja antes de ler a seção 9.

## 3. Chave de deploy (feito)

A pipeline tem uma chave `ed25519` só dela. A pública fica em `/home/deploy/.ssh/authorized_keys` presa ao script:

```
command="/opt/vertice/bin/deploy.sh",no-pty,no-port-forwarding,no-agent-forwarding,no-X11-forwarding ssh-ed25519 AAAA… github-actions-deploy@vertice
```

O usuário `deploy` está no grupo `docker` (equivale a root na VM), por isso a chave não abre shell: qualquer comando
cai no `deploy.sh`, que só aceita um SHA de 40 caracteres. Para trocar a chave, gere outra, substitua a linha acima e
atualize o secret `DEPLOY_SSH_KEY`.

Os scripts foram copiados uma vez para `/opt/vertice/bin` (755, dono `deploy`). A cada deploy o `backup.sh`,
o compose e o Caddyfile são atualizados a partir da imagem `migrate`; **o `deploy.sh` não se atualiza sozinho**. Quando
ele mudar no repositório:

```bash
scp deploy/bin/deploy.sh vertice:/tmp/ && ssh vertice 'sudo install -o deploy -g deploy -m 755 /tmp/deploy.sh /opt/vertice/bin/'
```

## 4. GitHub

Em *Settings → Environments → production* (o ambiente já existe):

| Tipo | Nome | Origem |
| --- | --- | --- |
| Secret | `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`, `DEPLOY_HOST` | já cadastrados |
| Secret | `BETTER_AUTH_SECRET`, `VISITOR_HASH_SECRET`, `POSTGRES_PASSWORD` | `openssl rand -hex 32` (cada um diferente) |
| Secret | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google Cloud Console → Google Auth Platform → Clients |
| Secret | `TURNSTILE_SECRET_KEY` | Cloudflare → Turnstile → widget → Secret Key |
| Secret | `RESEND_API_KEY` | Resend → API Keys (Sending access, domínio `verticehub.online`) |
| Variable | `EMAIL_FROM` | já cadastrada: `Vértice <nao-responda@verticehub.online>` |
| Variable | `INITIAL_ADMIN_EMAIL` | seu e-mail `@unifei.edu.br` (vira o primeiro `SYSTEM_ADMIN`) |

Em *Settings → Secrets and variables → Actions → Variables* (do repositório, não do ambiente):

| Nome | Valor |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | já cadastrada: `https://verticehub.online` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare → Turnstile → widget → Site Key |

**Não edite o `/opt/vertice/.env` à mão:** o próximo deploy o sobrescreve com o que está no GitHub. Para trocar um
segredo, mude no GitHub e rode o job de novo (*Actions → ci → Re-run jobs*). Valores não podem ter `$`, aspas, crase
nem espaço nas pontas; o `deploy.sh` recusa o deploy se tiverem. `POSTGRES_PASSWORD` só vale na criação do banco:
depois do primeiro deploy, trocá-lo exige `ALTER USER` dentro do Postgres.

Serviços externos com o domínio cadastrado: Google OAuth (origem `https://verticehub.online`, redirect
`https://verticehub.online/api/auth/callback/google`, app publicado), Turnstile (hostname `verticehub.online`) e
Resend (domínio verificado).

## 5. Primeiro deploy

1. Push (ou merge) em `main` e acompanhe: `gh run watch`.
2. No primeiro push, os pacotes nascem **privados** no GHCR e o job `deploy` falha no `pull`. Torne-os públicos (só dá
   pela interface): *github.com/lucasrb04?tab=packages* → `vertice-app` → *Package settings* → *Change visibility* →
   *Public*; o mesmo para `vertice-migrate`. Depois, *Re-run failed jobs*.
3. Entre com a conta de `INITIAL_ADMIN_EMAIL` e confira o acesso a `/admin`.

## 6. Operação

- **Versão no ar:** `ssh vertice sudo cat /opt/vertice/RELEASE`.
- **Logs:** `ssh vertice 'sudo docker compose -p vertice -f /opt/vertice/compose.prod.yml logs -f app'`.
  O `/opt/vertice` é só do `deploy`: como `ubuntu`, use sempre caminhos absolutos com `sudo`, nunca `cd`.
- **Rollback manual** para um SHA anterior (precisa da imagem no GHCR):
  `ssh vertice 'sudo -u deploy /opt/vertice/bin/deploy.sh <sha>'` (usa o `.env` que já está na VM).
- **Rebuild da busca** que falhou (saída 6): mesmo comando com o SHA atual.
- **Códigos de saída do `deploy.sh`:** 2 tag inválida, 3 `.env` ausente ou inválido, 4 migrate/seed falhou (app antigo
  no ar), 5 site não respondeu (voltou para a versão anterior, se houver), 6 rebuild da busca falhou.
- Migrations seguem **aditivas**: o rollback troca só o app, nunca desfaz migration.

## 7. Backup e restauração

Cron do `deploy` às 3h (Brasília): `/opt/vertice/bin/backup.sh` grava `pg_dump -Fc` em
`/opt/vertice/backups/vertice-AAAA-MM-DD.dump` (600) e apaga os de mais de 7 dias. Log em `backups/backup.log`.

Restaurar num banco vazio (teste ou desastre):

```bash
ssh vertice
DC="sudo docker compose -p vertice --env-file /opt/vertice/.env -f /opt/vertice/compose.prod.yml"
sudo cat /opt/vertice/backups/vertice-AAAA-MM-DD.dump | $DC exec -T postgres \
  sh -c 'createdb -U "$POSTGRES_USER" restauracao && pg_restore -U "$POSTGRES_USER" -d restauracao --no-owner'
# conferir e depois apagar o banco de teste:
$DC exec -T postgres sh -c 'dropdb -U "$POSTGRES_USER" restauracao'
```

Para trocar o banco de produção pelo backup, pare o app (`stop app`), restaure com `pg_restore --clean -d vertice` e
suba de novo. Os backups ficam só na VM: perder a VM perde as cópias (pendência da spec §9: copiar para o Object
Storage).

## 8. Proteger `main` (opcional)

Exigir PR com a pipeline verde (*Settings → Branches → Add rule* para `main`, checks `verify`, `dependencies`,
`image (app)` e `image (migrate)`) impede push direto em `main`. Sem a regra, o push direto continua passando pelos
mesmos portões antes do deploy; só deixa de existir a revisão por PR.

## 9. Ligar o proxy da Cloudflare (nuvem laranja)

**Antes** de ligar: no `deploy/Caddyfile`, troque `header_up X-Forwarded-For {remote_host}` por `trusted_proxies`
com as faixas IPv4/IPv6 da Cloudflare e use o IP de `CF-Connecting-IP`. Sem isso, o app vê o IP da Cloudflare em
toda requisição e todos os visitantes passam a dividir um único limite de buscas. Na Cloudflare, use SSL **Full
(strict)**. A mudança passa pela pipeline como qualquer outra.
