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

# Railway injects $PORT (3001); /health stays liveness-only, /readyz gates.
CMD ["node", "src/index.mjs"]