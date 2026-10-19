// Postgres access (Supabase-compatible). When DATABASE_URL is set, the server
// runs in DB mode: schema.sql is executed at boot (idempotent) and all social
// + billing state lives in Postgres. Without DATABASE_URL (local dev / smoke
// tests) the server runs in legacy JSON-store mode — production REQUIRES a
// database (fail-closed boot check in index.mjs).
import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const DATABASE_URL = process.env.DATABASE_URL || "";
export const dbEnabled = Boolean(DATABASE_URL);

let pool = null;

/** True when DATABASE_URL targets a non-loopback host (needs TLS). */
function isRemoteHost() {
  try {
    const host = new URL(DATABASE_URL).hostname;
    return Boolean(host) && !/^(localhost|127\.0\.0\.1|::1|\[::1\])$/.test(host);
  } catch {
    return false;
  }
}

export function getPool() {
  if (!pool) {
    // Audit H2: TLS certificate validation is ON for every remote host
    // (rejectUnauthorized default true) so an on-path MITM cannot capture
    // service-role credentials or PII. Supabase/Railway/Fly all serve
    // publicly-trusted certs, so strict verification succeeds out of the box.
    // PGSSLMODE=no-verify explicitly opts out (insecure — for proxies that
    // terminate TLS with self-signed certs only); PGSSLMODE=disable turns it off.
    // NOTE: some Railway egress paths hit a Supavisor hop whose chain the Node
    // trust store rejects ("self-signed certificate in certificate chain").
    // In that case the ONLY supported fallback is PGSSLMODE=no-verify, and it
    // must be understood as transport-encryption-only: it stops passive
    // sniffing but no longer authenticates the server.
    const wantSsl =
      process.env.PGSSLMODE !== "disable" &&
      (isRemoteHost() || /sslmode=require/.test(DATABASE_URL));
    const insecure = process.env.PGSSLMODE === "no-verify";
    if (insecure) {
      console.warn(
        JSON.stringify({
          level: "warn",
          msg: "tls_verification_disabled",
          hint: "PGSSLMODE=no-verify: transport is encrypted but the server is NOT authenticated. Fix the chain (proper pooler cert) instead of living on this.",
        })
      );
    }
    pool = new pg.Pool({
      connectionString: DATABASE_URL,
      // Supabase pooler-friendly defaults; small on purpose (single process).
      max: 10,
      idleTimeoutMillis: 30_000,
      // Audit L3: timeouts so a handful of stuck requests can never wedge the
      // pool and stall the whole app.
      connectionTimeoutMillis: 10_000,
      statement_timeout: 20_000,
      query_timeout: 25_000,
      idle_in_transaction_session_timeout: 30_000,
      ...(wantSsl
        ? { ssl: { rejectUnauthorized: process.env.PGSSLMODE !== "no-verify" } }
        : {}),
    });
    // An IDLE pooled client erroring (Supabase/Supavisor recycling a socket,
    // network reset, server restart) is emitted on the Pool, not on a client
    // we hold a reference to. node-postgres already discards the dead client
    // and the pool recovers — but an EventEmitter 'error' with no listener is
    // an uncaught exception that exits the process, taking every in-flight
    // request and the webhook path with it.
    pool.on("error", (err) => {
      console.error(
        JSON.stringify({ level: "error", msg: "pg_pool_idle_client_error", error: String(err) })
      );
    });
  }
  return pool;
}

/** Run migrations/schema.sql (idempotent DDL + seed). Audit M4: the boot-time
 * migration runner now takes a Postgres advisory lock keyed to this schema and
 * records a schema_version row, so concurrent boots across a replica fleet
 * cannot race the DDL into each other (previously a boot-flap loop). The whole
 * file runs inside one transaction — Postgres DDL is transactional — and an
 * additive-only style keeps it re-runnable. */
export async function migrate() {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    // Audit H11: schema.sql is sent as ONE statement, so the pool's 20s
    // statement_timeout used to apply to the entire batch — including the wait
    // for another replica's in-flight migration — and a slow-but-healthy run
    // could fail the boot. Give the migration its own budget.
    await client.query("SET LOCAL statement_timeout = '180s'");
    // Transaction-scoped advisory lock (audit H11): COMMIT/ROLLBACK releases it.
    // The previous explicit pg_advisory_unlock() ran in a `finally` BEFORE the
    // COMMIT, so a second replica could start migrating against pre-commit
    // catalog state and race the DROP/ALTER blocks below.
    await client.query("SELECT pg_advisory_xact_lock(791234567)");
    {
      let sql = fs.readFileSync(path.join(__dirname, "..", "migrations", "schema.sql"), "utf8");
      // SEED_SAMPLE_DATA=false: the fabricated fixtures (17 sample doctor
      // profiles + 4 organiser-less events) are DROPPED from the DDL so a fresh
      // database never receives them, and any rows seeded by an earlier boot are
      // purged below. Plans and coupons are NOT fixtures — they stay (they are
      // real pricing config, not deceptive content).
      const suppressFixtures = process.env.SEED_SAMPLE_DATA === "false";
      if (suppressFixtures) {
        sql = sql.replace(
          /-- @seed-sample-data:start[\s\S]*?-- @seed-sample-data:end[^\n]*/g,
          "-- (sample-data seed suppressed: SEED_SAMPLE_DATA=false)"
        );
      }
      await client.query(
        `CREATE TABLE IF NOT EXISTS schema_version (
           version INT PRIMARY KEY,
           applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
         )`
      );
      await client.query(sql);
      await client.query(
        `INSERT INTO schema_version (version) VALUES (1) ON CONFLICT (version) DO NOTHING`
      );
      if (suppressFixtures) {
        // Purge fixtures left by an earlier boot. Dependents (favorites,
        // shortlists, contact_views, profile_views, profile_photos,
        // kundali_reports, video_dates.other_profile_id) are ON DELETE CASCADE,
        // so no orphans remain. Events are matched by their seeded ids AND a
        // NULL organiser so a real member's event can never be swept up.
        const profiles = await client.query("DELETE FROM profiles WHERE is_sample = TRUE");
        const events = await client.query(
          `DELETE FROM events WHERE created_by IS NULL AND id IN ('e1','e2','e3','e4')`
        );
        if (profiles.rowCount > 0 || events.rowCount > 0) {
          console.log(
            JSON.stringify({
              level: "info",
              msg: "sample_data_purged",
              profiles: profiles.rowCount,
              events: events.rowCount,
            })
          );
        }
      }
    }
    await client.query("COMMIT");
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* connection already broken */
    }
    throw err;
  } finally {
    client.release();
  }
}

export function query(text, params) {
  return getPool().query(text, params);
}

/** Run fn(client) inside a transaction; rolls back on throw. */
export async function withTx(fn) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* connection already broken */
    }
    throw err;
  } finally {
    client.release();
  }
}

/** 'YYYY-MM' business period in India's timezone (locale/small-icu safe). */
export function istPeriod(date = new Date()) {
  const d = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(d);
  const year = parts.find((p) => p.type === "year")?.value || String(d.getUTCFullYear());
  const month = parts.find((p) => p.type === "month")?.value || String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}
