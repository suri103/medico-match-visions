# MedicoMatch

Exclusive matrimony platform for doctors and healthcare professionals (India).

## Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind/shadcn (`src/`)
- **Backend**: single Express process (`server/`) — email/password auth with
  scrypt, Razorpay orders + signature verification, single-use entitlement
  tokens, GST invoices. Persistence is Postgres (`DATABASE_URL`): profiles,
  quotas, interests, chat, video dates, billing. The JSON files in
  `server/data/` are the dev/test fallback only — production requires a
  database (the boot refuses to start without one).
- **Payments**: Razorpay (UPI / Cards / NetBanking). The KEY SECRET only ever
  lives on the server; plans activate exclusively by redeeming a server-issued
  token after signature verification.

> **Status note**: the social surface (profiles, matches, interests, chat,
> video dates) is server-backed in DB mode. Demo fixtures exist for local runs
> and are marked `is_sample` (hidden from browse) — set
> `SEED_SAMPLE_DATA=false` to remove them from the database entirely.

## Development

```sh
npm install
npm run dev                               # frontend on :8080
cd server && npm install && npm run dev   # API on :3001
```

## Tests & gates

```sh
npm run lint
npx tsc -p tsconfig.app.json --noEmit
npx tsc -p tsconfig.node.json --noEmit
npx vitest run
npm run build

cd server && npm test     # end-to-end smoke test (auth, payments, invoices)
```

## Environment variables

Copy `.env.example` values into `.env`. All frontend vars are optional in dev.

| Variable | Purpose | Required for |
| --- | --- | --- |
| `VITE_API_BASE_URL` | URL of your backend (holds the Razorpay key secret) | Payments / real sign-in |
| `VITE_RAZORPAY_KEY_ID` | Razorpay publishable key | Live payments |
| `VITE_DEV_SKIP_AUTH` | `true` skips login on protected pages (**dev builds only** — statically eliminated from prod builds) | Local development |
| `VITE_SUPPORT_EMAIL` | Support inbox shown on the Help page | Ops |

Server-side variables and boot requirements are documented in
[`DEPLOYMENT.md`](./DEPLOYMENT.md) and [`server/README.md`](./server/README.md).

## Payments flow (security-relevant)

1. Frontend asks the server to create an order for a catalog `sku`; the server
   owns pricing.
2. Razorpay Checkout collects payment; the signature is verified server-side
   against the order **this server issued for that sku**.
3. A single-use activation token is minted; the plan activates ONLY when it is
   redeemed against a signed-in account. A `?checkout=success` URL alone
   grants nothing.

Never expose `RAZORPAY_KEY_SECRET` in the frontend bundle.
