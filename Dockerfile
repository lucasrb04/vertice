# Duas imagens finais (D44): `app` (Next.js standalone) e `migrate` (migrations, seed e rebuild da busca,
# que precisam de tsx, ausente do standalone). Nenhum segredo entra no build.
#
# As imagens finais partem de `runtime`: o node:22-alpine sem npm, corepack e yarn. Eles só servem para
# instalar pacotes, e o npm embutido traz dependências com CVEs altas que o Trivy barra.
FROM node:22-alpine AS runtime
RUN rm -rf /usr/local/lib/node_modules /opt/yarn-* \
  && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg

FROM node:22-alpine AS base
ENV COREPACK_HOME=/corepack COREPACK_ENABLE_DOWNLOAD_PROMPT=0 NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate && chmod -R a+rX /corepack
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM runtime AS app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /app
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/ >/dev/null || exit 1
CMD ["node", "server.js"]

FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# O better-auth declara drizzle-kit como peer opcional (só para a CLI dele); com drizzle-kit nas
# devDependencies, o pnpm o instala mesmo com --prod, e com ele dois esbuild antigos que o Trivy barra.
# Nenhum script da imagem o usa: sai drizzle-kit, @esbuild-kit e todo esbuild que não seja o do tsx.
RUN pnpm install --frozen-lockfile --prod \
  && keep=$(node -p "require(require.resolve('esbuild/package.json', { paths: [require('fs').realpathSync('node_modules/tsx')] })).version") \
  && cd node_modules/.pnpm \
  && for d in drizzle-kit@* @esbuild-kit+* esbuild@* @esbuild+*; do \
       case "$d" in "esbuild@$keep" | "esbuild@$keep"_* | @esbuild+*@"$keep") ;; *) rm -rf "$d" ;; esac; \
     done

# `node --run <script>` roda os scripts do package.json sem pnpm (só tsx, de node_modules/.bin).
FROM runtime AS migrate
ENV NODE_ENV=production
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY drizzle ./drizzle
COPY src/env.ts ./src/env.ts
COPY src/db ./src/db
COPY src/lib ./src/lib
# Arquivos de produção que o deploy.sh copia para /opt/vertice na VM.
COPY deploy /deploy
USER node
ENTRYPOINT ["node", "--run"]
