#!/usr/bin/env bash
# Backup diário do Postgres (spec de deploy §5.4): cron do usuário `deploy` às 3h de Brasília.
# Guarda 7 dias em /opt/vertice/backups. Restauração: docs/DEPLOY.md.
set -euo pipefail

VERTICE_DIR=${VERTICE_DIR:-/opt/vertice}
# Não depende da pasta de onde é chamado (o find falha se não puder voltar a ela, ex.: sudo -u deploy).
cd "$VERTICE_DIR"
out="$VERTICE_DIR/backups/vertice-$(date +%F).dump"

umask 077
docker compose -f "$VERTICE_DIR/compose.prod.yml" --env-file "$VERTICE_DIR/.env" -p vertice \
  exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' >"$out.tmp"
mv "$out.tmp" "$out"
find "$VERTICE_DIR/backups" -name 'vertice-*.dump' -mtime +7 -delete
