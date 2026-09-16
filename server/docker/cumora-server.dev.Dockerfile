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
CMD ["npm", "run", "server:start"]
