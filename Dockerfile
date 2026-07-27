# ── Stage 1: Base ────────────────────────────────────────────────────────────
# Shared foundation for all stages. Keeps the base image consistent.
FROM node:24.15.0-alpine AS base

WORKDIR /app

# ── Stage 2: Development ──────────────────────────────────────────────────────
# Runs as root — fine for a local dev environment behind Docker Desktop.
# Avoids all permission complexity (no chown, no USER switching needed).
# Used by docker-compose.yml via build.target: development.
FROM base AS development

COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

# Source is bind-mounted from the host in compose for hot reload,
# but we still COPY here so the image is self-contained if run standalone.
COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]

# ── Stage 3: Builder ──────────────────────────────────────────────────────────
# Throwaway intermediate stage. Compiles TypeScript → dist/.
# Runs as root — this image is never deployed or exposed.
FROM base AS builder

COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

COPY . .

RUN npm run build

# ── Stage 4: Production ───────────────────────────────────────────────────────
# Lean final image: only compiled JS and production dependencies.
# This is the only stage that gets deployed, so this is where we drop privileges.
FROM base AS production

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev --legacy-peer-deps

# Pull the compiled output from the builder stage.
COPY --chown=node:node --from=builder /app/dist ./dist

# Drop to non-root right before running the app — the only place it matters.
USER node

EXPOSE 3000

CMD ["node", "dist/main"]
