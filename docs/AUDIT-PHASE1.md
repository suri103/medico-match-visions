# Phase 1 — Production-Readiness Audit (MedicoMatch)

Scope swept end-to-end: `server/src/{index,domain,db,email,events}.mjs`, `server/migrations/schema.sql`, `server/tests/*`, `.github/workflows/ci.yml`, every route/hook/lib in `src/`, config (`eslint.config.js`, `tsconfig*`, `vite.config.ts`, `.env*`, `.gitignore`), `DEPLOYMENT.md`.

Verification actually run in this audit (Windows, node v22):
- `node --check` on all 7 server modules -> all OK
- `node tests/smoke.mjs` (JSON-store mode, isolated DATA_DIR) -> **34/34 ok**
- `npx tsc -p tsconfig.app.json --noEmit` -> exit 0
- `npm run lint` -> clean (no output)
- `npx vitest run` -> **14 files / 177 tests passed**, exit 0
- `npm run build` -> success (built in ~46s)
- Live boot probe on :3199 (`NODE_ENV=test`, JSON mode): auth round-trip + targeted endpoint probes (evidence cited below)
- `npm audit --omit=dev`: frontend **10 vulns (8 high)** -> exit 1; server deps **0 vulnerabilities**

Line numbers refer to the current working tree (heavily modified vs `origin/main`; most of `server/`, `.github/`, and many wired frontend modules are **untracked** - see C-2).

---

## CRITICAL

### C-1. `rateLimited` used as Express middleware hangs every mutating product API (verified live)
- `server/src/index.mjs:388` - `const rateLimited = (req) => { ... return hits.length > RATE_LIMIT_MAX; }` - a **predicate returning boolean**.
- Correct usage (in-handler guard), e.g.: `if (rateLimited(req)) return res.status(429).json({ error: "Too many requests." });`
- Broken usage as **middleware**: index.mjs lines 1244 (PUT /api/me/profile), 1253 (POST /api/interests), 1262 (interests/:id/respond), 1270 (DELETE interest), 1282 (channel messages), 1290 (POST /api/video-dates), 1298 (cancel), 1306/1312 (blocks/unblock), 1318 (reports), 1324 (contact-reveal), 1347 (POST /api/events/ticket), 1387/1391 (billing cancel/resume), 1400 (WebRTC signal), 1434/1438 (notifications read/read-all), 1449 (photo upload), 1485 (consultations), 1532/1577/1596 (admin resolve/patch/refund).

Express calls `rateLimited(req,res,next)`; the predicate ignores `next` and returns a boolean, so **no handler ever runs and no response is ever sent**. Requests hang until client/proxy timeout.
Verified live against the running JSON-mode server:
- Control: `GET /api/quota` (requireDbUser chain) -> instant `503 {"error":"Database not configured..."}` (correct)
- Probe: `PUT /api/me/profile` with valid session -> **timeout after 8s**
- Probe: `POST /api/events/ticket` with valid session -> **timeout after 6s** (so SSE realtime is completely dead too)

Consequences: in DB/production mode **every write path of the product is unreachable** - profile edits, interests, chat sends, video-date booking/cancel, contact reveal, notifications, photo upload, consultations, WebRTC signaling, admin resolve/patch/refunds. This also means `server/tests/smoke-db.mjs` cannot pass today (it exercises `PUT /api/me/profile` expecting 401/200; today it gets no response at all), i.e. the wired e2e gate in CI would fail if CI ever ran this tree (see C-2).
Fix direction: replace bare `rateLimited` middleware args with a wrapper `(req,res,next)=>{ if(rateLimited(req)) return res.status(429).json({error:"Too many requests."}); next(); }`. Smallest change, biggest risk reduction - do it first.

### C-2. Working tree != deployed repo: backend, CI, and all wired features are untracked
- `git status`: `server/` (the entire backend!), `.github/` (CI), plus the whole wired-client surface (`src/services/`, `src/hooks/useAuth|usePlan|useCheckoutResult.ts`, `src/features/favorites/FavoritesContext.tsx`, admin pages, and the entire 177-test suite) are **untracked**. HEAD (`2f467c9`) contains only an older demo-phase SPA.
- Anyone deploying from git gets a frontend with no backend and no CI. `DEPLOYMENT.md` and `README.md` describe the full stack that exists only in the working tree.

### C-3. Wired-mode quota double-spend between two independent ledgers
Two authoritative quota systems run simultaneously in production:
- Server truth: `user_quotas` enforced transactionally (`server/src/domain.mjs` consumeQuotaTx - atomic conditional UPDATE keyed to plan max; refund-on-cancel keyed to consumption month).
- Local truth: localStorage ledgers in `src/hooks/usePlan.ts:52` (`consumeFromLedger`) gating the UI.

Client books by consuming **local** quota first, then firing the server mutation fire-and-forget:
- `src/pages/VideoDatePage.tsx:264` - `if (!consumeVideoDate())` blocks booking even when the server would allow it (drift => false rejections); after local consumption, the handler calls `void serverCreateVideoDate(...)` **without awaiting success and without refunding the local unit on failure** (toast-only error).
- Interests: `src/features/favorites/FavoritesContext.tsx:306` consumes local quota, then `:321` fires `void serverSendInterest(...)` regardless of server outcome (failures only console.warn).

Net effect: users silently charged locally while the durable record never lands, or blocked despite remaining server quota. Any cross-device usage desyncs permanently. Data-integrity/billing-supportability defect even though hard money math stays server-side.

---

## HIGH

### H-1. Admin authorization derives from the stale JSON store, not Postgres
- `sessionMiddleware` attaches admin flags from the **users.json mirror**: `server/src/index.mjs:218-220` (`req.isAdmin = Boolean(u.isAdmin) || Boolean(u.isRootAdmin)` with `u = users[parsed.userId]`).
- The DB copy (`app_users.is_admin/is_root_admin`) is written (promote/demote index.mjs:1508/1522, boot seeding :1679) but **never read back** - there is no SELECT of these columns anywhere in the server.
- Suspension alone is checked live; role checks come from the same file that must stay perfectly in sync per-instance. A DB-promoted admin on a fresh replica has no powers; a demoted one keeps them until restart if JSON lags. Authorization source of truth is split.

### H-2. Auth store lives outside the database: no replication, race-prone, two systems of record
Register/login/session-validation/verification/reset all read/write the **JSON file** even when DATABASE_URL is set:
- lookup-by-email array scans: index.mjs:620,703,748; user create+persist :640-656.
In production the same email exists twice in two stores (`app_users` mirror + users.json). Password reset updates both, but profile updates via PUT /api/me/profile update **only Postgres**, so mirrors drift. Nothing enforces single-writer (any second replica shares nothing - sessions/token versions all in-memory). Backups of one store miss PII in the other.

### H-3. Entitlement downgrade semantics duplicated with divergent guards (webhook vs admin refund)
The JSON entitlements mirror-update is hand-rolled in three places (webhook capture block, verify-payment block, redeem). Concrete divergence already present: webhook-driven refunds downgrade the mirror to basic unconditionally when applied, while the admin-refund path downgrades only `if (!current || rank(current.sku) > rank("basic"))`. Same invariant, opposite guards, depending on which surface delivered the refund.

### H-4. Frontend dependency audit fails CI: 8 high advisories in prod paths
- `npm audit --omit=dev` (frontend): **10 vulnerabilities (2 moderate, 8 high)**, exit 1. Includes `@remix-run/router <=1.23.2` React Router open-redirect/XSS advisories (GHSA-2w69-qvjg-hvjx, GHSA-2j2x-hqr9-3h42) reachable via `<Navigate>`/redirect handling, plus ReDoS families (brace-expansion, @eslint/plugin-kit, ajv, yaml).
- CI (`ci.yml`) runs `npm audit --audit-level=high` => currently red. Lockfile needs `npm audit fix` + react-router-dom upgrade + regression pass.

### H-5. Grant-window semantics differ between verify-first and webhook-first payment flows
DB grant inside `domain.recordCapturedPayment` extends equal-rank windows via GREATEST(existing_end, now)+days; the JSON entitlements mirror (redeem path) overwrites activatedAt/paymentId without any window concept. Depending on which path finalizes (browser redeems vs webhook-first vs verify-first), the same purchase produces different effective expiry behavior. Money-relevant divergence.

### H-6. Contact reveal falls back to charging/showing demo data whenever the server errors non-quota
`src/pages/PublicProfilePage.tsx:131+` (handleOpenContact): any non-ok, non-limit error (network hiccup, 500) "falls through to the demo path", where `consumeContactView()` decrements local quota and the modal shows `doctor.phone/email` from whatever the Doctor object carries (fake contacts in demo, empty in prod). Users charged for failed reveals; silent-failure UX violates the app's own audit bar (comment: "a paid view must never be burned on an empty profile").

---

## MEDIUM

### M-1. Client plan model disagrees with server SKUs and timezone
Server sells `premium-annual`/`platinum-annual`; grants are time-boxed against IST period (`db.mjs istPeriod`). `usePlan.ts` hardcodes quotas for `basic|premium|platinum` and computes month keys from the **client's local month** (`usePlan.ts:30`). Near month boundaries or for annual buyers the two systems disagree; components render contradictory copy. Consolidate on `/api/quota` as single source when wired.

### M-2. Paid activation token lives only in sessionStorage between verification and redemption
`checkout.ts` CHECKOUT_TOKEN_KEY in sessionStorage; tab close/crash drops the paid token. Webhook backstop records captures server-side (smoke-db validates), so money is safe, but user-visible recovery is a toast telling them to contact support instead of re-fetching entitlement from `/api/quota`.

### M-3. Prod builds persist empty-URL recording rows for completed calls
`videoStore.ensureRecording` still `saveRecording(created)` with `url:""` in production builds - pollutes storage and renders RecordingPlayer with an empty media element rather than honestly showing "no recording".

### M-4. `listAdminUsers` fans out rows when a user holds multiple subscriptions
LEFT JOIN subscriptions (PK `(user_id,sku)` admits membership+consultation) + profiles without dedup - such users appear twice in the admin console. Misleads ops counts.

### M-5. Missing webhook secret behavior inconsistent with fail-closed boot matrix
Unset RAZORPAY_WEBHOOK_SECRET => boot only warns; webhook endpoint 503s forever while verify-time grants continue. Everything else hard-fails at boot in prod; this silently loses webhook-based downgrades/refunds. Pick one policy explicitly.

### M-6. Registration accepts arbitrary 120-char specialty/degree strings with no normalization into app_users + admin console display
React escaping prevents XSS; impact limited to data pollution/display (low-medium).

### M-7. Chat opening requires locally cached matched status before consulting the server
`Chat.tsx:161` `if (!canMessage(doctorId) || !hasServerSession()) return;` - post-login hydration failure or cross-device login leaves genuinely matched users unable to open chats (same class as C-3: local cache treated as authority).

### M-8. Quota response shapes disagree (`left:null` unlimited server-side vs Infinity client-side; sku strings like premium-annual unhandled) - folded into M-1 remedy.

### M-9. `favorites` and `shortlists` tables exist with FKs but zero domain references
Favorites UI persists purely in localStorage (`mm:favorites`). Wired users lose favorites across devices, contradicting DEPLOYMENT.md's Postgres-persistence claim. Wire the tables or remove them deliberately.

---

## LOW

- L-1. `/health` advertises razorpayConfigured/simulatePayments/webhookConfigured publicly - minor fingerprinting aid (record counts correctly removed).
- L-2. ESLint flat config covers only ts/tsx; server mjs relies on CI `node --check` (present). Acceptable compensating control.
- L-3. Zero-byte `$null` junk file at repo root (untracked) - cleanup.
- L-4. `trust proxy=true` + IP-bucket limiter: spoofable X-Forwarded-For defeats rate limiting when directly exposed; documented front-with-real-limiter assumption belongs on the deploy checklist.
- L-5. `senderName.replace(/^Dr\.\s*/i, "Dr. ")` no-op transform in interest notification insert - dead code scent.
- L-6. Invoice seq tmp+rename lacks fsync - crash may roll back GST counter; make durability expectation explicit or add fsync.

---

## Checked and CORRECT (do not worry about these)

Money & payments core: amounts validated against strict server catalog per-SKU whitelist (`catalogAllows`); verify-payment binds order->sku via liveOrders/payment_orders (replay of cheap-payment-for-expensive-plan blocked; regression-tested: "forged order_sim id does NOT verify"); GST invoice math integer-paise exact-sum (smoke asserts); sequential IST-dated invoice numbers persisted across restarts; webhook HMAC-SHA256 timingSafeEqual over RAW body; webhook idempotency table + redelivery tested; refunds keyed by refundId with terminal state.

AuthN lifecycle: scrypt + per-user salt + timingSafeEqual everywhere; no account enumeration across register/login/forgot (generic messages, identical statuses, latency-equalized scrypt on miss); activation tokens single-use hashed with bounded LRU memory; session tokens versioned (password events bump tokenVersion => instant global revocation, smoke verifies pre-reset tokens die); suspension enforced centrally in sessionMiddleware with immediate SSE kick.

Data-plane access control: every query scoped by authenticated viewer (browse excludes self + both block directions; channels/messages/interests/video-dates/notifications key on req.user.id); ILIKE metacharacter escaping present; parameterized SQL throughout - zero injection sinks; RLS deny-all on all tables incl. redeemed_tokens; public profile column list strips phone/email; contact reveal is sole egress, metered server-side, honest no-charge-on-empty; hidden profiles excluded from browse.

Frontend hygiene: no dangerouslySetInnerHTML/innerHTML/eval sinks in app code (test assertions only); sign-out purges all mm:* keys + checkout sessionStorage and broadcasts; Matches shows empty state, never fake doctors, when wired fetch fails (M18 fix); StrictMode-safe exactly-once checkout-param redemption with no fake success toasts (L6 fix); photo uploads MIME-whitelisted + size-capped; dev-auth bypass statically compiled out via import.meta.env.DEV.

Ops: fail-closed production boot (Razorpay keys, https APP_URL, ACTIVATION_SECRET, DATABASE_URL, RESEND_API_KEY individually enforced); migration runner takes advisory lock + schema_version row; pool statement/query timeouts; SSE hub bounds connections per user + backpressure drop + heartbeat; structured JSON request logs; central error handler suppresses stacks; TLS verification ON for remote PG; rate-limiter memory bounded, idle-pruned, no bulk-clear; per-recipient email throttle with identical responses (M8 fix); every admin mutation audit-logged.

Gates that ran green this turn: tsc 0 errors; eslint clean; vitest 177/177; vite build success; server syntax checks 7/7; JSON-mode smoke 34/34; server prod-deps audit 0 vulns.

---

## Recommended fix order (smallest-change / biggest-risk-reduction first)

1. **C-1** - middleware wrapper for `rateLimited` (~20 sites) => revives every write API and makes smoke-db runnable. Verify with live probe + smoke-db.
2. **C-2** - commit the working tree (backend, CI, wired frontend, tests). Nothing else is reviewable until the repo contains itself.
3. **H-4** - npm audit fix + react-router-dom patch upgrade; rerun vitest/build.
4. **C-3 / M-7 / H-6** - make the server call the awaited single authority in mutating flows (consume local ledger only on success, or drop local ledgers in wired mode); unify contact-reveal failures to never charge / never show demo contacts.
5. **H-1 / H-2** - read admin flags from app_users in sessionMiddleware; shrink users.json to a disposable dev shim behind small accessor functions.
6. **H-3 / H-5** - collapse the three entitlement-mirror sites into one helper owning rank/window semantics; redeem consults the DB subscription as source of truth.
7. Remainder: M-1/M-8 quota consolidation (folded into #4), M-4 dedup, M-9 favorites decision, M-2 recovery UX, M-3/M-5/M-6/L-* cleanup.
