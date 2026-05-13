# Railway build for the ingest-worker. Repo-root Dockerfile so npm
# workspaces resolve @dancestep/db (the shared types package) when
# the worker imports it. Multi-stage build keeps the final image
# small and free of dev deps + TS source.

FROM node:22-bookworm-slim AS builder
WORKDIR /app

# Copy lockfile + manifests for the workspaces this image needs.
# apps/web is part of the root workspaces list but we don't copy
# its package.json here on purpose — installing it would pull in
# Next/React/etc. that the worker doesn't need.
COPY package.json package-lock.json ./
COPY packages/db/package.json ./packages/db/
COPY apps/ingest-worker/package.json ./apps/ingest-worker/

# Install only the workspaces this image cares about. -w accepts
# the workspace name OR its filesystem path; using paths keeps it
# robust against renames.
RUN npm install \
      -w packages/db \
      -w apps/ingest-worker \
      --include-workspace-root \
      --include=dev \
      --ignore-scripts

# Pull in source.
COPY packages/db ./packages/db
COPY apps/ingest-worker ./apps/ingest-worker

# Compile @dancestep/db first; the worker imports its dist output.
RUN npm run build -w @dancestep/db
RUN npm run build -w ingest-worker

# ----- runtime -----
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Re-install production deps only.
COPY package.json package-lock.json ./
COPY packages/db/package.json ./packages/db/
COPY apps/ingest-worker/package.json ./apps/ingest-worker/
RUN npm install \
      -w packages/db \
      -w apps/ingest-worker \
      --include-workspace-root \
      --omit=dev \
      --ignore-scripts

# Bring over the compiled output.
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/apps/ingest-worker/dist ./apps/ingest-worker/dist

# One-shot job. Railway Cron invokes this on schedule; the process
# exits 0 on success / non-zero on failure so the cron run is
# marked accurately.
CMD ["node", "apps/ingest-worker/dist/index.js"]
