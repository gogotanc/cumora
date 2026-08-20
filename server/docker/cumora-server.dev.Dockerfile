# cumora-server — Dev variant embedding dev pairing URL
# ─── stage 1: install runtime node deps (prod only) ─────────────────
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund --prefer-offline

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
RUN npm ci --no-audit --no-fund --prefer-offline --ignore-scripts
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
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl \
  && curl -fsSL -o /out-kubectl \
       "https://dl.k8s.io/release/$(curl -fsSL https://dl.k8s.io/release/stable.txt)/bin/linux/$(dpkg --print-architecture)/kubectl" \
  && chmod +x /out-kubectl

# ─── stage 4: runtime ───────────────────────────────────────────────
FROM node:20-bookworm-slim

RUN apt-get update \
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
