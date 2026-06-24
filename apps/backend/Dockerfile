# syntax=docker/dockerfile:1.7
# ─────────────────────────────────────────────────────────────────────────────
# Backend-Dockerfile for bloom-starter-essentials (Medusa V2.16, pnpm turbo-monorepo).
#
# Adapteret fra smalltownweb/medusa-template's backend-Dockerfile (npm) → pnpm:
#   * npm ci            → pnpm install --frozen-lockfile (node-linker=hoisted, så
#                         node_modules er flad og kan COPY'es på tværs af stages)
#   * turbo prune @smalltown/backend → turbo prune backend (unscoped navn i essentials)
#   * pnpm@10.12.3 via corepack; turbo pinnet til repo'ets ^2.0.14
# Ingen Redis (essentials bruger in-memory cache/event-bus — kun Postgres kræves;
# det er en env/service-forskel, ikke en Dockerfile-forskel).
#
# Build context = monorepo-root (IKKE apps/backend/). Coolify:
#   Build context:   /
#   Dockerfile path: apps/backend/Dockerfile
#   Port:            9000
# ─────────────────────────────────────────────────────────────────────────────

# ─── Stage 1: pruner ─────────────────────────────────────────────────────────
FROM node:22-alpine AS pruner
RUN npm install -g turbo@2.0.14
WORKDIR /app
COPY . .
RUN turbo prune backend --docker

# ─── Stage 2: deps ───────────────────────────────────────────────────────────
# node-linker=hoisted → flad node_modules (som npm), så de kan COPY'es til runtime.
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
WORKDIR /app/apps/backend
RUN npx medusa build

# ─── Stage 4: runtime ────────────────────────────────────────────────────────
# Medusa V2 forventer medusa-config i CWD → kopier .medusa/server/-indhold til /app.
FROM node:22-alpine AS runtime
RUN apk add --no-cache tini curl && \
    addgroup -g 1001 medusa && \
    adduser -D -u 1001 -G medusa medusa
WORKDIR /app
RUN chown medusa:medusa /app
COPY apps/backend/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
USER medusa
COPY --from=builder --chown=medusa:medusa /app/apps/backend/.medusa/server/ ./
COPY --from=builder --chown=medusa:medusa /app/node_modules ./node_modules
EXPOSE 9000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["/docker-entrypoint.sh"]
