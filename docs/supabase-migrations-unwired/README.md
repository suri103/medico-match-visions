# MedicoMatch Supabase Backend Architecture & Migrations

> ⚠️ **NOT WIRED — REFERENCE ONLY.** No runtime code executes these files.
> The shipped backend is `server/` (Express + JSON stores) and the SPA keeps
> profiles/matches/chats in localStorage. This folder is kept purely as a
> schema reference for the future server-backed implementation. Do not run it
> against a production database and do not present it as the live backend.

Complete, production-ready PostgreSQL and Supabase migration suite for **MedicoMatch** — the exclusive matrimony platform for doctors and healthcare professionals.

---

## 📁 Migration Structure

| File | Module | Description |
| :--- | :--- | :--- |
| **`001_initial_schema.sql`** | Core Doctor Profiles | Profiles, medical degrees (`MBBS`, `MD`, `MS`, `DM`), specialties, hospital, MCI/NMC verification status, multi-photo galleries, Kundali attributes (`Rashi`, `Nakshatra`, `Manglik`), lifestyle, and partner preferences. |
| **`002_interactions_and_matching.sql`** | Matrimonial Interactions | Favorites (Star ⭐), Shortlists (Bookmark 🔖), Matrimonial Interests (Proposals with accept/decline workflows), 1-on-1 Chat channels, messages, and Video Dates scheduling. |
| **`003_moderation_and_safety.sql`** | Trust & Moderation | Doctor reports with violation categories (fake MCI credentials, harassment, spam, impersonation), blocked doctor relationships, and safety audit logs. |
| **`004_plans_quotas_and_billing.sql`** | Plans & Quota Management | Membership tiers (`Free`, `Gold`, `Platinum`), active subscriptions, live quota tracking (video date tokens, direct contacts, monthly interests), and payment transaction logs. |
| **`005_events_and_notifications.sql`** | Events & In-App Alerts | Doctor speed dating meets, city networking mixers, event attendance registrations, and real-time user notification queues. |
| **`006_rls_security_and_functions.sql`** | Security & Procedures | Row Level Security (RLS) policies for all tables, automated profile & quota creation on `auth.users` signup, timestamp triggers, and atomic `send_matrimonial_interest` RPC. |
| **`007_seed_data.sql`** | Doctor Seed Data | Realistic verified doctor profiles across major medical specialties (Cardiology, Neurology, Pediatrics, Dermatology, Surgery, Radiology, Orthopedics, Gynecology) with full biodata. |

---

## 🚀 How to Run Migrations

### Option A: Via Supabase CLI (Recommended)
```bash
# 1. Login to your Supabase account
supabase login

# 2. Link your remote Supabase project
supabase link --project-ref your-project-ref

# 3. Push migrations to Supabase database
supabase db push
```

### Option B: Via Supabase Web Dashboard (SQL Editor)
1. Open your [Supabase Dashboard](https://app.supabase.com).
2. Go to **SQL Editor**.
3. Run the files sequentially from `001_initial_schema.sql` to `007_seed_data.sql`.

---

## ⚙️ Environment Configuration

> **Note:** The frontend Supabase client (`src/lib/supabase.ts`) and the
> `VITE_SUPABASE_*` env typings were intentionally removed pre-launch because no
> runtime integration existed yet. When you connect the app to a real Supabase
> project, re-add `@supabase/supabase-js`, recreate the client, and restore the
> env types in `src/vite-env.d.ts`.

Add the following environment variables to your `.env` file at that point:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```
