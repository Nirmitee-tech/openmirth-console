# syntax=docker/dockerfile:1.7

# ── Stage 1: dependency install ──────────────────────────────────────────
FROM node:20.18-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev=false

# ── Stage 2: build ───────────────────────────────────────────────────────
FROM node:20.18-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build needs SESSION_PASSWORD to pass env validation at static gen time.
# Use a build-time placeholder; the real value is supplied at runtime.
ENV SESSION_PASSWORD="build-time-placeholder-32+chars-not-used-at-runtime"
ENV MIRTH_URL="https://placeholder:8443"
ENV MIRTH_USER="placeholder"
ENV MIRTH_PASS="placeholder"
ENV NODE_ENV=production
RUN npm run build

# ── Stage 3: runtime ─────────────────────────────────────────────────────
FROM node:20.18-bookworm-slim AS runner
WORKDIR /app

# Run as a non-root user — required for any restricted PodSecurityContext.
RUN groupadd -r app -g 1001 && useradd -r -u 1001 -g app -d /app -s /sbin/nologin app
# Drop apt cache to keep the image small.
RUN apt-get update \
  && apt-get install -y --no-install-recommends tini ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3030

# Copy standalone build output. Next 15 standalone mode bundles only the
# files needed at runtime, plus a minimal node_modules.
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public

USER app
EXPOSE 3030

# Tini reaps zombies and proxies signals so the container exits cleanly
# on SIGTERM (k8s rolling deploy).
ENTRYPOINT ["/usr/bin/tini", "--"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3030/api/healthz || exit 1

CMD ["node", "server.js"]
