# MedicoMatch API — single long-lived process on Railway.
# WHY a container (not serverless): the server holds SSE connections in
# memory (src/events.mjs), keeps a Postgres LISTEN/NOTIFY socket open, runs
# the engagement digest on setInterval, and runs idempotent migrations at
# boot (src/db.mjs migrate()). Vercel-style per-request functions cannot do
# any of these. See DEPLOYMENT.md "Deploy steps" for the full walkthrough.
#
# Single instance is REQUIRED (railway.json numReplicas: 1): the PoW
# challenge map is per-process (DEPLOYMENT.md operational note M-6).
FROM node:20-alpine

WORKDIR /app

# Install production deps first (cached layer; server has its own lockfile).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# App code (schema.sql included — boot-time migrate() reads it from disk).
COPY src ./src
COPY migrations ./migrations

ENV NODE_ENV=production
EXPOSE 3001

# Run as a non-root user (audit L-1). The node image ships a `node` user for
# exactly this purpose; the API process has no reason to be uid 0.
USER node

# Container-level liveness probe. Railway uses the `healthcheckPath` in
# railway.json (which points at /readyz, the readiness endpoint), but a
# HEALTHCHECK keeps the container honest when it is run by another runtime
# (docker run, Compose, k8s). /health is liveness-only and always 200 once
# the process is listening; /readyz additionally requires migrations to have
# applied and a successful SELECT 1.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/index.mjs"]
