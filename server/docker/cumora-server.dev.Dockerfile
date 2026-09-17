# cumora-server — Dev variant embedding dev pairing URL
# Lazycat port: this image is built on developer machines AND by the on-box
# builder inside mainland-China networks, where deb.debian.org,
# registry.npmjs.org and dl.k8s.io are not routable. Package sources are pinned
# to reachable mirrors (npmmirror / TUNA / DaoCloud files mirror) rather than
# relying on a warm builder cache that silently expires.
# ─── stage 1: install runtime node deps (prod only) ─────────────────
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund --prefer-offline \
      --registry=https://registry.npmmirror.com

# ─── stage 2: build the web SPA bundle ──────────────────────────────
FROM node:20-bookworm-slim AS spa-build
WORKDIR /app
ARG VITE_CUMORA_API_BASE=""
ARG VITE_PUBLIC_POSTHOG_KEY=""
ARG VITE_PUBLIC_POSTHOG_HOST=""
ENV VITE_CUMORA_API_BASE=${VITE_CUMORA_API_BASE}
ENV VITE_PUBLIC_POSTHOG_KEY=${VITE_PUBLIC_POSTHOG_KEY}
ENV VITE_PUBLIC_POSTHOG_HOST=${VITE_PUBLIC_POSTHOG_HOST}
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund --prefer-offline --ignore-scripts \
      --registry=https://registry.npmmirror.com
COPY src ./src
COPY public ./public
COPY index.html ./
COPY vite.config.ts ./
COPY tsconfig.json ./
COPY tsconfig.node.json ./
COPY postcss.config.js ./
COPY tailwind.config.ts ./
COPY lazycat/vite.env.dev ./.env.production
RUN npm run build

# ─── stage 3: kubectl ──────────────────────────────────────────────
FROM debian:bookworm-slim AS kubectl-build
RUN for f in /etc/apt/sources.list /etc/apt/sources.list.d/*.sources; do if [ -f "$f" ]; then sed -i 's|deb.debian.org|mirrors.tuna.tsinghua.edu.cn|g' "$f"; fi; done; \
    apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl \
  && curl -fsSL -o /out-kubectl \
       "https://files.m.daocloud.io/dl.k8s.io/release/$(curl -fsSL https://files.m.daocloud.io/dl.k8s.io/release/stable.txt)/bin/linux/$(dpkg --print-architecture)/kubectl" \
  && chmod +x /out-kubectl

# ─── stage 4: runtime ───────────────────────────────────────────────
FROM node:20-bookworm-slim

RUN for f in /etc/apt/sources.list /etc/apt/sources.list.d/*.sources; do if [ -f "$f" ]; then sed -i 's|deb.debian.org|mirrors.tuna.tsinghua.edu.cn|g' "$f"; fi; done; \
    apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
       tini \
       ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=kubectl-build /out-kubectl /usr/local/bin/kubectl

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY server ./server
COPY bin ./bin
COPY --from=spa-build /app/dist ./dist

ENV NODE_ENV=production

ENTRYPOINT ["/usr/bin/tini", "--"]
# Migrations: upstream v0.14.0 moved all DDL out of the server boot path into a
# pre-deploy migration Job. A replica now only runs the read-only schema_migrations
# gate and refuses to start when the ledger is missing, which broke both green-field
# installs and every upgrade from an older LPK (their databases predate the ledger).
# Lazycat has no Job primitive, so the container migrates first - the migrator adopts
# an existing database through the idempotent 0001_legacy_baseline - and then starts
# the server. The bounded retry absorbs Lazycat's parallel postgres/redis start.
CMD ["sh", "-c", "for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do npm run migrate && exec npm run server:start; sleep 3; done; echo '[lazycat] migrate kept failing; exiting' >&2; exit 1"]
