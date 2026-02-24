# =============================================================================
# Stage 1: Build
# Installs all dependencies (including devDependencies) and runs esbuild
# to produce a single-file ESM bundle at dist/index.js.
# =============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm globally
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Copy workspace manifests first for layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY apps/worker/package.json ./apps/worker/package.json

# Install all workspace dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY tsconfig.base.json ./
COPY packages/shared/ ./packages/shared/
COPY apps/worker/ ./apps/worker/

# Build the shared package first so the workspace link resolves
RUN pnpm --filter @bugflow/shared build 2>/dev/null || true

# Bundle the worker with esbuild
# --bundle: inline all imports
# --platform=node: target Node.js built-ins
# --format=esm: output ES modules (package.json has "type":"module")
# --packages=external: keep node_modules external to reduce bundle size
#                       and avoid duplicating Anthropic SDK, discord.js, etc.
RUN pnpm --filter @bugflow/worker build


# =============================================================================
# Stage 2: Runtime
# Lean production image – only production dependencies + the compiled bundle.
# =============================================================================
FROM node:20-alpine AS runner

WORKDIR /app

# Install pnpm for production dependency installation
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Copy workspace files needed to install production deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY apps/worker/package.json ./apps/worker/package.json

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy the compiled bundle from the build stage
COPY --from=builder /app/apps/worker/dist ./apps/worker/dist

# Copy shared package build artefacts (needed for workspace resolution at runtime)
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

# Non-root user for security
RUN addgroup --system --gid 1001 bugflow \
 && adduser  --system --uid 1001 --ingroup bugflow bugflow
USER bugflow

EXPOSE 8080

# Health check mirrors the Fly.io check configuration
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:8080/ || exit 1

CMD ["node", "apps/worker/dist/index.js"]
