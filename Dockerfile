# ═══════════════════════════════════════════════════════════════════════════════
# UHQ Wallet Addon — Dockerfile
# Build multi-stage : web (React/Vite) → api (NestJS) → runner
#
# Compatible Coolify / Docker Compose.
# Volume persistant recommandé : /app/data  (contient wallet-data.json)
# Port exposé : 3001
# ═══════════════════════════════════════════════════════════════════════════════

# ── Stage 1 : Build React ────────────────────────────────────────────────────
FROM node:20-alpine AS web-builder
WORKDIR /build/web
COPY web/package*.json ./
RUN npm ci --prefer-offline
COPY web/ ./
RUN npm run build

# ── Stage 2 : Build NestJS ───────────────────────────────────────────────────
FROM node:20-alpine AS api-builder
WORKDIR /build/api
COPY api/package*.json ./
RUN npm ci --prefer-offline
COPY api/ ./
RUN npm run build
# Supprime les devDependencies
RUN npm prune --production

# ── Stage 3 : Runner ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

# Copie les artefacts de build
COPY --from=api-builder /build/api/dist        ./api/dist
COPY --from=api-builder /build/api/node_modules ./api/node_modules
COPY --from=web-builder /build/web/dist        ./web/dist
COPY uhq-manifest.json ./

# Répertoire des données persistantes
RUN mkdir -p /app/data
VOLUME ["/app/data"]

# Seul le port NestJS est exposé (pas le port Vite dev)
EXPOSE 3001

ENV NODE_ENV=production \
    PORT=3001 \
    DB_PATH=/app/data/wallet-data.json

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:3001/uhq-manifest.json | grep -q '"name"' || exit 1

CMD ["node", "api/dist/main"]
