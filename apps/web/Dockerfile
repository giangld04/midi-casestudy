# ── Stage 1: builder ──────────────────────────────────────────────────────────
# Install deps and build the Vite SPA to dist/
FROM node:24-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10.31.0 --activate

WORKDIR /app

# Copy workspace manifests + lockfile first for cache efficiency
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

# Fetch packages into pnpm store
RUN pnpm fetch --frozen-lockfile

# Copy full source
COPY . .

# Install from local cache
RUN pnpm install --frozen-lockfile --offline

# Build web SPA (tsc + vite build → dist/)
RUN pnpm --filter @ama-midi/web build

# ── Stage 2: nginx static server ──────────────────────────────────────────────
# Serve built assets; nginx handles SPA fallback routing
FROM nginx:1.27-alpine AS runtime

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Custom nginx config for SPA routing
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost/index.html || exit 1

CMD ["nginx", "-g", "daemon off;"]
