# Supabase migration set — ARCHIVED, NOT WIRED

> ## ⛔ DO NOT RUN THESE FILES AGAINST ANY DATABASE
>
> These SQL files describe an **earlier, abandoned** Supabase-Auth-based
> design. They are kept only as a written reference. Applying them to the
> live database would:
>
> * create a **parallel schema** with different table names
>   (`membership_plans` vs `plans`, `conversations` vs `channels`,
>   `auth.users` vs `app_users`) — and because the live schema is created
>   with `CREATE TABLE IF NOT EXISTS`, the conflicting shapes would NOT
>   error, they would silently coexist;
> * install ~24 Row Level Security policies keyed on `auth.uid()`, plus a
>   `SECURITY DEFINER` `send_matrimonial_interest` RPC — which would expose
>   the tables to direct authenticated access and **bypass every quota
>   check** in `server/src/domain.mjs`;
> * add triggers and enum types the live schema does not use.
>
> Every file in this directory now begins with a `RAISE EXCEPTION` guard, so
> running any of them aborts immediately. The guard must be removed
> deliberately, in a reviewed change, before the set is ever applied.

## What actually runs

The live schema is **`server/migrations/schema.sql`** — a single idempotent
DDL file applied at boot by `migrate()` in `server/src/db.mjs`, behind a
Postgres advisory lock so concurrent replicas cannot race it.

| | This folder (archived) | The live schema |
|---|---|---|
| Auth model | Supabase Auth (`auth.users`, `auth.uid()`) | Email + password in `app_users` (`server/src/index.mjs`) |
| Profiles key | `profiles.user_id UUID → auth.users` | `profiles.user_id TEXT → app_users` |
| Plans | `membership_plans` + `plan_tier_enum` | `plans` (`TEXT` sku + `rank`) |
| Chat | `conversations` | `channels` (`user_a` / `user_b`) |
| Money unit | `amount_inr INT` (rupees) | `amount_paise INT` (paise) |
| Quotas | one row per user, `*_total` columns | one row per `(user_id, period)`, `*_used` columns |
| RLS | ~24 policies + a SECURITY DEFINER RPC | deny-all on every table (service-role only) |
| Migrations run by | never | `server/src/db.mjs` → `migrate()` at boot |

## File index (archived names)

| File | Module | Description |
| :--- | :--- | :--- |
| `20260815000001_initial_schema.sql` | Core Doctor Profiles | Profiles, medical degrees, specialties, hospital, MCI/NMC verification, photo galleries, kundali attributes. |
| `20260815000002_interactions_and_matching.sql` | Matrimonial Interactions | Favorites, shortlists, proposals with accept/decline, chat channels, messages, video dates. |
| `20260815000003_moderation_and_safety.sql` | Trust & Moderation | Reports with violation categories, blocks, safety audit logs. |
| `20260815000004_plans_quotas_and_billing.sql` | Plans & Quota Management | Membership tiers, subscriptions, quota tracking, payment transaction logs. |
| `20260815000005_events_and_notifications.sql` | Events & In-App Alerts | Meetups, registrations, notification queues. |
| `20260815000006_rls_security_and_functions.sql` | Security & Procedures | RLS policies, auth-signup triggers, timestamp triggers, the quota-enforcing RPC. |
| `20260815000007_seed_data.sql` | Doctor Seed Data | Sample doctor profiles. |

## If you are reviving this design

Do not apply these files as-is. Instead, port the *ideas* into
`server/migrations/schema.sql` (which is additive and idempotent), keep the
deny-all RLS posture, and express quotas as server-side conditional
`UPDATE`s — the live quota enforcement lives in `consumeQuotaTx()` in
`server/src/domain.mjs`, not in the database.
