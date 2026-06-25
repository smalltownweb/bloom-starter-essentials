# syntax=docker/dockerfile:1.7
# ─────────────────────────────────────────────────────────────────────────────
# Storefront-Dockerfile for bloom-starter-essentials (TanStack Start SSR, Vite,
# pnpm turbo-monorepo). Spejler backend-Dockerfilens pnpm/turbo-prune-mønster.
#
#  * pnpm@10.12.3 via corepack; turbo pinnet til repo'ets ^2.0.14
#  * node-linker=hoisted → flad node_modules (pnpm's symlinks er ikke copy-bare på
#    tværs af Docker-stages); samme trick som backend
#  * turbo prune storefront (unscoped workspace-navn)
#  * `vite build` (TanStack Start → Nitro node-server) → .output/server/index.mjs
#
# ⚠ VITE_* BAGES IND VED BUILD-TID (import.meta.env): VITE_MEDUSA_BACKEND_URL +
#   VITE_MEDUSA_PUBLISHABLE_KEY skal være BUILD-args. Backend-URL'en tjener BÅDE
#   SSR (server→backend) OG browseren (bruger→backend) — DERFOR skal den være det
#   OFFENTLIGE backend-domæne (https://admin.<shop>) med gyldigt cert, ikke en
#   intern URL. Ændring af URL/key kræver REBUILD (kan ikke sættes som runtime-env).
#
# Build context = monorepo-root (IKKE apps/storefront/). Coolify:
#   Build context:   /
#   Dockerfile path: apps/storefront/Dockerfile
#   Port:            3000
#   Build-args:      VITE_MEDUSA_BACKEND_URL, VITE_MEDUSA_PUBLISHABLE_KEY
# ─────────────────────────────────────────────────────────────────────────────

# ─── Stage 1: pruner ─────────────────────────────────────────────────────────
FROM node:22-alpine AS pruner
RUN npm install -g turbo@2.0.14
WORKDIR /app
COPY . .
RUN turbo prune storefront --docker

# ─── Stage 2: deps ───────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@10.12.3 --activate
WORKDIR /app
COPY --from=pruner /app/out/json/ ./
RUN echo 'node-linker=hoisted' > .npmrc && pnpm install --frozen-lockfile

# ─── Stage 3: builder ────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@10.12.3 --activate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=pruner /app/out/full/ ./
# VITE-build-args → ENV, så vite bager dem ind i klient+server-bundlen.
ARG VITE_MEDUSA_BACKEND_URL
ARG VITE_MEDUSA_PUBLISHABLE_KEY
ENV VITE_MEDUSA_BACKEND_URL=$VITE_MEDUSA_BACKEND_URL \
    VITE_MEDUSA_PUBLISHABLE_KEY=$VITE_MEDUSA_PUBLISHABLE_KEY
WORKDIR /app/apps/storefront
RUN pnpm build

# ─── Stage 4: runtime ────────────────────────────────────────────────────────
# TanStack Start producerer en fetch-handler (dist/server/server.js) + statiske
# assets (dist/client/), IKKE en node-listener. server.mjs broer den til en
# node-HTTP-server via @hono/node-server (deps fra node_modules).
FROM node:22-alpine AS runtime
RUN apk add --no-cache tini curl && \
    addgroup -g 1001 nodejs && \
    adduser -D -u 1001 -G nodejs nodejs
WORKDIR /app
USER nodejs
COPY --from=builder --chown=nodejs:nodejs /app/apps/storefront/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/apps/storefront/server.mjs ./server.mjs
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
EXPOSE 3000
ENV PORT=3000 \
    HOST=0.0.0.0
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.mjs"]
