# ── Stage 1: dependency install + build ───────────────────────────────────────
# Install all deps (including dev) and compile TypeScript to dist/.
FROM node:24-alpine AS builder

# Enable corepack and pin pnpm version matching root packageManager field
RUN corepack enable && corepack prepare pnpm@10.31.0 --activate

WORKDIR /app

# Copy workspace manifests + lockfile first for layer caching
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/

# Install all dependencies (frozen for reproducibility)
RUN pnpm install --frozen-lockfile

# Copy full source after deps layer is cached
COPY . .

# Compile TypeScript → dist/
RUN pnpm --filter @ama-midi/api build

# Prune dev dependencies from node_modules (in-place)
RUN pnpm --filter @ama-midi/api --prod deploy /prod --legacy

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
# Lean image — only production deps + compiled JS
FROM node:24-alpine AS runtime

WORKDIR /prod

# Copy production node_modules from builder's pruned deploy output
COPY --from=builder /prod/node_modules ./node_modules

# Copy compiled output from builder
COPY --from=builder /app/apps/api/dist ./dist

# Copy drizzle migration files so migrate.ts can locate them at runtime
COPY --from=builder /app/packages/db/drizzle ./drizzle

# Run as non-root for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

# Preload OpenTelemetry so it patches http/express/pg/ioredis before index.js loads.
# No-op at runtime unless OTEL_EXPORTER_OTLP_ENDPOINT is configured.
CMD ["node", "--require", "./dist/observability/telemetry.js", "dist/index.js"]
