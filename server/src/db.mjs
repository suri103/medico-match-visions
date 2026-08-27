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
    const wantSsl =
      process.env.PGSSLMODE !== "disable" &&
      (isRemoteHost() || /sslmode=require/.test(DATABASE_URL));
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
    // Advisory lock (namespace) held for the duration of the migration run.
    await client.query("SELECT pg_advisory_lock(791234567)");
    try {
      const sql = fs.readFileSync(path.join(__dirname, "..", "migrations", "schema.sql"), "utf8");
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
    } finally {
      await client.query("SELECT pg_advisory_unlock(791234567)");
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

/** 'YYYY-MM' business period in India's timezone. */
export function istPeriod(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
  }).format(date);
}
