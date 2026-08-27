# Deployment Guide - MedicoMatch

## Architecture

- **Frontend**: React + TS + Vite SPA (`npm run build` -> `dist/`). Static
  hosting (Netlify/Vercel/any CDN). `public/_redirects` covers SPA routing.
- **Backend**: single Express process (`server/`) - auth, Razor orders,
  payment verification, single-use entitlement tokens, GST invoices.
  **Persistence lives in Postgres** (`DATABASE_URL`): profiles, quotas,
  interests, chat channels/messages, video dates, billing, admin audit and
  notifications. The schema is `server/migrations/schema.sql`, idempotent,
  applied automatically at boot behind a Postgres advisory lock.
  The JSON files in `server/data/` are the **dev/test fallback** mode used only
  when `DATABASE_URL` is unset; in production the only JSON file treated as
  state is `invoice_seq.json` (the sequential GST invoice counter).

> The static viewable catalog / demo seeds are marked `is_sample` or gated
> behind demo mode and are never presented as real members in production.

## Environment variables

### Frontend (build-time, `VITE_`-prefixed)

| Var | Required | Notes |
| --- | --- | --- |
| `VITE_API_BASE_URL` | prod: yes | Backend origin, e.g. `https://api.medicomatch.in` |
| `VITE_RAZORPAY_KEY_ID` | prod: yes | Razorpay publishable key (safe in bundle) |
| `VITE_DEV_SKIP_AUTH` | no | Dev-only; `import.meta.env.DEV` eliminates it from prod builds |
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
| `DATABASE_URL` | **prod: yes** | Postgres/Supabase. Profiles, quotas, interests, chat, billing live here; schema.sql runs at boot, failure aborts startup |
| `RAZORPAY_WEBHOOK_SECRET` | prod: recommended | Verifies payment.captured AND refund.processed webhooks |
| `RESEND_API_KEY` | **prod: yes** | Emails carry verify/reset tokens; the server fails closed if unset (never logs tokens) |
| `ADMIN_EMAILS` | no | Comma-separated emails promoted to **ROOT admin** at boot (root manages the admin roster) |
| `CORS_ORIGINS` | no | Comma-separated extra origins |
| `EMAIL_FROM` | no | Default `MedicoMatch <no-reply@medicomatch.in>` |
| `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` | no | Object storage for profile photos (else bounded data-URL blobs) |
| `DATA_DIR` | no | Dev JSON-store directory (default `server/data`) |
| `ASTROLOGY_ENABLED` | no | `true` to sell astrologer consultation SKUs; off by default |
| `PORT` | no | Default 3001 |
## Pre-deploy checklist

1. `npm ci && npm run lint && npx tsc -p tsconfig.app.json --noEmit && npx tsc -p tsconfig.node.json --noEmit && npx vitest run && npm run build` - all green.
2. `cd server && node tests/smoke.mjs` (and `node tests/smoke-db.mjs` against a scratch `TEST_DATABASE_URL`) - green.
3. Boot the server in production mode locally with real env first: it must start cleanly (fail-closed boot validates Razorpay, APP_URL https, ACTIVATION_SECRET, DATABASE_URL and RESEND_API_KEY). Migrations run automatically at boot.
4. Schema changes are applied by the idempotent boot-time migration (`migrate()` in `server/src/db.mjs`, advisory-locked so concurrent boots never race). Sessions carry a token version => each user signs in once more after a deploy.
5. Back up the **database** (see Backup/restore) AND `server/data/invoice_seq.json` before anything touching billing - the GST invoice counter must never be reset.

## Deploy steps

1. Push frontend; build with prod env vars; upload `dist/`.
2. Deploy `server/` (Node 20+ host) behind TLS. Set runtime env vars from the table above. Configure TWO Razorpay webhooks at `https://API/api/webhooks/razorpay` using `RAZORPAY_WEBHOOK_SECRET`: `payment.captured` and `refund.processed`. Set `ADMIN_EMAILS` to your operator addresses.
3. Smoke test production:
   - `curl https://API/health` -> `{"ok":true,"razorpayConfigured":true,"simulatePayments":false}`
   - Register + login a test account via `/api/auth/register` / `/api/auth/login`.
   - Place a real minimum purchase in Razorpay test mode before live.
4. Watch structured logs (`msg:"request"` JSON lines) for 5xx rates.

## Rollback plan

- **Frontend**: redeploy the previous `dist/` artifact - stateless.
- **Backend / database**: redeploy the previous `server/` build and restore the Postgres schema/data from the pre-deploy backup (schema.sql is additive-only and idempotent, so an older binary will not lock out a newer schema).
- **Session invalidation (all users)**: rotate `ACTIVATION_SECRET` and restart. Individual users are invalidated automatically when their password changes (tokenVersion bump).
- **Refund policy (default)**: a refunded membership payment downgrades the account to basic immediately; consumed quotas are not clawed back. Admin refunds live in `/admin` > Payments.
- **Payments emergency**: to stop checkout, scale the API to a maintenance page - the frontend fails closed with "Checkout is not configured".

## Backup / restore

- What to back up: the **Postgres database** (profiles, quotas, interests, chat, video dates, billing, admin audit, notifications) AND `server/data/invoice_seq.json` (sequential GST invoice counter).
- Postgres backup: `pg_dump --no-owner --no-privileges -Fc "$(cat DATABASE_URL)" > medicomatch.dump` (or your host's managed snapshot, e.g. Supabase PITR). Migrations are idempotent, so a fresh install + `schema.sql` + the dump restores cleanly.
- Frequency: daily + before each deploy.
- Restore: stop the server, restore the dump into the target database (or a fresh one, then repoint `DATABASE_URL`), restore `server/data/invoice_seq.json`, then start the server.

## Operational notes / known limits

- **Single instance**: the invoice counter and per-IP rate limits are in-process state; in DB mode redeemed activation tokens are durable in Postgres (`redeemed_tokens`). Multi-replica deployments still need shared storage for rate limiting.
- **Sessions are stateless** (signed, 7-day, versioned). Password change/reset invalidates that user's sessions instantly; global revocation = rotate `ACTIVATION_SECRET`.
- **TLS**: remote Postgres connections require validated TLS (`rejectUnauthorized` on by default). Use `PGSSLMODE=no-verify` only behind an intentional TLS-terminating proxy.
- Logs are JSON lines on stdout - ship them to your log platform.

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