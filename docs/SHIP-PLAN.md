# MedicoMatch — Production Ship Plan (Phase 3)

> [!NOTE]
> **SUPERSEDED / HISTORICAL ARCHIVE**
> This ship plan represents the phase 3 snapshot from 2026-08-27. For current deployment documentation and live production operations, refer to [DEPLOYMENT.md](file:///d:/cls/medico-match-visions/DEPLOYMENT.md).

Role model used below (as in a professional release-engagement setup): **EM** (approver), **BE** (backend), **FE** (frontend), **SRE/DevOps**, **QA**.
Evidence basis: Phase 1 audit (`docs/AUDIT-PHASE1.md`) + Phase 2 fixes (commits f7d1d09..7e4ede5). All gates listed were executed and passed on 2026-08-27 unless marked PENDING.

---

## 0. Current state snapshot

| Gate | Command | Status |
|---|---|---|
| Typecheck | `npx tsc -p tsconfig.app.json --noEmit` (+ node variant) | PASS (exit 0) |
| Lint | `npm run lint` | PASS |
| Unit/integration | `npx vitest run` | PASS 193/193 (16 files) |
| Build | `npm run build` | PASS (~30s) |
| Dep audit (front) | `npm audit --omit=dev --audit-level=high` | PASS (2 moderates deferred: react-router v6→v7, esbuild dev chain) |
| Server syntax | `node --check src/*.mjs tests/*.mjs` | PASS 7/7 |
| Server e2e (JSON mode) | `node tests/smoke.mjs` | PASS 34/34 |
| Server e2e (Postgres) | `node tests/smoke-db.mjs` | WIRED IN CI (`.github/workflows/ci.yml` runs it against a `postgres:16` service container on every push/PR) |
| CI on clean checkout | `.github/workflows/ci.yml` | SHOULD PASS (all constituent commands green locally; first real run pending push) |

Known deferred findings (documented, non-blocking): M-1/M-8 client quota display consolidation, react-router v7 migration, shortlists staying localStorage-only.

---

## 1. Decisions required before cutover (owner)

1. **Hosting targets**: backend host (Railway/Fly per DEPLOYMENT.md?) + Postgres provider (Supabase?). Drives runbook §4.
2. **Domains/TLS**: apex/API hostname, DNS owner; `APP_URL` value (must be https; defines CORS + emailed links).
3. **Email sender identity**: confirm `EMAIL_FROM=MedicoMatch <no-reply@medicomatch.in>` domain is verified in Resend (SPF/DKIM) — otherwise verify/reset mail lands in spam.
4. **Webhook endpoint**: create Razorpay webhook → `https://<api>/api/webhooks/razorpay` (events: payment.captured, payment.failed, refund.processed); capture secret for `RAZORPAY_WEBHOOK_SECRET`.
5. **Root admin roster**: exact `ADMIN_EMAILS` list (become ROOT admins at boot; audited).
6. **Astrology launch flag**: keep `ASTROLOGY_ENABLED=false` (default) or enable SKUs at launch?
7. **Backup policy acceptance**: Supabase PITR/daily dumps + `invoice_seq.json` backup cadence (GST counter — see §5).

---

## 2. Environments & configuration matrix

Three environments, promotion dev → staging → prod. Derived from `server/.env.example`, `DEPLOYMENT.md`, cross-checked against fail-closed boot checks in `server/src/index.mjs`.

| Var | Dev | Staging | Prod |
|---|---|---|---|
| `NODE_ENV` | unset/test | production-like | `production` (required) |
| `DATABASE_URL` | optional (JSON fallback) | staging Postgres | Postgres/Supabase (**required**) |
| `RAZORPAY_KEY_ID/SECRET` | sandbox | Razorpay **test-mode** keys | Razorpay **live-mode** keys |
| `RAZORPAY_SIMULATE` | true ok | false | unset (boot fails otherwise) |
| `RAZORPAY_WEBHOOK_SECRET` | n/a | test webhook secret | live webhook secret (**required**, M-5 fix) |
| `APP_URL` | http://localhost:8080 | https://staging… | https://www… (**required**) |
| `ACTIVATION_SECRET` | dev value ok | dedicated random 32B+ | dedicated random 32B+ (**required**; rotation kills all sessions) |
| `RESEND_API_KEY` | dev log mode | test key | prod key (**required**) |
| `ADMIN_EMAILS` | any | staging admins | prod ROOT admins |
| `CORS_ORIGINS` | localhost | staging origins | prod origin(s) |
| FE `VITE_API_BASE_URL` | http://localhost:3001 | staging API URL | prod API URL |
| FE `VITE_RAZORPAY_KEY_ID` | sandbox | test publishable | live publishable |
| FE `VITE_ASTROLOGY_ENABLED` | false | false | decision #6 |

Provisioning checklist (SRE):
- [ ] Create Postgres instance; save connection string; enable automated backups/PITR
- [ ] Supabase Storage bucket `profile-photos` (public read) if object storage wanted; else bounded data URLs stay in DB (works today)
- [ ] Backend service: health check `/health`, restart always, **single instance** (SSE hub + auth mirror are single-writer by design; scale-out needs Redis pub/sub first — documented in code)
- [ ] Static hosting for SPA: `dist/` + `netlify.toml` (Netlify SPA fallback) / `wrangler.jsonc` (Cloudflare)
- [ ] Secrets in host vault only (git ignores `.env*`; verified)

---

## 3. Database & migration drill

Schema lives in `server/migrations/schema.sql`, applied automatically at boot by `migrate()`:
idempotent DDL, whole-file transaction, advisory lock `791234567` + `schema_version` row (replica-safe), additive-only style including data-preserving rebuilds (subscriptions PK widening, channel pair canonicalization).

Drill (BE + QA):
1. Snapshot staging DB → restore onto scratch instance (proves restorability early).
2. Point scratch server at restored copy; boot once; assert `migrations_applied` log + `schema_version(1)` row.
3. Run `node tests/smoke-db.mjs` with `TEST_DATABASE_URL=<scratch>` — full wired e2e: registration mirror, server quota enforcement, channel creation on accept, video-date refund keyed to consumption month, contact-reveal honesty, forged-session rejection, admin surfaces, webhook signature rejection, replay without double-grant.
4. Never run smoke-db against prod/staging: it self-refuses non-loopback/non-`*_test` URLs (M14 guard) — do not bypass.
5. Record cold-boot migration duration on empty vs restored-with-data copies (expect seconds; investigate if not).

Residual risk for review: runner has no forward version tracking beyond version=1 — migrate to numbered migration files before any v2 schema work.

---

## 4. Deploy runbook (staging first, then prod)

Order matters: **DB exists before backend boots** (boot migrates + fails closed), backend healthy before SPA points at it.

Staging:
1. Provision config matrix values (§2) in host vault.
2. Deploy backend; watch logs for `migrations_applied` then `server_started` with `database:true, simulatePayments:false`.
3. Configure Razorpay **test** webhook (decision #4).
4. QA pass on staging (§6), incl. one test-mode UPI payment end-to-end: order → checkout modal → signature verify → plan active without reload; then dashboard refund → confirm immediate downgrade + webhook path.
5. Verify email round-trip (register → link arrives → verify lands signed-in).

Prod cutover:
1. Final diff review EM+BE.
2. Provision prod secrets; deploy backend; confirm boot logs.
3. Register live webhook endpoint (secret from decision #4).
4. First boot promotes ROOT admins via `ADMIN_EMAILS` (idempotent, logged as `root_admins_promoted`).
5. Deploy SPA with prod `VITE_*` baked at build time.
6. Post-deploy smoke (~10 min):
   - GET `<api>/health` -> `{"ok":true}` (liveness only). Confirm `database:true` in the `server_started` boot log line, then verify a wired route rejects anonymous calls: `GET <api>/api/quota` -> 401.
   - Real signup with an inbox you control; verification link works
   - ₹1 live UPI transaction with founder's card/UPI validates the full money loop (live keys cannot use simulation)
   - Two matched accounts exchange a chat message; SSE realtime confirmed
   - Root admin loads /admin console

## 5. Backup / restore / DR

- Postgres: provider PITR/daily snapshots; weekly restore drill onto scratch (repeats §3 steps 1–2; quarterly thereafter).
- `server/data/invoice_seq.json`: ONLY stateful JSON file in DB mode (sequential GST invoice counter). Back it up; recovery = reseed {year,n} from last issued invoice PDFs if lost.
- Sessions are stateless HMAC tokens (7d TTL; tokenVersion invalidation on password events) — no session store to back up.
- Proposed targets: RPO ≤ 24h, RTO ≤ 2h (single-service redeploy + DNS).
- On-call/contact assignment in host dashboards (EM + BE).

## 6. Quality gates & sign-off (QA)

Automated (CI enforces every push/PR): lint, typecheck ×2, vitest, npm audit ×2 trees at --audit-level=high, server syntax check, JSON smoke, PG e2e once `TEST_DATABASE_URL` CI secret is wired.

Manual RC script (staging, ~60 min):
- Auth: register/duplicate-register generic responses, verify, wrong-password, forgot/reset, change-password invalidating the other tab
- Quota: basic-limit interest blocked at N+1, video-date cancel refunds consumption month, contact reveal charges exactly once and never on empty-contact profiles
- Payments (test keys): UPI success grants plan without reload; modal dismiss = cancelled toast, no grant; forged order_sim rejected; replayed webhook does not double-grant
- Moderation: report → resolve from console; block severs chat both directions instantly
- Probe smoke: profile fields escaped, bare `?checkout=success` grants nothing

Sign-off: QA approves RC script; BE approves migration drill; EM GO/NO-GO.

## 7. Observability & ops hardening (post-cutover week 1)

Already in code: structured JSON logs (reqId/userId/status/durationMs), central error handler, fail-closed boot validation, admin/refund audit log, boolean-only health endpoint.
Add immediately:
1. Log drain → retained search (host-native or Papertrail)
2. Error tracking (Sentry or host-native) hooked to unhandled errors
3. Uptime monitor on `/health` (1-min interval alerting)
4. Razorpay dashboard webhook-failure alerts enabled
5. Weekly `admin_audit_log` review during month one

## 8. Rollback plan

- Frontend: redeploy previous static artifact (host keeps history). Instant.
- Backend: redeploy previous commit/image — safe against schema drift because all migrations so far are additive; VERIFY this once by booting previous commit against the migrated DB during §3 drill (repeat quarterly).
- Config rollback via secrets-manager history. Changing `ACTIVATION_SECRET` invalidates all sessions by design — break-glass only.
- Payment edge: webhook misbehavior never blocks grants (verify-time capture + idempotency tables); refunds revert to dashboard-driven until fixed.
- Triggers: 5xx/hang spike on write APIs > 5 min; webhook failures > 30 min; any money-math discrepancy.

## 9. Sequencing (working days)

| Day | Track | Items |
|---|---|---|
| D0 | All | Decisions §1 locked; staging provisioned |
| D1 | BE+SRE | Migration drill §3 incl. restore-from-snapshot; smoke-db green on scratch; wire TEST_DATABASE_URL CI secret |
| D2 | QA | RC manual pass on staging (payments/quotas/moderation) |
| D2 | FE | Fallout fixes; final build |
| D3 | EM | DEPLOYMENT.md freshness check vs reality; GO/NO-GO |
| D4 | SRE | Prod provisioning + cutover runbook §4 + post-deploy smoke |
| D5+ | BE | Observability §7; M-1/M-8 follow-up grooming; router v7 scheduled |

Fast track ≈3 days if decisions land today and test payments behave first try.

## 10. Explicit out-of-scope (tracked)

- Horizontal scaling (needs Redis pub/sub for SSE + auth-store extraction out of users.json)
- Per-device session revocation (tokenVersion covers password events only)
- react-router-dom v7 upgrade (+2 moderate advisories)
