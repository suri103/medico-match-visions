# Deployment Guide - MedicoMatch

## Architecture

- **Frontend**: React + TS + Vite SPA (`npm run build` -> `dist/`). Static
  hosting (Netlify/Vercel/Cloudflare). SPA deep links are handled by the host
  config: `vercel.json` rewrites everything to `/index.html`,
  `wrangler.jsonc` sets `not_found_handling: single-page-application` for
  Cloudflare, and `netlify.toml` covers Netlify. Build with the production
  `VITE_*` values baked in — a `dist/` built against a local `.env` ships an API
  base of `localhost`.
  - **Requires npm >= 11** (`packageManager` is pinned to `npm@11.21.1`).
    npm 10.x crashes with an arborist peer-resolution error on the
    `vite >= 8.2.4` dependency graph.
  - `vite.config.ts` pins `NODE_ENV=production` for `vite build` and strips
    `VITE_DEV_SKIP_AUTH` from production bundles, so a developer's local
    `.env` can never enable the demo auth bypass in a shipped artifact.
  - `npm run build` also runs `postbuild`, which regenerates `dist/_headers`
    (CSP `connect-src` + `report-uri` from `VITE_API_BASE_URL`, plus
    `Cache-Control` rules) and then runs `scripts/verify-prod-build.mjs`. That
    verifier **fails the build** if the bundle contains the demo sign-in UI,
    the dev-auth crash guard, published source maps, a bare-scheme CSP
    wildcard, or a missing SPA fallback.
- **Backend**: single Express process (`server/`) - auth, Razor orders,
  payment verification, single-use entitlement tokens, GST invoices.
  **Persistence lives in Postgres** (`DATABASE_URL`): profiles, quotas,
  interests, chat channels/messages, video dates, billing, admin audit and
  notifications. The schema is `server/migrations/schema.sql`, idempotent,
  applied automatically at boot behind a Postgres advisory lock.
  In production DB mode, state is 100% database-backed: sequential GST invoices use
  Postgres `invoice_sequences`, rate limiting uses `rate_limit_buckets`, and
  SSE pub/sub fanout uses Postgres `LISTEN/NOTIFY`. The JSON files in `server/data/`
  are dev/test fallbacks used only when `DATABASE_URL` is unset.

> The static viewable catalog / demo seeds are marked `is_sample` or gated
> behind demo mode and are never presented as real members in production.

## Environment variables

### Frontend (build-time, `VITE_`-prefixed)

| Var | Required | Notes |
| --- | --- | --- |
| `VITE_API_BASE_URL` | prod: yes | Backend origin, e.g. `https://api.medicomatch.in` |
| `VITE_RAZORPAY_KEY_ID` | prod: yes | Razorpay publishable key (safe in bundle) |
| `VITE_DEV_SKIP_AUTH` | no | Dev-only. `vite.config.ts` strips it from production bundles, so it can never reach a shipped artifact. Set it only in a local `.env` for development. |
| `VITE_SUPPORT_EMAIL` | no | Support inbox on the Help page |
| `VITE_ASTROLOGY_ENABLED` | no | `true` to ship the astrology consultation UI (`/astrology`); off by default |

### Backend (runtime)

| Var | Required | Notes |
| --- | --- | --- |
| `NODE_ENV` | yes | Must be `production` in prod - enables fail-closed boot checks |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | prod: yes | Boot fails at start without them |
| `RAZORPAY_SIMULATE` | no | Must be unset/false in prod (server refuses to start otherwise) |
| `APP_URL` | **prod: yes** | Allowed CORS origin AND base URL of emailed links; must be https |
| `ACTIVATION_SECRET` | **prod: yes** | Signs sessions + entitlement tokens; boot fails if unset |
| `DATABASE_URL` | **prod: yes** | Supabase **session pooler** URI (port **5432**, host `*.pooler.supabase.com`, user `postgres.<project-ref>`). Profiles, quotas, interests, chat, billing live here; schema.sql runs at boot, failure aborts startup. ⚠️ Do NOT use the direct `db.*.supabase.co` host (IPv6-only — fails with `connect ENETUNREACH` when the host has no IPv6 route) and do NOT use the transaction pooler (port 6543 — drops LISTEN/NOTIFY + advisory locks). |
| `RAZORPAY_WEBHOOK_SECRET` | **prod: yes** | Verifies payment.captured AND refund.processed webhooks; boot fails if unset |
| `RESEND_API_KEY` | **prod: yes** | Emails carry verify/reset tokens; the server fails closed if unset (never logs tokens) |
| `ADMIN_EMAILS` | no | Comma-separated emails promoted to **ROOT admin** at boot (root manages the admin roster) |
| `CORS_ORIGINS` | no | Comma-separated extra origins |
| `EMAIL_FROM` | no | Default `MedicoMatch <no-reply@medicomatch.in>` |
| `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` | no | Object storage for profile photos (else bounded data-URL blobs) |
| `DATA_DIR` | no | Dev JSON-store directory (default `server/data`) |
| `ASTROLOGY_ENABLED` | no | `true` to sell astrologer consultation SKUs; off by default |
| `REPORTS_ENABLED` | no | `true` to sell kundali-report SKU; off by default |
| `RATE_LIMIT_MAX` / `USER_RATE_LIMIT_MAX` | no | Defaults 30 / 60 req/min |
| `TRUST_PROXY_HOPS` | no | Number of proxies in front of the API (default **1**). `req.ip` is the rate-limit bucket key — raise this only when you actually add another proxy hop, never to `true` |
| `BROWSE_DAILY_MAX` | no | Daily profile-row budget (default 1000) |
| `ADMIN_FLAG_TTL_MS` | no | Admin flag cache TTL ms (default 30000). Change the roster via the admin API, not raw SQL (M-5) |
| `MAX_GLOBAL_SSE_CONNECTIONS` | no | Instance-wide cap on concurrent SSE streams (default 5000). Guards against FD/memory exhaustion. |
| `TOKEN_RETENTION_DAYS` | no | How long redeemed/used token hashes are kept in Postgres (default 90). |
| `PGSSLMODE` | no | `no-verify` disables Postgres certificate validation (transport encryption only, no server authentication). Leave unset in production. |
| `REQUIRE_VERIFIED_INTERACT` | no | `true` hard-gates member interactions on verified email (403 `email_unverified`); default `false` (H-2) |
| `DISABLE_POW` / `DISABLE_DIGEST` | no | Test-only; production boot refuses to start if set |
| `PORT` | no | Default 3001 |
## Pre-deploy checklist

1. `npm ci && npm run lint && npm audit --audit-level=high && npx tsc -p tsconfig.app.json --noEmit && npx tsc -p tsconfig.node.json --noEmit && npx vitest run && npm run build` - all green.
2. `cd server && npm ci && npm audit --audit-level=high && for f in src/*.mjs tests/*.mjs; do node --check "$f"; done && node tests/smoke.mjs && node tests/regression-fixes.mjs` (and `node tests/smoke-db.mjs` against a scratch `TEST_DATABASE_URL`) - green. This is exactly what CI runs.
3. Boot the server in production mode locally with real env first: it must start cleanly (fail-closed boot validates Razorpay, APP_URL https, ACTIVATION_SECRET, DATABASE_URL and RESEND_API_KEY). Migrations run automatically at boot.
4. Schema changes are applied by the idempotent boot-time migration (`migrate()` in `server/src/db.mjs`, advisory-locked so concurrent boots never race). Sessions carry a token version => each user signs in once more after a deploy.
5. Back up the **database** (see Backup/restore) before anything touching billing - the GST invoice counter lives in Postgres `invoice_sequences` in DB mode (`server/data/invoice_seq.json` is only the no-DB dev fallback) and must never be reset.

## Deploy steps

> Lock the split: **backend on Railway** (long-lived container), **frontend as
> static SPA** (Vercel or any CDN), **database + photo storage on Supabase**.
> The Express process must persist — it holds SSE connections in memory
> (`server/src/events.mjs`), keeps a Postgres LISTEN/NOTIFY socket open, runs
> the engagement digest on `setInterval`, runs idempotent migrations at boot,
> and keeps the PoW challenge map in-process. Serverless per-request functions
> cannot do any of these. Deploying the API anywhere serverless breaks
> realtime, digests, and the multi-replica PoW contract — do not do it until
> the realtime layer is moved off SSE and the PoW map to a shared store
> (both constraints are called out in Operational notes below).

1. **Supabase (once)**: create the project → run `supabase/storage-profile-photos.sql`
   in the SQL Editor (creates the public `profile-photos` bucket, 2 MB image
   limit) → copy the **session pooler URI** (port **5432**, Settings → Database;
   NOT the transaction pooler on 6543 — see the `DATABASE_URL` row above) and the
   `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` (service-role, server side only).
2. **Railway (backend)**: new service from `server/` (Dockerfile + `railway.json`
   already in the repo; single instance — `numReplicas: 1`, health probe
   `GET /readyz` — the READINESS endpoint, which stays 503 until the boot
   migration has applied and a `SELECT 1` against Postgres succeeds, so a
   still-migrating container is never routed traffic). Paste
   `server/.env.production.example` into the service's
   Variables tab and fill in the secrets. The first boot runs `schema.sql`
   automatically (advisory-locked migration). `PORT` is injected by Railway;
   the code honors it (`server/src/index.mjs:115`).
3. **Vercel (frontend)**: import the repo root, build `npm run build` →
   output `dist/`, paste `.env.production.example` into the Vercel
   Environment Variables for Production. Set the backend domain into
   `APP_URL`/`CORS_ORIGINS` on Railway at the same time.
4. **Razorpay**: create TWO webhooks at `https://<railway-domain>/api/webhooks/razorpay`
   using `RAZORPAY_WEBHOOK_SECRET`: `payment.captured` and `refund.processed`.
   Set `ADMIN_EMAILS` to operator addresses.
5. Smoke test production:
   - `curl https://API/health` -> `{"ok":true}` (liveness only; config state lives in the `server_started` boot log line)
   - `curl https://API/readyz` -> `{"ok":true,"mode":"db"}` (migrations + DB probe)
   - Register + login a test account via `/api/auth/register` / `/api/auth/login`.
   - Place a real minimum purchase in Razorpay test mode before live.
6. Watch structured logs (`msg:"request"` JSON lines) for 5xx rates.

## Rollback plan

- **Frontend**: redeploy the previous `dist/` artifact - stateless.
- **Backend / database**: redeploy the previous `server/` build and restore the Postgres schema/data from the pre-deploy backup (schema.sql is additive-only and idempotent, so an older binary will not lock out a newer schema).
- **Session invalidation (all users)**: rotate `ACTIVATION_SECRET` and restart. Individual users are invalidated automatically when their password changes (tokenVersion bump).
- **Refund policy (default, explicit)**: a FULL refund revokes access immediately (membership → basic, consultation/report → refunded/expired); a PARTIAL refund is bookkept but keeps access. Consumed quotas are not clawed back. Kundali reports are single-use per pair; consultations single-use per booking. Self-service cancel affects memberships only. Admin refunds live in `/admin` > Payments.
- **Payments emergency**: to stop checkout, scale the API to a maintenance page - the frontend fails closed with "Checkout is not configured".

## Backup / restore

- What to back up: the **Postgres database** (profiles, quotas, interests, chat, video dates, billing incl. `invoice_sequences`, admin audit, notifications). `server/data/invoice_seq.json` is only the no-DB dev fallback — back it up only when running without `DATABASE_URL`.
- Postgres backup: `pg_dump --no-owner --no-privileges -Fc "$(cat DATABASE_URL)" > medicomatch.dump` (or your host's managed snapshot, e.g. Supabase PITR). Migrations are idempotent, so a fresh install + `schema.sql` + the dump restores cleanly.
- **Operator runbook scripts** (item 12): `server/scripts/db-backup.sh`, `db-restore.sh`, `db-verify-restore.sh`. The restore is destructive — the script requires typing the literal `RESTORE` to confirm.
- **Verify every restore** by running `db-verify-restore.sh` against the restored DB; the script runs `smoke-db.mjs` which exercises the full quota / billing / SSE / admin pipeline.
- Frequency: daily + before each deploy.
- Restore: stop the server, restore the dump into the target database (or a fresh one, then repoint `DATABASE_URL`), restore `server/data/invoice_seq.json` only for no-DB mode, then start the server.

## Audit log retention

`server/src/index.mjs` prunes `admin_audit_log` at every boot to `ADMIN_AUDIT_RETENTION_DAYS` (default **365**). For financial-services compliance, set it to `2555` (7 years). The notifications feed is also pruned at boot to `NOTIFICATION_RETENTION_DAYS` (default **90**).

## Operational notes
- **Multi-replica ready**: In DB mode, sequential GST invoices are assigned atomically via `invoice_sequences`, rate limiting is synchronized via `rate_limit_buckets`, redeemed activation tokens live in Postgres (`redeemed_tokens`), and real-time SSE broadcasts fan out across nodes via Postgres `LISTEN/NOTIFY`.
- **Auth transport (audit H-1)**: the web SPA is **cookie-first** — `mm_session` is httpOnly and the JSON body returns `token: null` for browsers. Mobile/API clients opt in to a Bearer token with `{"mobile": true}` on login/verify or the `X-MM-Mobile: 1` header; only those clients should keep a token in local storage.
- **Registration PoW challenges are in-memory per process (audit M-6)**: if you run more than one API replica, enable sticky sessions on the challenge+register pair (or accept extra client retries — the SPA fails open and retries). Not an issue single-instance.
- **Sessions are stateless** (signed, 7-day, versioned). Password change/reset invalidates that user's sessions instantly; global revocation = rotate `ACTIVATION_SECRET`.
- **TLS**: remote Postgres connections require validated TLS (`rejectUnauthorized` on by default). Use `PGSSLMODE=no-verify` only behind an intentional TLS-terminating proxy.
- Logs are JSON lines on stdout - ship them to your log platform. Alert on `level:"error"` webhook lines (`webhook_refund_unkeyable`) — they mean a Razorpay payload-shape change is silently skipping refunds (audit L-6).

## Astrology consultations - "introduce later" feature flag

The astrology consultation feature (the `/astrology` page, video-dates
consultation booking, and the backend sell-side for `astrologer-consultation-*`
SKUs) ships in the repo but is **disabled by default**:

- `VITE_ASTROLOGY_ENABLED=false` (frontend build): the `/astrology` route is
  never registered, so the page is unreachable and its lazy chunk is never
  fetched by clients.
- `ASTROLOGY_ENABLED=false` (backend): astrologer SKUs are omitted from the
  price catalog, so `create-order` rejects them - the product is never
  purchasable with no reachable booking UI.

**To launch**: build the frontend with `VITE_ASTROLOGY_ENABLED=true` and set
`ASTROLOGY_ENABLED=true` on the backend, then deploy. No code change - the
booking path, subscription grant and entitlement checks already work.