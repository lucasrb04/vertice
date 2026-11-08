#!/usr/bin/env bash
# Deploy do Vértice na VM (spec de deploy §5.5). Roda como `deploy`, chamado pela pipeline por SSH com a
# chave presa a este script (authorized_keys: command=...). Aceita só a tag da imagem (SHA do commit) e,
# no stdin, o .env de produção montado a partir dos secrets do GitHub. Nunca imprime valores do .env.
#
# Saídas: 0 ok; 2 tag inválida; 3 .env ausente ou inválido; 4 migrate falhou; 5 site não respondeu;
# 6 rebuild da busca falhou (o site novo já está no ar).
set -euo pipefail

VERTICE_DIR=${VERTICE_DIR:-/opt/vertice}
HEALTH_URL=${HEALTH_URL:-https://verticehub.online/}
HEALTH_TIMEOUT=${HEALTH_TIMEOUT:-60}
REGISTRY=ghcr.io/lucasrb04

# Chaves de src/env.ts mais as do compose de produção.
ALLOWED_KEYS=(
  NODE_ENV DATABASE_URL DEFAULT_INSTITUTION_SLUG BETTER_AUTH_SECRET BETTER_AUTH_URL NEXT_PUBLIC_APP_URL
  GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET INITIAL_ADMIN_EMAIL ENABLE_TEST_AUTH NEXT_PUBLIC_TURNSTILE_SITE_KEY
  TURNSTILE_SECRET_KEY VISITOR_HASH_SECRET RESEND_API_KEY EMAIL_FROM APP_DOMAIN POSTGRES_USER POSTGRES_PASSWORD
  POSTGRES_DB
)

fail() {
  echo "deploy: $2" >&2
  exit "$1"
}

allowed_key() {
  local k
  for k in "${ALLOWED_KEYS[@]}"; do [[ $k == "$1" ]] && return 0; done
  return 1
}

tag=${SSH_ORIGINAL_COMMAND-${1-}}
[[ $tag =~ ^[0-9a-f]{40}$ ]] || fail 2 "tag inválida: esperado o SHA de 40 caracteres do commit"

# Valida o .env linha a linha antes de gravar: chave conhecida e valor sem nada que o compose interpretaria.
validate_env() {
  local n=0 line key value
  while IFS= read -r line || [[ -n $line ]]; do
    n=$((n + 1))
    [[ -z $line || $line == \#* ]] && continue
    [[ $line =~ ^([A-Z][A-Z0-9_]*)=(.*)$ ]] || fail 3 ".env: linha $n não é CHAVE=valor"
    key=${BASH_REMATCH[1]}
    value=${BASH_REMATCH[2]}
    allowed_key "$key" || fail 3 ".env: chave não permitida na linha $n: $key"
    [[ $value != *[\$\'\"\`]* && $value == "${value#[[:space:]]}" && $value == "${value%[[:space:]]}" ]] ||
      fail 3 ".env: valor inválido em $key (sem \$, aspas, crase ou espaço nas pontas)"
  done <<<"$1"
}

if [[ ! -t 0 ]]; then
  incoming=$(cat)
  if [[ -n $incoming ]]; then
    validate_env "$incoming"
    tmp=$(umask 077 && mktemp "$VERTICE_DIR/.env.XXXXXX")
    printf '%s\n' "$incoming" >"$tmp"
    mv "$tmp" "$VERTICE_DIR/.env"
  fi
fi
[[ -f $VERTICE_DIR/.env ]] || fail 3 "sem $VERTICE_DIR/.env e nada recebido no stdin"

dc() {
  docker compose -f "$VERTICE_DIR/compose.prod.yml" --env-file "$VERTICE_DIR/.env" -p vertice "$@"
}

# 1. Arquivos de produção da versão pedida, de dentro da imagem migrate.
cid=$(docker create "$REGISTRY/vertice-migrate:$tag")
docker cp "$cid:/deploy/compose.prod.yml" "$VERTICE_DIR/compose.prod.yml"
docker cp "$cid:/deploy/Caddyfile" "$VERTICE_DIR/Caddyfile"
docker cp "$cid:/deploy/bin/backup.sh" "$VERTICE_DIR/bin/backup.sh"
docker rm "$cid" >/dev/null

# 2-3. Imagens novas, migrations e seed antes do app novo.
export IMAGE_TAG=$tag
dc pull app migrate
dc run --rm migrate db:migrate || fail 4 "migrations falharam; o app anterior continua no ar"
dc run --rm migrate db:seed || fail 4 "seed falhou; o app anterior continua no ar"

# 4-5. App novo e verificação; sem resposta, volta para a versão anterior.
dc up -d app caddy
healthy=false
for ((waited = 0; waited < HEALTH_TIMEOUT; waited += 2)); do
  if curl -fsS -o /dev/null --max-time 5 "$HEALTH_URL"; then
    healthy=true
    break
  fi
  sleep 2
done
if [[ $healthy != true ]]; then
  previous=$(cat "$VERTICE_DIR/RELEASE" 2>/dev/null || true)
  [[ $previous =~ ^[0-9a-f]{40}$ ]] || fail 5 "site não respondeu em ${HEALTH_TIMEOUT}s e não há versão anterior para voltar (sem versão anterior)"
  IMAGE_TAG=$previous dc up -d app caddy
  fail 5 "site não respondeu em ${HEALTH_TIMEOUT}s; voltou para $previous"
fi

# 6-7. Registra a versão, reconstrói a busca com o site no ar e guarda só as 3 últimas imagens.
echo "$tag" >"$VERTICE_DIR/RELEASE"
for image in vertice-app vertice-migrate; do
  docker images "$REGISTRY/$image" --format '{{.Tag}}' | tail -n +4 | while read -r old; do
    docker rmi "$REGISTRY/$image:$old" >/dev/null 2>&1 || true
  done
done
dc run --rm migrate db:search:rebuild || fail 6 "rebuild da busca falhou; rode de novo: deploy.sh $tag"
echo "deploy: $tag no ar"
