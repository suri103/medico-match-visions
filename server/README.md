# MedicoMatch Razorpay Server

Small Express server that creates Razorpay orders, verifies payment
signatures, and issues single-use entitlement tokens for the MedicoMatch
frontend. It exists so the **Razorpay key secret never ships in the frontend
bundle** and so plan activation is only ever granted for a server-verified
payment.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Liveness only — `{ok:true}` (no config fingerprint on the public wire) |
| POST | `/api/auth/register` | Create an account (email verification flow; generic responses) |
| POST | `/api/auth/login` | Password sign-in (scrypt, timing-equalized) |
| POST | `/api/auth/verify-email` | Consume an emailed verification link → session |
| POST | `/api/auth/forgot-password` | Request a password-reset link (generic response — no enumeration) |
| POST | `/api/auth/reset-password` | Consume a reset link, set a new password, invalidate existing sessions |
| POST | `/api/auth/change-password` | Authenticated password change (requires current password; invalidates all sessions) |
| GET | `/api/auth/me` | Validate the session; returns the user + server-side active plan |
| POST | `/api/razorpay/create-order` | Create a Razorpay order (validates `sku` + `amount` against the server-side price catalog) |
| POST | `/api/razorpay/verify-payment` | Verify the Razorpay HMAC signature; mints a single-use activation token |
| POST | `/api/razorpay/redeem` | Redeem an activation token (single-use) → `{ plan }` |
| POST | `/api/generate-invoice` | GST invoice metadata (requires a valid activation token) |

### Request/response examples

Create an order:

```sh
curl -X POST http://localhost:3001/api/razorpay/create-order \
  -H 'Content-Type: application/json' \
  -d '{"sku":"premium","amount":1499}'
# -> { "id":"order_...", "amount":149900, "currency":"INR", ... }
```

Verify (frontend sends the Razorpay checkout response plus the sku):

```sh
curl -X POST http://localhost:3001/api/razorpay/verify-payment \
  -H 'Content-Type: application/json' \
  -d '{"razorpay_order_id":"order_...","razorpay_payment_id":"pay_...","razorpay_signature":"...","sku":"premium"}'
# -> { "verified":true, "activation":{ "token":"...", "sku":"premium","expiresAt":... } }
```

Redeem (activates the plan):

```sh
curl -X POST http://localhost:3001/api/razorpay/redeem \
  -H 'Content-Type: application/json' \
  -d '{"token":"..."}'
# -> { "plan":"premium" }   (409 if the token was already used)
```

| POST | `/api/webhooks/razorpay` | Razorpay webhook (HMAC-verified, idempotent) — grants subscriptions on `payment.captured`, revokes on `refund.processed` |
| GET | `/api/events` | **SSE realtime stream** (single-use ticket auth; pushes `message` / `interest_received` / `interest_responded` / `video_date`) |
| POST | `/api/events/ticket` | Exchange a session for a 60s single-use stream ticket |
| POST | `/api/billing/cancel` `/api/billing/resume` | Self-service cancel-at-period-end / resume (paid access window preserved) |
| GET/PUT | `/api/me/profile` | Own matrimonial profile (DB-backed) |
| GET | `/api/profiles` | Browse profiles (contact fields always stripped server-side) |
| GET/POST | `/api/interests`, `/api/interests/:id/respond`, DELETE `/api/interests/:id` | Proposals with DB state machine + **server-enforced** monthly quotas |
| GET/POST | `/api/channels/:id/messages` | Chat between accepted mutual interests |
| GET/POST | `/api/video-dates`, `/api/video-dates/:id/cancel` | Video dates with server quota + refund-on-cancel |
| POST | `/api/contact-reveal` | The ONLY source of phone/email — metered by the contact-view quota |
| GET/POST | `/api/blocks`, `/api/reports` | Safety (blocks are enforced in browse + interests) |
| `/api/admin/*` | — | Moderation console APIs: reports resolution, user suspension (root-only for admins), profile verify/hide, payments list, refunds, admin roster promote/demote (root-only) |

> **Database mode**: set `DATABASE_URL` and the server executes
> `server/migrations/schema.sql` at boot (idempotent) — profiles, interests,
> chat, video dates, quotas and billing become durable. Without it the server
> runs the legacy JSON-store mode for auth/payments only; production requires
> the database (fail-closed boot). Run `TEST_DATABASE_URL=... node tests/smoke-db.mjs`
> for the wired-backend end-to-end suite.

## Security properties

- The amount is validated against a server-side price catalog — a tampered
  client cannot buy a plan for ₹1.
- In simulation mode, only order ids **issued by this process** verify; a
  client-supplied `order_sim_*` string is rejected.
- Simulation requires `RAZORPAY_SIMULATE=true` AND is refused entirely in
  production (the server exits at boot if keys are missing or simulation is on).
- Production boot also **requires** `APP_URL` (https) and `ACTIVATION_SECRET`.
- Activation tokens are HMAC-signed, expire in 15 minutes, and are single-use.
- Sessions are HMAC-signed `uid.exp.tokenVersion` tokens; password
  change/reset bumps `tokenVersion` and instantly invalidates every session
  for that account.
- POST endpoints are rate limited (30 req/min/IP, proxy-aware); outbound
  verification/reset emails are additionally throttled per recipient
  (3 per 15 min) with responses kept identical to prevent enumeration.
- GST invoices use sequential numbers persisted in `invoice_seq.json` and are
  dated in Asia/Kolkata.

## Run locally

```sh
cd server
npm install
cp .env.example .env   # RAZORPAY_SIMULATE=true by default for local dev
npm run dev            # starts on :3001
```

Verify it's up:

```sh
curl http://localhost:3001/health
# -> {"ok":true}
```

## Frontend wiring

- Set `VITE_API_BASE_URL` (frontend) to this server, e.g. `http://localhost:3001`.
- Set `VITE_RAZORPAY_KEY_ID` to the publishable key to enable live checkout.
- After a verified payment the frontend redeems the activation token and only
  then activates the purchased plan. The `?checkout=success` URL parameter
  alone never grants anything.

## Production notes

- Set `NODE_ENV=production`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`,
  `APP_URL` (allowed CORS origin), and optionally `CORS_ORIGINS` (comma
  separated) and `ACTIVATION_SECRET`.
- Token redemption is durable in Postgres (`redeemed_tokens`, `used_email_tokens`,
  `webhook_events`) in DB mode — multi-replica safe with no Redis. The in-memory
  Set is only the no-DB dev fallback. Production requires `DATABASE_URL`
  (fail-closed boot) plus `RESEND_API_KEY`, `RAZORPAY_WEBHOOK_SECRET`, and must
  leave `DISABLE_POW`/`DISABLE_DIGEST` unset.
