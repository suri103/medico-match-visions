import "dotenv/config";
import express from "express";
import cors from "cors";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { sendEmail } from "./email.mjs";
import { dbEnabled, DATABASE_URL, getPool, migrate, query, withTx } from "./db.mjs";
import { addClient, closeUser as kickSse, publishToUser, initEventsPubSub, connectionCount } from "./events.mjs";
import * as domain from "./domain.mjs";

/**
 * Fire-and-forget email with an EXPLICIT error log.
 *
 * Audit M-2: `sendEmail` now rejects when delivery fails (it used to swallow
 * every error, which made the callers' try/catch blocks dead code). These
 * call sites deliberately do not block the HTTP response — a member's
 * password was changed whether or not the notice email arrived — but the
 * rejection must be handled rather than surfacing as an unhandled rejection
 * that the process-level handler has to absorb.
 */
const sendEmailInBackground = (args) => {
  void sendEmail(args).catch((err) => {
    console.error(
      JSON.stringify({
        level: "error",
        msg: "email_send_failed",
        subject: args?.subject || "",
        error: String(err),
      })
    );
  });
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Behind Railway/Fly/Nginx-style proxies, req.ip must be taken from
// X-Forwarded-For — otherwise the rate limiter buckets EVERY visitor under the
// proxy's IP and legitimate users get 429s in production (audit H6).
// Audit H1: `true` trusts EVERY hop, so a client-supplied X-Forwarded-For is
// used verbatim as the rate-limit bucket key — one forged header per request
// defeats the whole per-IP limiter (login brute force, PoW-challenge flooding).
// Trust exactly the hops we own; raise TRUST_PROXY_HOPS if another proxy is
// ever added in front of the platform edge.
app.set("trust proxy", Math.max(1, Number(process.env.TRUST_PROXY_HOPS) || 1));

// Minimal hardening headers Express can own. HSTS/TLS termination belongs to
// the reverse proxy / hosting layer.
//
// Content-Security-Policy (audit M-5): pin scripts to our bundle + Razorpay's
// hosted checkout, allow images from the seeded sample avatar host and data:
// URIs (for inline profile photos), and forbid framing entirely. The
// checkout.razorpay.com frame is intentionally allowed so Razorpay's iframe
// modal can mount.
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(self), microphone=(self), geolocation=()",
  "Content-Security-Policy": [
    "default-src 'self'",
    "img-src 'self' data: https://randomuser.me https://*.supabase.co",
    "script-src 'self' https://checkout.razorpay.com",
    // Razorpay's checkout uses an iframe to mount its modal — allow only that host.
    "frame-src https://checkout.razorpay.com",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "connect-src 'self' https://api.razorpay.com",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; "),
  // Item 2: ship a parallel Report-Only header so we can SEE violations
  // without breaking the app, then tighten the enforced policy once the
  // violation list is clean. Browsers POST violation reports to
  // /api/csp-report which we log for the security team to review.
  "Content-Security-Policy-Report-Only": [
    "default-src 'self'",
    "img-src 'self' data: https://randomuser.me https://*.supabase.co",
    "script-src 'self' https://checkout.razorpay.com",
    "frame-src https://checkout.razorpay.com",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "connect-src 'self' https://api.razorpay.com",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "report-uri /api/csp-report",
  ].join("; "),
};
app.use((_req, res, next) => {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
  next();
});

// ---------------------------------------------------------------------------
// Process-level safety net (audit X5 / H10). Express 4 does NOT catch rejected
// promises from async handlers and Node exits on an unhandled rejection by
// default, so one transient DB error inside a money path used to take the whole
// API down — including the Razorpay webhook. Rejections are logged and absorbed
// (the request that caused them has already failed on its own); a genuinely
// unknown synchronous fault still exits so the host restarts a clean process.
// ---------------------------------------------------------------------------
process.on("unhandledRejection", (reason) => {
  console.error(
    JSON.stringify({ level: "error", msg: "unhandled_rejection", error: String(reason) })
  );
});
process.on("uncaughtException", (err) => {
  console.error(
    JSON.stringify({
      level: "error",
      msg: "uncaught_exception",
      error: String(err && err.stack ? err.stack : err),
    })
  );
  process.exit(1);
});

// Async route wrapper: one failure boundary for every handler. 5xx never leaks
// a stack or an internal message; app-authored <500 errors (quota, not found,
// validation) still reach the client with their code.
const wrap = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    const status = Number(err.status) || (err.code === "quota" ? 429 : 500);
    if (status >= 500) {
      console.error(JSON.stringify({ level: "error", msg: "api_error", path: req.path, error: String(err) }));
      return res.status(500).json({ error: "Internal server error." });
    }
    res.status(status).json({ error: err.message || "Request failed.", code: err.code });
  }
};

const PORT = process.env.PORT || 3001;
const APP_URL = process.env.APP_URL || "http://localhost:8080";

// Razorpay (India). KEY_ID is publishable; KEY_SECRET must never leave this server.
const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;
const razorpayConfigured = Boolean(razorpayKeyId && razorpayKeySecret);

// Simulation must be requested explicitly AND can never run in production.
const simulatePayments =
  process.env.RAZORPAY_SIMULATE === "true" && process.env.NODE_ENV !== "production";

// Fail closed: in production the server refuses to start unless every secret
// and origin it needs is present. A misconfigured deploy must never serve
// traffic with localhost links, an open CORS default, or simulated payments.
// Since the backend is now the system of record for profiles/quotas/payments,
// a database is MANDATORY in production.
if (process.env.NODE_ENV === "production") {
  const bootErrors = [];
  if (!razorpayConfigured) {
    bootErrors.push("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required in production.");
  }
  // Audit M-43: this check was DEAD CODE. It tested the combined
  // `simulatePayments` flag, which is already `false` whenever
  // NODE_ENV === "production" (see the definition above) — so the branch
  // could never run and a production deploy with RAZORPAY_SIMULATE=true was
  // accepted without complaint. Simulation is harmless in production (the
  // flag is false), but the ENVIRONMENT must still be unambiguous, and the
  // production-boot test matrix now asserts this refusal actually fires.
  if (process.env.RAZORPAY_SIMULATE === "true") {
    bootErrors.push("RAZORPAY_SIMULATE must be unset/false in production.");
  }
  if (!process.env.APP_URL) {
    bootErrors.push(
      "APP_URL is required in production — it defines the allowed CORS origin and the base URL of emailed verification/reset links."
    );
  } else if (!/^https:\/\//i.test(APP_URL)) {
    bootErrors.push("APP_URL must be an https:// origin in production.");
  }
  if (!process.env.ACTIVATION_SECRET) {
    bootErrors.push(
      "ACTIVATION_SECRET is required in production — deriving it from the Razorpay key secret means rotating payment keys silently invalidates every session."
    );
  }
  if (!DATABASE_URL) {
    bootErrors.push(
      "DATABASE_URL is required in production — profiles, quotas, interests and billing are stored in Postgres/Supabase."
    );
  }
  // Audit M11: emails carry verification/reset tokens; without a real transport
  // the server must refuse to start rather than leak them to stdout.
  if (!process.env.RESEND_API_KEY) {
    bootErrors.push("RESEND_API_KEY is required in production — email transport must never fall back to logging tokens.");
  }
  // Audit M-5: webhooks carry refunds and the server-side activation backstop.
  // A deployment without the secret would run "half-billing" (verify-only)
  // while every other misconfiguration hard-fails here - so fail closed too.
  if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
    bootErrors.push("RAZORPAY_WEBHOOK_SECRET is required in production - webhook-based activation and refund handling cannot work without it.");
  }
  // SMS fail-closed: declaring a provider without its key is a misconfig that
  // would silently strand every OTP on the email fallback in production.
  if (process.env.SMS_PROVIDER === "msg91" && !process.env.MSG91_API_KEY) {
    bootErrors.push("SMS_PROVIDER=msg91 requires MSG91_API_KEY in production.");
  }
  // Kill-switches must never be on in production: DISABLE_POW turns off the
  // registration/forgot-password proof-of-work bot gate, DISABLE_DIGEST
  // silences renewal + engagement digests. Both are test-only.
  if (process.env.DISABLE_POW === "true") {
    bootErrors.push("DISABLE_POW must not be set in production — it disables bot protection.");
  }
  if (process.env.DISABLE_DIGEST === "true") {
    bootErrors.push("DISABLE_DIGEST must not be set in production — it silences billing digests.");
  }
  if (bootErrors.length > 0) {
    console.error("Refusing to start:\n  - " + bootErrors.join("\n  - "));
    process.exit(1);
  }
}

// Signs sessions and activation tokens. Required in production (boot-checked
// above); the dev fallback keeps local development friction-free.
//
// Audit X1: the fallback is ONLY safe for an explicitly-local process. The
// previous guard required NODE_ENV to be truthy, so a deploy with NODE_ENV unset
// and no ACTIVATION_SECRET booted with a public literal as the HMAC key for
// every session and email token — anyone could mint a session for any user id
// (and the production boot checks above were skipped in exactly that state).
// Fail closed whenever the process looks like a deployment.
const DEV_ACTIVATION_SECRET = "dev-only-insecure-activation-secret";
const activationSecret =
  process.env.ACTIVATION_SECRET ||
  (razorpayKeySecret ? `razorpay:${razorpayKeySecret}` : DEV_ACTIVATION_SECRET);
const isDevOrTestEnv =
  process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";
// A bare `npm run dev` on a laptop (no NODE_ENV, no DB, no APP_URL, no Razorpay
// keys) keeps the frictionless fallback; anything else must set the secret.
const bareLocalRun =
  !process.env.NODE_ENV && !DATABASE_URL && !process.env.APP_URL && !razorpayKeySecret;
if (!process.env.ACTIVATION_SECRET && !isDevOrTestEnv && !bareLocalRun) {
  console.error(
    `Refusing to start: ACTIVATION_SECRET is required (got NODE_ENV=${process.env.NODE_ENV || "unset"}). It signs every session and email token, so the dev fallback literal must never serve a deployment — set ACTIVATION_SECRET, or run with NODE_ENV=development/test.`
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Session cookie (audit M-12 / item 1 of the launch readiness list):
// The web frontend stores the signed session token in an httpOnly, Secure
// cookie. The Authorization: Bearer path is retained for the mobile app / API
// clients. Same signed token, same verifySessionToken code.
//
// CSRF (item 1 cont.): an httpOnly cookie is auto-sent by the browser, so we
// need an explicit CSRF defense for any non-GET / non-HEAD request. We use the
// "double-submit cookie" pattern: a separate non-httpOnly cookie (or header)
// carrying a random token that the client must echo on every mutating call.
// SameSite is Strict for loopback dev and None in production (the SPA and API
// are split across origins, so Strict cookies would never be attached) — which
// means the double-submit check below is the ONLY cross-site layer in
// production. Do not weaken it.
// ---------------------------------------------------------------------------
const SESSION_COOKIE = "mm_session";
const CSRF_COOKIE = "mm_csrf";
const SESSION_COOKIE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CSRF_COOKIE_TTL_MS = 12 * 60 * 60 * 1000; // 12h — rotate more often than session

const isProductionEnv = process.env.NODE_ENV === "production";
const cookieSecure = isProductionEnv; // Secure flag OFF for loopback dev so curl/test can drive it
// Split-origin deploys (SPA on Vercel, API on Railway) are cross-site from the
// browser's perspective: SameSite=Strict cookies are NEVER attached to those
// fetches, so cookie-first auth silently dies (every /api/* call 401s and the
// SPA falls back to demo content). Production therefore uses SameSite=None,
// which requires the Secure flag (already set above). Local dev keeps Strict —
// frontend and API are both localhost, i.e. same-site, so Strict works there.
const cookieSameSite = isProductionEnv ? "None" : "Strict";

function setSessionCookie(res, token) {
  // C1: res.setHeader("Set-Cookie") REPLACES — login/verify set session + CSRF
  // back-to-back, so the second call dropped the session cookie. append() keeps both.
  res.append(
    "Set-Cookie",
    [
      `${SESSION_COOKIE}=${token}`,
      "Path=/",
      `Max-Age=${Math.floor(SESSION_COOKIE_TTL_MS / 1000)}`,
      "HttpOnly",
      `SameSite=${cookieSameSite}`,
      cookieSecure ? "Secure" : "",
    ]
      .filter(Boolean)
      .join("; ")
  );
}

function clearSessionCookie(res) {
  res.append(
    "Set-Cookie",
    [
      `${SESSION_COOKIE}=`,
      "Path=/",
      "Max-Age=0",
      "HttpOnly",
      `SameSite=${cookieSameSite}`,
      cookieSecure ? "Secure" : "",
    ]
      .filter(Boolean)
      .join("; ")
  );
}

function setCsrfCookie(res, token) {
  res.append(
    "Set-Cookie",
    [
      `${CSRF_COOKIE}=${token}`,
      "Path=/",
      `Max-Age=${Math.floor(CSRF_COOKIE_TTL_MS / 1000)}`,
      // NOT HttpOnly — the JS layer needs to read it to echo on mutating calls.
      `SameSite=${cookieSameSite}`,
      cookieSecure ? "Secure" : "",
    ]
      .filter(Boolean)
      .join("; ")
  );
}

// Issue a fresh CSRF token (32 random bytes, hex). Mounted on every successful
// auth response and on /api/csrf so SPAs can bootstrap one.
const issueCsrfToken = () => crypto.randomBytes(32).toString("hex");

// Read the CSRF cookie off the request (raw header parse — no cookie-parser
// dep needed).
const readCookie = (req, name) => {
  const raw = req.headers.cookie || "";
  for (const part of raw.split(/;\s*/)) {
    const eq = part.indexOf("=");
    if (eq > 0 && part.slice(0, eq) === name) return part.slice(eq + 1);
  }
  return null;
};

// CSRF check: applied to every state-changing method. Skipped when:
//  1. The method is safe (GET/HEAD/OPTIONS).
//  2. The caller authenticates via Authorization: Bearer (mobile / API —
//     browsers don't auto-attach the header, so the request cannot be CSRFed).
//  3. There is no session cookie at all (anonymous endpoint like
//     /api/auth/register or /api/auth/login — a CSRF attack would still
//     succeed without a token, so there's nothing to protect; the request is
//     for a brand-new session, not a privileged operation).
// The double-submit pattern: cookie value must equal either the X-CSRF-Token
// header or the body's csrfToken field.
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const csrfGuard = (req, res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();
  if (/^Bearer /.test(req.headers.authorization || "")) return next();
  const sessionCookie = readCookie(req, SESSION_COOKIE);
  // No session cookie ⇒ not an authenticated browser session ⇒ nothing to
  // CSRF (an unauthenticated POST to /api/auth/register can't act on the
  // victim's behalf because the victim is not signed in).
  if (!sessionCookie) return next();
  const cookieToken = readCookie(req, CSRF_COOKIE);
  if (!cookieToken) {
    return res.status(403).json({ error: "CSRF token missing. Reload the page and try again." });
  }
  const headerToken = req.headers["x-csrf-token"];
  const bodyToken =
    req.body && typeof req.body === "object" ? (req.body.csrfToken || req.body.csrf_token) : null;
  const presented = (typeof headerToken === "string" && headerToken) || bodyToken;
  if (!presented) {
    return res.status(403).json({ error: "CSRF token required." });
  }
  // Constant-time compare to defeat timing oracles.
  const a = Buffer.from(cookieToken);
  const b = Buffer.from(presented);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(403).json({ error: "CSRF token mismatch." });
  }
  next();
};

// ---------------------------------------------------------------------------
// JSON-file stores (server/data/). These are the DEV/TEST fallback only: when
// DATABASE_URL is set the server runs in DB mode and Postgres is the system of
// record for profiles, quotas and billing (production REQUIRES a database —
// see the fail-closed boot checks above). The files below are still written for
// the account mirror / display entitlement, so DATA_DIR must stay writable —
// but they are NOT what you back up in production. Back up Postgres.
// ---------------------------------------------------------------------------
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const ENTITLEMENTS_FILE = path.join(DATA_DIR, "entitlements.json");

const readJson = (file, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
};
const writeJson = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  const fd = fs.openSync(tmp, "w");
  fs.writeFileSync(fd, JSON.stringify(value, null, 2));
  fs.fsyncSync(fd);
  fs.closeSync(fd);
  fs.renameSync(tmp, file);
};

/** @type {Record<string, {id:string,email:string,firstName:string,lastName:string,specialty:string,degree:string,salt:string,hash:string,verified:boolean,tokenVersion:number,createdAt:string}>} */
let users = readJson(USERS_FILE, {});
/** @type {Record<string, {sku:string,activatedAt:string,paymentId:string}>} */ // keyed by user id
let entitlements = readJson(ENTITLEMENTS_FILE, {});

const persistUsers = () => writeJson(USERS_FILE, users);
const persistEntitlements = () => writeJson(ENTITLEMENTS_FILE, entitlements);

// Audit H-6: one-shot backfill for accounts created before email verification /
// session versioning shipped. Persisted on the first boot that finds any
// missing field, then the loop is a no-op for every subsequent boot. Doing it
// after persistUsers is declared and using a persisted flag keeps a
// multi-instance fleet from racing the JSON file.
let legacyBackfilled = false;
for (const user of Object.values(users)) {
  if (user.verified === undefined || user.tokenVersion === undefined) {
    if (user.verified === undefined) user.verified = true;
    if (user.tokenVersion === undefined) user.tokenVersion = 0;
    legacyBackfilled = true;
  }
}
if (legacyBackfilled) {
  persistUsers();
  console.log(JSON.stringify({ level: "info", msg: "legacy_user_fields_backfilled" }));
}

// Sequential GST invoice numbering, persisted across restarts (GST invoices
// must carry sequential numbers — random ids are not acceptable).
const INVOICE_SEQ_FILE = path.join(DATA_DIR, "invoice_seq.json");
let invoiceSeq = readJson(INVOICE_SEQ_FILE, { year: null, n: 0 });

// Calendar date in India's business timezone. Invoice dates were previously
// taken from UTC, so invoices issued 00:00–05:30 IST carried yesterday's date.
const istDateString = (d = new Date()) => {
  const date = d instanceof Date ? d : new Date(d);
  const valid = Number.isNaN(date.getTime()) ? new Date() : date;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(valid);
  const year = parts.find((p) => p.type === "year")?.value || String(valid.getUTCFullYear());
  const month = parts.find((p) => p.type === "month")?.value || String(valid.getUTCMonth() + 1).padStart(2, "0");
  const day = parts.find((p) => p.type === "day")?.value || String(valid.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// ---------------------------------------------------------------------------
// Passwords: scrypt with per-user salt, constant-time comparison.
// ---------------------------------------------------------------------------
const hashPassword = (password, salt) =>
  crypto.scryptSync(password, salt, 64).toString("hex");

const verifyPassword = (password, salt, expectedHash) => {
  const actual = Buffer.from(hashPassword(password, salt), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
};

// ---------------------------------------------------------------------------
// Sessions: stateless signed tokens `uid.exp.ver.hmac` (7-day expiry). `ver` is
// the account's tokenVersion, so a password change/reset (or an admin demote)
// invalidates that user's sessions immediately. Global revocation = rotate
// ACTIVATION_SECRET (break-glass, signs everyone out); per-session (device)
// revocation would need server-side session storage.
// ---------------------------------------------------------------------------
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const hmacOf = (data) =>
  crypto.createHmac("sha256", activationSecret).update(data).digest("hex");

/** One-way hash for persisting spent activation tokens (audit M3). */
const sha256 = (data) => crypto.createHash("sha256").update(String(data)).digest("hex");

// Session payload v2: `uid.exp.ver.hmac`. `ver` is the account's tokenVersion,
// which is bumped whenever the password changes (reset or change-password), so
// every previously issued session dies immediately (audit H4).
// NOTE: 3-part tokens issued before versioning stop validating — every user
// signs in once at deploy time.
const issueSessionToken = (userId) => {
  const exp = Date.now() + SESSION_TTL_MS;
  const ver = users[userId]?.tokenVersion ?? 0;
  const payload = `${userId}.${exp}.${ver}`;
  return `${payload}.${hmacOf(payload)}`;
};

const verifySessionToken = (token) => {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [userId, expStr, verStr, sig] = parts;
  const payload = `${userId}.${expStr}.${verStr}`;
  const expected = hmacOf(payload);
  const sigBuf = Buffer.from(sig);
  if (sigBuf.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(expected), sigBuf)) {
    return null;
  }
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) return null;
  const user = users[userId];
  if (!user) return null;
  // A stale session from before a password event must not authenticate.
  if (Number(verStr) !== (user.tokenVersion ?? 0)) return null;
  return { userId };
};

// Extracts and verifies the Bearer session, attaching req.user when valid.
// Suspended accounts authenticate nowhere: the flag lives on the canonical
// auth store (users.json) so it is enforced in every mode, instantly.
// Admin flags (audit H-1): users.json is the fast path, but in DB mode the
// promote/demote endpoints mutate app_users.is_admin / is_root_admin. The two
// stores previously diverged silently and authorization answered from the
// stale JSON mirror. Now a JSON row WITHOUT any admin flag defers to a cached
// DB read (30s TTL), so rosters promoted via SQL or the console are honored,
// while promotion/demotion through this process invalidates the cache for an
// instant effect. Suspension stays synchronous on the canonical auth store.
// Flag-lookup cache TTL. Default 30s; env-tunable (tests set a short TTL so
// SQL-side roster changes are picked up quickly; a longer TTL reduces per-
// request DB reads on hot paths).
const ADMIN_FLAG_TTL_MS = Math.max(
  1,
  Number(process.env.ADMIN_FLAG_TTL_MS) || 30_000
);
const adminFlagCache = new Map(); // userId -> { v: [isAdmin, isRootAdmin], exp }

function rowToMemUser(row, existing = {}) {
  return {
    ...existing,
    id: row.id,
    email: row.email,
    firstName: row.first_name ?? existing.firstName ?? "",
    lastName: row.last_name ?? existing.lastName ?? "",
    specialty: row.specialty ?? existing.specialty ?? "",
    degree: row.degree ?? existing.degree ?? "",
    hash: row.password_hash ?? existing.hash ?? "",
    salt: row.salt ?? existing.salt ?? "",
    isAdmin: Boolean(row.is_admin),
    isRootAdmin: Boolean(row.is_root_admin),
    verified: Boolean(row.verified),
    tokenVersion: Number(row.token_version ?? existing.tokenVersion ?? 0),
    suspended: Boolean(row.suspended),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : (existing.createdAt || new Date().toISOString()),
  };
}

async function hydrateUserById(userId, force = false) {
  if (!userId) return null;
  if (!dbEnabled) return users[userId] || null;
  if (!force && users[userId]) return users[userId];
  try {
    const r = await query(
      `SELECT id, email, first_name, last_name, specialty, degree, password_hash, salt, is_admin, is_root_admin, verified, token_version, suspended, created_at FROM app_users WHERE id = $1`,
      [userId]
    );
    if (r.rowCount > 0) {
      const row = r.rows[0];
      users[row.id] = rowToMemUser(row, users[row.id]);
      return users[row.id];
    }
  } catch {}
  return users[userId] || null;
}

async function hydrateUserByEmail(normalizedEmail, force = false) {
  if (!normalizedEmail) return null;
  const local = Object.values(users).find((u) => u.email === normalizedEmail);
  if (!dbEnabled) return local || null;
  if (!force && local) return local;
  try {
    const r = await query(
      `SELECT id, email, first_name, last_name, specialty, degree, password_hash, salt, is_admin, is_root_admin, verified, token_version, suspended, created_at FROM app_users WHERE lower(email) = $1`,
      [normalizedEmail]
    );
    if (r.rowCount > 0) {
      const row = r.rows[0];
      users[row.id] = rowToMemUser(row, users[row.id]);
      return users[row.id];
    }
  } catch {}
  return local || null;
}

async function resolveAdminFlags(user) {
  if (!dbEnabled) return [Boolean(user.isAdmin), Boolean(user.isRootAdmin)];
  const hit = adminFlagCache.get(user.id);
  if (hit && hit.exp > Date.now()) return hit.v;
  let v;
  try {
    const r = await query(
      `SELECT is_admin, is_root_admin, token_version, suspended, verified FROM app_users WHERE id = $1`,
      [user.id]
    );
    if (r.rowCount > 0) {
      const row = r.rows[0];
      v = [Boolean(row.is_admin), Boolean(row.is_root_admin)];
      user.isAdmin = v[0];
      user.isRootAdmin = v[1];
      if (row.token_version !== null && row.token_version !== undefined) {
        user.tokenVersion = Math.max(Number(user.tokenVersion || 0), Number(row.token_version || 0));
      }
      if (row.suspended !== null && row.suspended !== undefined) {
        user.suspended = Boolean(user.suspended) || Boolean(row.suspended);
      }
      if (row.verified !== null && row.verified !== undefined) {
        user.verified = Boolean(user.verified) || Boolean(row.verified);
      }
    } else {
      // No mirrored row (legacy edge): fall back to the JSON store only.
      v = [Boolean(user.isAdmin), Boolean(user.isRootAdmin)];
    }
  } catch (err) {
    console.error(JSON.stringify({ level: "error", msg: "admin_flag_lookup_failed", userId: user.id, error: String(err) }));
    // A transient DB blip must not lock admins out: prefer the mirror.
    v = [Boolean(user.isAdmin), Boolean(user.isRootAdmin)];
  }
  adminFlagCache.set(user.id, { v, exp: Date.now() + ADMIN_FLAG_TTL_MS });
  return v;
}

const invalidateAdminFlagCache = (userId) => adminFlagCache.delete(userId);

const sessionMiddleware = async (req, res, next) => {
  // Accept either the Authorization: Bearer header (mobile / API clients) or
  // the httpOnly session cookie (the web SPA). Same signed token, same
  // verifySessionToken code. The cookie path is preferred when both are
  // present (avoids accidental header spoofing on a logged-in browser).
  const header = req.headers.authorization || "";
  const bearerMatch = /^Bearer (.+)$/.exec(header);
  const cookieToken = readCookie(req, SESSION_COOKIE);
  const token = cookieToken || (bearerMatch && bearerMatch[1]);
  if (token) {
    let parsed = verifySessionToken(token);
    // Multi-replica/stateless consistency: if missing or stale in memory, hydrate from DB
    if (!parsed && dbEnabled && typeof token === "string") {
      const parts = token.split(".");
      if (parts.length === 4) {
        const [candidateId] = parts;
        await hydrateUserById(candidateId, true);
        parsed = verifySessionToken(token);
      }
    }
    const u = parsed && users[parsed.userId];
    if (u) {
      try {
        const [dbAdmin, dbRoot] = await resolveAdminFlags(u);
        if (u.suspended) {
          return res.status(403).json({ error: "This account has been suspended. Contact support." });
        }
        if (parsed.tokenVersion !== undefined && Number(parsed.tokenVersion) !== Number(u.tokenVersion ?? 0)) {
          return next();
        }
        const { id, email, firstName, lastName, specialty, degree } = u;
        // H-2 FIX: surface the verification flag on the request so
        // requireVerifiedInteract can gate interact-with-others routes when
        // REQUIRE_VERIFIED_INTERACT=true (safe default keeps it open).
        req.user = { id, email, firstName, lastName, specialty, degree, verified: Boolean(u.verified) };
        if (dbEnabled) {
          req.isAdmin = Boolean(dbAdmin) || Boolean(dbRoot);
          req.isRootAdmin = Boolean(dbRoot);
        } else {
          req.isAdmin = Boolean(u.isAdmin) || Boolean(u.isRootAdmin);
          req.isRootAdmin = Boolean(u.isRootAdmin);
        }
        // Presence heartbeat (throttled; is_online is derived from it).
        touchPresenceThrottled(u.id);
        next();
      } catch {
        next();
      }
      return;
    }
  }
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated." });
  if (!req.isAdmin) return res.status(403).json({ error: "Admin access required." });
  next();
};

/**
 * Enforce the role hierarchy on the TARGET of a user-moderation action.
 *
 * Audit C-3 (privilege escalation): `/api/admin/users/:id/suspend` enforced
 * the hierarchy — root admins are untouchable, and only a root admin may act
 * on another admin — but `/warn` and `/unsuspend` did NOT. A regular admin
 * could therefore issue three warnings against a ROOT admin (the 3rd strike
 * auto-suspends them and kills every one of their sessions), and could
 * un-suspend any suspended admin, undoing an operator's moderation decision.
 *
 * Every user-moderation route now goes through this guard, so the rule
 * cannot drift between them again.
 *
 * Resolves the target and attaches it as `req.adminTarget`.
 */
const requireAdminTargetHierarchy = async (req, res, next) => {
  try {
    const target = users[req.params.id] || (await hydrateUserById(req.params.id));
    if (!target) return res.status(404).json({ error: "User not found." });
    const [targetIsAdmin, targetIsRootAdmin] = await resolveAdminFlags(target);
    if (targetIsRootAdmin) {
      return res.status(403).json({ error: "Root admins are managed via ADMIN_EMAILS." });
    }
    if (targetIsAdmin && !req.isRootAdmin) {
      return res.status(403).json({ error: "Only root admins can moderate other admins." });
    }
    req.adminTarget = target;
    next();
  } catch (err) {
    next(err);
  }
};

// H-2 FIX (safe default = OPEN with an explicit switch): email verification is
// a trust badge, not a product gate, unless REQUIRE_VERIFIED_INTERACT is set
// to "true". When enabled, unverified accounts can still sign in / read their
// own profile / quota (so they can complete verification), but every
// interact-with-others write/read is rejected with 403 + code
// "email_unverified". Product decision is explicit in code; flip the env var,
// no code change. NOTE: login itself stays open so the user can always reach
// the verify-email flow.
const REQUIRE_VERIFIED_INTERACT = process.env.REQUIRE_VERIFIED_INTERACT === "true";
const requireVerifiedInteract = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated." });
  if (REQUIRE_VERIFIED_INTERACT && req.user.verified === false) {
    return res.status(403).json({ error: "Verify your email to interact with other members.", code: "email_unverified" });
  }
  next();
};

// ---------------------------------------------------------------------------
// Online presence heartbeat. is_online is DERIVED (last_active_at > NOW() - 5min)
// so no hand-set flag can go stale. Throttled to one UPDATE per user per minute
// (in-memory; multi-replica fleets accept ±1min skew — presence is best-effort
// UX, not a billing input).
// ---------------------------------------------------------------------------
const presenceLastTouch = new Map(); // userId -> last touch ms
const PRESENCE_THROTTLE_MS = 60_000;
setInterval(() => {
  const cutoff = Date.now() - 10 * PRESENCE_THROTTLE_MS;
  for (const [k, t] of presenceLastTouch) if (t < cutoff) presenceLastTouch.delete(k);
}, 5 * 60_000).unref();
const touchPresenceThrottled = (userId) => {
  if (!dbEnabled || !userId) return;
  const now = Date.now();
  if (now - (presenceLastTouch.get(userId) || 0) < PRESENCE_THROTTLE_MS) return;
  presenceLastTouch.set(userId, now);
  domain.touchPresence(userId).catch(() => {});
};

// ---------------------------------------------------------------------------
// Server-side price catalog (INR, whole rupees). The client declares WHAT it is
// buying; the server decides what it costs.
// ---------------------------------------------------------------------------
// Astrology consultations ship gated behind ASTROLOGY_ENABLED so the product
// is never sold before launch (there is no reachable booking UI while off).
// When disabled the SKUs are simply omitted from the catalog and create-order
// rejects them. Enabling sells the SKUs; the existing booking path, the C1
// subscription grant and hasActiveConsultation already work unchanged.
// Safe default: off unless explicitly enabled (matches VITE_ASTROLOGY_ENABLED
// === "true" on the frontend and server/.env.example). Previously !== "false"
// shipped the feature enabled when the env was unset.
const ASTROLOGY_ENABLED = process.env.ASTROLOGY_ENABLED === "true";
// Kundali match report (₹499, buyer-pays digital product). Behind its own
// flag so it can ship dark and be turned on without a deploy. Same honesty
// rules as astrology: when off, the SKU is absent from the catalog and the
// report endpoint 503s — the product is never sellable with no reachable UI.
const REPORTS_ENABLED = process.env.REPORTS_ENABLED === "true";
const ASTROLOGY_SKUS = {
  // Audit M7: ONE sku per astrologer tier, each bound to exactly one price -
  // the client can no longer pay the base price for the expert tier because
  // the tier sku the order is created against fixes the price server-side.
  "astrologer-consultation-1499": [1499],
  "astrologer-consultation-1699": [1699],
  "astrologer-consultation-1999": [1999],
};
const PLAN_CATALOG = {
  premium: [1499],
  platinum: [2999],
  "premium-annual": [14390],
  "platinum-annual": [28790],
  // Audit M7: ONE sku per astrologer tier, each bound to exactly one price —
  // the client can no longer pay the base price for the expert tier because
  // the tier sku the order is created against fixes the price server-side.
  ...(ASTROLOGY_ENABLED ? ASTROLOGY_SKUS : {}),
  // Detailed Kundali Match Report — one SKU, one price, buyer-pays.
  ...(REPORTS_ENABLED ? { "kundali-report": [499] } : {}),
};

const catalogAllows = (sku, amount) => {
  if (typeof amount !== "number" || !Number.isInteger(amount)) return false;
  const allowed = PLAN_CATALOG[sku];
  return Array.isArray(allowed) && allowed.includes(amount);
};

// Memberships are ranked for idempotent upgrade; consultations are a separate
// product and must never overwrite (or be overwritten by) a membership (H3).
const MEMBERSHIP_SKUS = ["premium", "platinum", "premium-annual", "platinum-annual"];
const membershipRank = (sku) => MEMBERSHIP_SKUS.indexOf(sku);

// ---------------------------------------------------------------------------
// Activation tokens: `base64url(sku|exp|orderId|paymentId) + "." + hmac`.
// Single-use — redeemed tokens are remembered in-process AND the resulting
// entitlement is persisted for the authenticated user.
// ---------------------------------------------------------------------------
const ACTIVATION_TTL_MS = 15 * 60 * 1000;
const redeemedTokens = new Set();

// Single-use bookkeeping must degrade gracefully under memory pressure: forget
// the OLDEST entries when over budget instead of clearing everything — a bulk
// clear briefly made spent tokens spendable again (audit H5).
const rememberUsed = (set, token, limit = 10000) => {
  set.add(token);
  while (set.size > limit) {
    set.delete(set.values().next().value);
  }
};

const mintActivationToken = (sku, orderId, paymentId, userId = "") => {
  const exp = Date.now() + ACTIVATION_TTL_MS;
  const payload = `${sku}|${exp}|${orderId}|${paymentId}|${userId || ""}`;
  return `${Buffer.from(payload).toString("base64url")}.${hmacOf(payload)}`;
};

// Verifies signature + expiry (does not consume the token).
const verifyActivationToken = (token) => {
  if (typeof token !== "string" || !token.includes(".")) return null;
  const dot = token.lastIndexOf(".");
  let payload;
  try {
    payload = Buffer.from(token.slice(0, dot), "base64url").toString("utf8");
  } catch {
    return null;
  }
  const sig = token.slice(dot + 1);
  const expected = hmacOf(payload);
  const sigBuf = Buffer.from(sig);
  if (sigBuf.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(expected), sigBuf)) {
    return null;
  }
  const [sku, expStr, orderId, paymentId, userId] = payload.split("|");
  const exp = Number(expStr);
  if (!PLAN_CATALOG[sku] || !Number.isFinite(exp) || Date.now() > exp) return null;
  return { sku, exp, orderId, paymentId, userId: userId || null };
};

// ---------------------------------------------------------------------------
// Email tokens (verification + password reset). Same HMAC construction as
// activation tokens: single-use, short TTL, bound memory.
// ---------------------------------------------------------------------------
const EMAIL_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const usedVerifyTokens = new Set();
const usedResetTokens = new Set();
const generatedInvoices = new Map();

const mintEmailToken = (userId, purpose, tokenVersion = null) => {
  const exp = Date.now() + EMAIL_TOKEN_TTL_MS;
  const ver = tokenVersion !== null ? tokenVersion : (users[userId]?.tokenVersion ?? 0);
  const payload = `${userId}|${purpose}|${exp}|${ver}`;
  return Buffer.from(payload).toString("base64url") + "." + hmacOf(payload);
};

const verifyEmailToken = (token, purpose) => {
  if (typeof token !== "string" || !token.includes(".")) return null;
  const dot = token.lastIndexOf(".");
  let payload;
  try {
    payload = Buffer.from(token.slice(0, dot), "base64url").toString("utf8");
  } catch {
    return null;
  }
  const sig = token.slice(dot + 1);
  const expected = hmacOf(payload);
  const sigBuf = Buffer.from(sig);
  if (sigBuf.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(expected), sigBuf)) {
    return null;
  }
  const parts = payload.split("|");
  if (parts.length !== 3 && parts.length !== 4) return null;
  const [userId, tokenPurpose, expStr, tokenVersionStr] = parts;
  if (tokenPurpose !== purpose) return null;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) return null;
  const user = users[userId];
  if (!user) return null;
  if (tokenVersionStr !== undefined) {
    const expectedVer = user.tokenVersion ?? 0;
    if (Number(tokenVersionStr) !== expectedVer) return null;
  }
  return userId;
};

// ---------------------------------------------------------------------------
// Simulated orders (explicit dev mode only). Every sim order id is issued by
// THIS process and remembered, so an arbitrary "order_sim_*" string from a
// client can never verify.
// ---------------------------------------------------------------------------
const SIM_TTL_MS = 60 * 60 * 1000;
const simOrders = new Map();
const pruneSimOrders = () => {
  const cutoff = Date.now() - SIM_TTL_MS;
  for (const [id, order] of simOrders) {
    if (order.createdAt < cutoff) simOrders.delete(id);
  }
};

// Live orders issued by this server (order id -> { sku, amountPaise, createdAt }).
// verify-payment binds a payment to the order THIS server actually created, so
// a client cannot replay a real payment against a different (higher) plan (C1).
const LIVE_ORDER_TTL_MS = 24 * 60 * 60 * 1000;
const liveOrders = new Map();
const pruneLiveOrders = () => {
  const cutoff = Date.now() - LIVE_ORDER_TTL_MS;
  for (const [id, order] of liveOrders) {
    if (order.createdAt < cutoff) liveOrders.delete(id);
  }
};

// ---------------------------------------------------------------------------
// Naive in-memory rate limiter for public POST endpoints (30 requests/min/IP).
// Per-instance only; front with a real limiter/proxy in production.
// ---------------------------------------------------------------------------
// Audit H-6 (defence in depth): allow test runs to opt into a higher rate
// limit via RATE_LIMIT_MAX so the smoke suites that fire 30+ requests from
// loopback don't have to sleep a minute between phases. Production defaults
// stay at 30/min.
const RATE_LIMIT_MAX = Math.max(
  1,
  Number(process.env.RATE_LIMIT_MAX) || 30
);
const RATE_WINDOW_MS = 60 * 1000;

// Distributed cluster-safe rate limiting when in DB mode (MM-DEBT-01).
// Writes an atomic row into rate_limit_buckets keyed by bucket_key and current minute.
const checkDbRateLimit = async (bucketKey, maxHits) => {
  if (!dbEnabled) return false;
  try {
    const res = await query(
      `INSERT INTO rate_limit_buckets (bucket_key, window_start, hits)
       VALUES ($1, date_trunc('minute', NOW()), 1)
       ON CONFLICT (bucket_key, window_start)
       DO UPDATE SET hits = rate_limit_buckets.hits + 1
       RETURNING hits`,
      [bucketKey]
    );
    const hits = Number(res.rows[0]?.hits || 1);
    return hits > maxHits;
  } catch {
    // Fail open on transient DB glitch to prevent locking out legitimate users
    return false;
  }
};

// H-NEW-1: a separate per-user DAILY row budget for /api/profiles so a signed-in
// account can't scrape the whole corpus by paging. Counts ROWS returned, not
// requests. Admins bypass the cap (operator use case: moderation).
// DB-backed when DATABASE_URL is set (shared across replicas via
// rate_limit_buckets, keyed by IST calendar day); in-memory fallback otherwise.
const BROWSE_DAILY_MAX = Math.max(
  100,
  Number(process.env.BROWSE_DAILY_MAX) || 1000
);
const BROWSE_DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;
const browseHitsByUser = new Map(); // userId -> [{t, rows}, ...] within window
const browseOverBudgetSync = (userId, rowsRequested) => {
  if (!userId) return false;
  const now = Date.now();
  const arr = (browseHitsByUser.get(userId) || []).filter((e) => now - e.t < BROWSE_DAILY_WINDOW_MS);
  const used = arr.reduce((s, e) => s + (e.rows || 0), 0);
  if (used + rowsRequested > BROWSE_DAILY_MAX) {
    browseHitsByUser.set(userId, arr);
    return true;
  }
  arr.push({ t: now, rows: rowsRequested });
  browseHitsByUser.set(userId, arr);
  if (browseHitsByUser.size > 5000) {
    for (const [k, v] of browseHitsByUser) {
      if (!v.length || (now - v[v.length - 1].t >= BROWSE_DAILY_WINDOW_MS)) browseHitsByUser.delete(k);
    }
  }
  return false;
};
const browseOverBudget = async (userId, rowsRequested) => {
  if (!userId) return false;
  if (!dbEnabled) return browseOverBudgetSync(userId, rowsRequested);
  try {
    // Atomic single-statement increment keyed by IST calendar day and IST midnight
    // window_start so 00:00-05:30 IST and 05:30-24:00 IST share one bucket (audit M-1).
    const istDay = istDateString();
    const bucketKey = `browse-daily:${userId}:${istDay}`;
    const r = await query(
      `INSERT INTO rate_limit_buckets (bucket_key, window_start, hits)
       VALUES ($1, (date_trunc('day', NOW() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata'), $2)
       ON CONFLICT (bucket_key, window_start)
       DO UPDATE SET hits = rate_limit_buckets.hits + EXCLUDED.hits
       RETURNING hits`,
      [bucketKey, rowsRequested]
    );
    return Number(r.rows[0]?.hits || 0) > BROWSE_DAILY_MAX;
  } catch {
    return browseOverBudgetSync(userId, rowsRequested);
  }
};

const hitsByIp = new Map();
const ipRateLimited = (ip) => {
  const now = Date.now();
  const hits = (hitsByIp.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  hits.push(now);
  hitsByIp.delete(ip);
  hitsByIp.set(ip, hits);
  if (hitsByIp.size > 1000) {
    for (const [key, val] of hitsByIp) {
      if (val[val.length - 1] <= now - RATE_WINDOW_MS) hitsByIp.delete(key);
    }
  }
  while (hitsByIp.size > 2000) {
    hitsByIp.delete(hitsByIp.keys().next().value);
  }
  return hits.length > RATE_LIMIT_MAX;
};

const rateLimited = async (req) => {
  const userId = req.user?.id;
  if (userId) {
    if (dbEnabled) {
      const dbBlocked = await checkDbRateLimit(`user:${userId}`, USER_RATE_LIMIT_MAX);
      if (dbBlocked) return true;
    }
    return userRateLimited(userId);
  }
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  if (dbEnabled) {
    const dbBlocked = await checkDbRateLimit(`ip:${ip}`, RATE_LIMIT_MAX);
    if (dbBlocked) return true;
  }
  return ipRateLimited(ip);
};

// Per-user rate limit (item 10). The per-user bucket is independent of the
// per-IP bucket — a single user behind a corporate NAT gets 30 hits/min of
// their own regardless of how many colleagues are on the same egress IP.
// Higher cap (60/min) because a normal user has many more requests than a
// single endpoint hit, and the per-IP cap is still active for anything that
// looks like abuse.
const USER_RATE_LIMIT_MAX = Math.max(
  1,
  Number(process.env.USER_RATE_LIMIT_MAX) || 60
);
const hitsByUser = new Map();
const userRateLimited = (userId) => {
  const now = Date.now();
  const hits = (hitsByUser.get(userId) || []).filter((t) => now - t < RATE_WINDOW_MS);
  hits.push(now);
  hitsByUser.set(userId, hits);
  // Bound memory.
  if (hitsByUser.size > 5000) {
    for (const [key, val] of hitsByUser) {
      if (val[val.length - 1] <= now - RATE_WINDOW_MS) hitsByUser.delete(key);
    }
  }
  return hits.length > USER_RATE_LIMIT_MAX;
};

// Audit M-33/L-*: `emailRateLimited` was DEFINED but never CALLED — the
// per-recipient request throttle that was supposed to backstop the auth
// endpoints was dead code. The outbound-mail throttle is `emailSendAllowed`
// below (3 sends / 15 min per recipient), which is the control that matters
// for token-spam; this request-level limiter is removed rather than left as
// dead code that reads like a protection that does not exist.

// Express middleware form of the limiter. Asynchronous with fail-open safety.
const rateLimitMiddleware = async (req, res, next) => {
  try {
    if (await rateLimited(req)) return res.status(429).json({ error: "Too many requests." });
    next();
  } catch {
    next();
  }
};

// Outbound email throttle per recipient (verification/reset links). Caps how
// many emails one actor can trigger for a single address through
// register/forgot-password. The HTTP response stays IDENTICAL whether the
// send happened or not — no enumeration (audit M8).
const EMAIL_SEND_MAX = 3;
const EMAIL_SEND_WINDOW_MS = 15 * 60 * 1000;
const emailsSent = new Map(); // normalized email -> recent send timestamps[]

// Per-account LOGIN-FAILURE throttle (audit H2). Only a FAILED password ticks
// this counter, so a correct password always succeeds (no account-lockout DoS)
// while distributed guessing against one account stays capped.
const LOGIN_FAILURE_MAX = 10;
const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;
const loginFailures = new Map(); // normalized email -> recent failure timestamps[]
const noteLoginFailure = (email) => {
  const now = Date.now();
  const recent = (loginFailures.get(email) || []).filter((t) => now - t < LOGIN_FAILURE_WINDOW_MS);
  recent.push(now);
  loginFailures.delete(email);
  loginFailures.set(email, recent);
  if (loginFailures.size > 5000) {
    for (const [k, v] of loginFailures) {
      if (v[v.length - 1] <= now - LOGIN_FAILURE_WINDOW_MS) loginFailures.delete(k);
    }
  }
  return recent.length;
};
const clearLoginFailures = (email) => loginFailures.delete(email);

const emailSendAllowed = (email) => {
  const now = Date.now();
  const recent = (emailsSent.get(email) || []).filter((t) => now - t < EMAIL_SEND_WINDOW_MS);
  if (recent.length >= EMAIL_SEND_MAX) {
    emailsSent.set(email, recent);
    return false;
  }
  recent.push(now);
  emailsSent.delete(email);
  emailsSent.set(email, recent);
  return true;
};

// ---------------------------------------------------------------------------
// Structured request logging (JSON lines on stdout).
// ---------------------------------------------------------------------------
app.use((req, res, next) => {
  const start = Date.now();
  const reqId = crypto.randomUUID();
  res.on("finish", () => {
    console.log(
      JSON.stringify({
        t: new Date().toISOString(),
        level: "info",
        msg: "request",
        reqId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Date.now() - start,
        userId: req.user?.id,
      })
    );
  });
  next();
});

const allowedOrigins = (process.env.CORS_ORIGINS || APP_URL)
  .split(",")
  .map((s) => s.trim().replace(/\/+$/, ""))
  .filter(Boolean);
// C3: split-origin deploy (CDN + API) needs Access-Control-Allow-Credentials so
// the browser sends mm_session with credentials:"include". Without it the
// cookie path silently fails and only Bearer works.
app.use(cors({ origin: allowedOrigins, credentials: true }));

// ---------------------------------------------------------------------------
// Razorpay webhook (M7) — MUST read the RAW body for signature verification,
// so it is mounted before express.json. Verified with HMAC-SHA256 over the
// exact bytes Razorpay sent, using RAZORPAY_WEBHOOK_SECRET.
// ---------------------------------------------------------------------------
app.post(
  "/api/webhooks/razorpay",
  express.raw({ type: "*/*", limit: "256kb" }),
  async (req, res) => {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      return res.status(503).json({ error: "Webhooks are not configured." });
    }
    const signature = req.headers["x-razorpay-signature"];
    if (typeof signature !== "string" || !signature) {
      return res.status(400).json({ error: "Missing signature." });
    }
    const expected = crypto.createHmac("sha256", secret).update(req.body).digest("hex");
    const sigBuf = Buffer.from(signature);
    if (
      sigBuf.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(expected), sigBuf)
    ) {
      console.warn(JSON.stringify({ level: "warn", msg: "webhook_bad_signature" }));
      return res.status(401).json({ error: "Invalid signature." });
    }

    let event;
    try {
      event = JSON.parse(req.body.toString("utf8"));
    } catch {
      return res.status(400).json({ error: "Invalid JSON body." });
    }

    try {
      const type = event?.event || event?.type || "";
      const payload = event?.payload ?? {};
      const paymentEntity =
        payload?.payment?.entity ?? payload?.order?.entity?.payment ?? null;
      const paymentId = paymentEntity?.id ?? null;
      const orderId = paymentEntity?.order_id ?? payload?.order?.entity?.id ?? null;
      const amountPaise = paymentEntity?.amount ?? null;
      // Audit M-14: order-level notes echo the authenticated user id so a
      // captured payment whose create-order call lacked a session can still
      // land against the right account. notes lives on the order entity for
      // order.paid events and on the payment entity for payment.captured.
      const orderEntity = payload?.order?.entity ?? null;
      const notesSource = orderEntity?.notes ?? paymentEntity?.notes ?? null;
      const notesUserId =
        notesSource && typeof notesSource.user_id === "string" && notesSource.user_id.trim()
          ? notesSource.user_id.trim().slice(0, 64)
          : null;
      // Audit C-2: the sku is echoed into the SAME server-set notes at
      // create-order time (index.mjs razorpayNotes). It is the fallback used
      // to attribute a captured payment when the `payment_orders` row is
      // missing (the create-order write failed, or the webhook raced ahead of
      // it). Without it the payment could not be tied to a plan, the grant
      // was silently skipped, and the idempotency gate committed — locking out
      // every retry. The value is server-set, so a client cannot spoof it.
      const notesSku =
        notesSource && typeof notesSource.sku === "string" && notesSource.sku.trim()
          ? notesSource.sku.trim().slice(0, 64)
          : null;

      if (!dbEnabled) {
        console.warn(JSON.stringify({ level: "warn", msg: "webhook_no_db_ignored", type }));
        return res.json({ ok: true });
      }
      const refundEntity = payload?.refund?.entity ?? null;
      const refundType = String(type).toLowerCase();
      const refundStatus = String(refundEntity?.status || "").toLowerCase();
      // Audit X8: only a PROCESSED refund is money actually returned. The old
      // branch matched the "refund." prefix alone, so refund.created (and even
      // refund.failed) revoked paid access — and since the idempotency gate is
      // keyed on the refund id, the later authoritative refund.processed was
      // then swallowed as a duplicate.
      const refundIsTerminal = refundType === "refund.processed" || refundStatus === "processed";
      if (refundType.startsWith("refund.")) {
        if (!refundEntity?.id || (!refundEntity.payment_id && !refundEntity.order_id)) {
          // L-6: a refund event we cannot key on must be LOUD, not silently
          // logged at info — an unnoticed shape change means refunds stop
          // revoking access. Alert level so on-call dashboards catch it.
          console.error(JSON.stringify({ level: "error", msg: "webhook_refund_unkeyable", type, hasEntity: Boolean(refundEntity?.id), hasPaymentRef: Boolean(refundEntity?.payment_id || refundEntity?.order_id) }));
          return res.json({ ok: true });
        }
        if (!refundIsTerminal) {
          console.log(JSON.stringify({ level: "info", msg: "webhook_refund_ignored_nonterminal", type, refundId: refundEntity.id, status: refundEntity.status ?? null }));
          return res.json({ ok: true });
        }
      }
      if (refundType.startsWith("refund.") && refundEntity?.id) {
        const out = await domain.recordRefund({
          refundId: refundEntity.id,
          paymentId: refundEntity.payment_id ?? paymentId,
          orderId: refundEntity.order_id ?? orderId,
          amountPaise: refundEntity.amount ?? null,
          reason: refundEntity.notes ? JSON.stringify(refundEntity.notes).slice(0, 280) : "",
          source: "webhook",
        });
        console.log(JSON.stringify({ level: "info", msg: "webhook_refund_processed", type, refundId: refundEntity.id, result: out.result, revoked: out.revoked ?? null }));
        // Audit X7: a PARTIAL refund is bookkept but must not touch the plan or
        // its UI mirror — `revoked` is the only signal that may demote.
        if (out.result === "applied" && out.userId && out.revoked) {
          // Unified policy mirror (audit H-3): a refunded MEMBERSHIP downgrades
          // the mirror to basic only when nothing is set or the current entry
          // is a membership. Consultation entitlements are never clobbered by
          // a membership refund, and an existing basic is not refreshed.
          const current = entitlements[out.userId];
          if (!current || MEMBERSHIP_SKUS.indexOf(current.sku) !== -1) {
            entitlements[out.userId] = { sku: "basic", activatedAt: new Date().toISOString(), paymentId: "" };
            persistEntitlements();
          }
        }
        return res.json({ ok: true });
      }
      if (!paymentId || !String(type).startsWith("payment.captured")) {
        // payment.failed: mark the durable order so reconciliation sees it.
        if (paymentId && String(type).startsWith("payment.failed")) {
          try {
            if (orderId && dbEnabled) {
              await query(`UPDATE payment_orders SET status='failed' WHERE order_id=$1 AND status='created'`, [orderId]);
            }
            console.log(JSON.stringify({ level: "info", msg: "webhook_payment_failed", orderId }));
          } catch (err) {
            console.error(JSON.stringify({ level: "error", msg: "failed_payment_update_error", error: String(err) }));
          }
        } else {
          // Everything else is logged for observability only.
          console.log(JSON.stringify({ level: "info", msg: "webhook_event_ignored", type }));
        }
        return res.json({ ok: true });
      }
      const out = await domain.recordCapturedPayment({
        paymentId,
        orderId,
        amountPaise,
        source: "webhook",
        notesUserId,
        notesSku,
      });
      console.log(
        JSON.stringify({
          level: "info",
          msg: "webhook_payment_processed",
          type,
          paymentId,
          result: out.result,
          userId: out.userId ?? null,
          sku: out.sku ?? null,
        })
      );
      if (out.result === "applied" && out.userId && out.sku) {
        // Mirror into the JSON entitlements store so /api/auth/me reflects it.
        const current = entitlements[out.userId];
        const rank = (s) => MEMBERSHIP_SKUS.indexOf(s);
        if (
          !current ||
          (rank(out.sku) !== -1 && rank(out.sku) >= rank(current.sku))
        ) {
          entitlements[out.userId] = {
            sku: out.sku,
            activatedAt: new Date().toISOString(),
            paymentId,
          };
          persistEntitlements();
        }

        // P0-10: the coupon's global pool counter is advanced INSIDE
        // domain.recordCapturedPayment (audit H-15) — i.e. inside the
        // payment-idempotent transaction, exactly once per captured payment.
        // It used to be ticked from here by a separate consumeCoupon() call
        // whose null result this block discarded, so the pool under-counted
        // while users took N discounted orders.
      }
      return res.json({ ok: true });
    } catch (err) {
      console.error(JSON.stringify({ level: "error", msg: "webhook_handler_failed", error: String(err) }));
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Audit X6: profile photos arrive as data URLs (the client caps the file at
// 1.5 MB and base64 inflates that ~4/3), so the global 100 kb JSON limit
// rejected every real photo in body-parser BEFORE the handler could see it —
// and the error handler then reported the rejection as a 500. The upload route
// gets its own, larger parser; everything else keeps the tight default.
const jsonSmall = express.json({ limit: "100kb" });
const jsonPhoto = express.json({ limit: "3mb" });
app.use((req, res, next) => {
  if (req.method === "POST" && req.path === "/api/me/photo") {
    return jsonPhoto(req, res, next);
  }
  return jsonSmall(req, res, next);
});
app.use(sessionMiddleware);
// Audit M-12 / item 1: CSRF guard for cookie-authenticated mutating requests.
// Mounted after sessionMiddleware so /api/csrf and authenticated POSTs can
// see the cookie + token. The webhook route was mounted BEFORE this so
// Razorpay's POST (no cookie) is unaffected.
app.use(csrfGuard);
app.get("/api/csrf", (req, res) => {
  // Always rotate on /api/csrf — even if the caller already has one, freshen
  // it. Returns the token in the body for the SPA to read and cache; the
  // cookie carries the same value.
  const token = issueCsrfToken();
  setCsrfCookie(res, token);
  res.json({ csrfToken: token });
});

app.get("/health", (_req, res) => {
  // M-NEW-1: only `ok` is exposed to unauthenticated probes. The diagnostic
  // block (payments/db config) was previously visible to any caller — a free
  // fingerprinting aid for an attacker scanning the surface. Operators can
  // still read the full state from structured `server_started` JSON lines.
  res.json({ ok: true });
});

// Readiness: orchestrators poll this to know migrations + DB are healthy.
// /health stays liveness-only (always 200 once listening); /readyz is 200
// only after migrate() + a successful SELECT 1, 503 otherwise.
let readyReady = false;
export const markReady = () => { readyReady = true; };
app.get("/readyz", async (_req, res) => {
  if (!readyReady) return res.status(503).json({ ok: false, reason: "starting" });
  if (!dbEnabled) return res.json({ ok: true, mode: "json-store" });
  try {
    await query("SELECT 1");
    res.json({ ok: true, mode: "db" });
  } catch {
    res.status(503).json({ ok: false, reason: "db-unreachable" });
  }
});

// Audit B4: Content-Security-Policy violation report endpoint. Browsers POST
// here when a page attempts to violate the policy. We rate-limit the sink,
// strip query strings to prevent token/credential leakage, and truncate fields.
app.post("/api/csp-report", rateLimitMiddleware, express.json({ type: "application/csp-report", limit: "8kb" }), (req, res) => {
  try {
    const v = req.body?.["csp-report"] || req.body;
    const cleanUrl = (raw) => {
      if (!raw) return "";
      try {
        const u = new URL(String(raw));
        return `${u.origin}${u.pathname}`.slice(0, 150);
      } catch {
        return String(raw).split("?")[0].slice(0, 150);
      }
    };
    const directive = String(v?.["violated-directive"] || v?.effectiveDirective || "").slice(0, 80);
    const blocked = cleanUrl(v?.["blocked-uri"]);
    const doc = cleanUrl(v?.["document-uri"]);
    console.warn(JSON.stringify({
      level: "warn",
      msg: "csp_violation",
      directive,
      blocked,
      doc,
    }));
  } catch {
    /* malformed — ignore */
  }
  res.status(204).end();
});

// ---------------------------------------------------------------------------
// Auth: register / login / me.
// ---------------------------------------------------------------------------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Item 9: proof-of-work (Hashcash-style) bot resistance for the public
// registration + password-reset endpoints. The client requests a challenge,
// solves it locally (find a nonce such that SHA-256(challenge || nonce) has
// at least `difficulty` leading zero BITS), and submits {challenge, nonce}.
// The server re-hashes and counts — verification is microseconds, solving
// at difficulty 18 is ~0.3s of CPU on a modern laptop and quadratically more
// expensive at scale, neutralising bulk account creation scripts.
//
// The challenge is bound to the email address (so an attacker can't reuse
// a solved challenge across many emails) and to a 5-minute TTL window.
const POW_DIFFICULTY = 18;
const POW_TTL_MS = 5 * 60 * 1000;
// Test-only escape hatch — smoke and CI suites that drive register/forgot
// from a tight loop set DISABLE_POW=true so they don't have to solve a
// PoW per call. Production never sets this.
const POW_DISABLED = process.env.DISABLE_POW === "true";
const powChallenges = new Map(); // challenge -> { email, exp }

const countLeadingZeroBitsHex = (hex) => {
  // For each hex char (a 4-bit nibble), add 4 if the nibble is 0; otherwise
  // add the number of leading zero bits in that nibble and stop. The function
  // returns the total number of leading zero BITS in the entire hex string.
  let bits = 0;
  for (let i = 0; i < hex.length; i++) {
    const nibble = parseInt(hex[i], 16);
    if (nibble === 0) { bits += 4; continue; }
    if (nibble < 8) bits += 1;
    if (nibble < 4) bits += 1;
    if (nibble < 2) bits += 1;
    return bits;
  }
  return bits;
};

const MAX_POW_CHALLENGES = 2000;
const prunePow = () => {
  const now = Date.now();
  for (const [c, v] of powChallenges) if (v.exp <= now) powChallenges.delete(c);
  while (powChallenges.size >= MAX_POW_CHALLENGES) {
    powChallenges.delete(powChallenges.keys().next().value);
  }
};

app.get("/api/auth/pow-challenge", rateLimitMiddleware, (req, res) => {
  prunePow();
  const email = String(req.query.email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: "A valid email is required." });
  }
  // Bind the challenge to the email + a server-side secret so a captcha
  // solved for alice@x.com cannot be reused for bob@y.com.
  const challenge = crypto
    .createHash("sha256")
    .update(`${email}|${Date.now()}|${crypto.randomBytes(16).toString("hex")}|${activationSecret}`)
    .digest("hex");
  powChallenges.set(challenge, { email, exp: Date.now() + POW_TTL_MS });
  res.json({ challenge, difficulty: POW_DIFFICULTY, ttlMs: POW_TTL_MS });
});

const verifyPow = (email, challenge, nonce) => {
  if (typeof challenge !== "string" || typeof nonce !== "string") return false;
  if (challenge.length !== 64 || nonce.length < 1 || nonce.length > 64) return false;
  const entry = powChallenges.get(challenge);
  if (!entry) return false;
  if (entry.exp <= Date.now()) { powChallenges.delete(challenge); return false; }
  if (entry.email !== String(email || "").trim().toLowerCase()) return false;
  const hash = crypto.createHash("sha256").update(challenge).update(nonce).digest("hex");
  return countLeadingZeroBitsHex(hash) >= POW_DIFFICULTY;
};

// Drop a challenge from the store on successful use so it cannot be replayed.
const consumePow = (email, challenge, nonce) => {
  if (POW_DISABLED) return true;
  if (!verifyPow(email, challenge, nonce)) return false;
  powChallenges.delete(challenge);
  return true;
};
// The "Dr." prefix is applied ONLY for completed qualifications. A medical
// student / "Pursuing" / unspecified degree is never auto-labelled "Dr." — an
// unlicensed registrar/user is fully eligible to marry but must not be
// presented as an already-qualified doctor (platform-dishonest + IMC-sensitive).
const mayUseDrTitle = (u) => {
  const d = String(u.degree || "").trim().toLowerCase();
  if (!d || d.includes("pursuing") || d.includes("student")) return false;
  return true;
};
const publicUser = (u) => ({
  id: u.id,
  email: u.email,
  firstName: u.firstName,
  lastName: u.lastName,
  fullName: `${mayUseDrTitle(u) ? "Dr. " : ""}${u.firstName} ${u.lastName}`.trim(),
  specialty: u.specialty,
  degree: u.degree,
});

app.post("/api/auth/register", async (req, res) => {
  if (await rateLimited(req)) return res.status(429).json({ error: "Too many requests." });
  const { email, password, firstName, lastName, specialty, degree, careerStage, powChallenge, powNonce } = req.body || {};
  if (typeof email !== "string" || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: "A valid email is required." });
  }
  // Item 9: proof-of-work. The challenge is bound to the email; an
  // attacker who wants to bulk-register must solve ~2^18 hashes per
  // account, which makes mass creation economically unviable.
  if (!consumePow(email, powChallenge, powNonce)) {
    return res.status(400).json({
      error: "Verification challenge incomplete. Reload the page and try again.",
    });
  }
  if (typeof password !== "string" || password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  }
  if (typeof firstName !== "string" || !firstName.trim()) {
    return res.status(400).json({ error: "First name is required." });
  }
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await hydrateUserByEmail(normalizedEmail);

  // Identical response for new and existing accounts — no account enumeration.
  const message = "If this email is registered, check your inbox for a verification link.";

  if (existing) {
    // Audit B5: Equalize timing against the new-account path where scrypt password
    // hashing dominates execution time. Prevents account enumeration via timing oracle.
    hashPassword(password, crypto.randomBytes(16).toString("hex"));
    if (existing.verified) {
      if (emailSendAllowed(normalizedEmail)) {
        sendEmailInBackground({
          to: existing.email,
          subject: "Your MedicoMatch account already exists",
          text: "You already have a MedicoMatch account. Sign in at " + APP_URL + "/sign-in",
        });
      }
      return res.status(201).json({ message });
    }
    // Re-verify flow. Throttle the outbound email per recipient; the response
    // stays identical either way (no enumeration). The test-mode token is only
    // returned when a send actually happened, so tests can assert throttling.
    const resent = emailSendAllowed(normalizedEmail);
    const token = mintEmailToken(existing.id, "verify");
    if (resent) {
      sendEmailInBackground({
        to: existing.email,
        subject: "Verify your MedicoMatch account",
        text: "Verify your email: " + APP_URL + "/verify-email?token=" + encodeURIComponent(token),
      });
      return res.status(201).json({ message, ...(process.env.NODE_ENV === "test" ? { verificationToken: token } : {}) });
    }
    return res.status(201).json({ message });
  }

  const salt = crypto.randomBytes(16).toString("hex");
  const user = {
    id: crypto.randomUUID(),
    email: normalizedEmail,
    firstName: typeof firstName === "string" ? firstName.trim().slice(0, 80) : "",
    lastName: typeof lastName === "string" ? lastName.trim().slice(0, 80) : "",
    specialty: typeof specialty === "string" ? specialty.slice(0, 120) : "",
    degree: typeof degree === "string" ? degree.slice(0, 120) : "",
    // Optional at registration: a medical student (or anyone who prefers not
    // to say yet) stays honest — no forced "MBBS", no forced "Dr.".
    careerStage: typeof careerStage === "string" ? careerStage.slice(0, 120) : "",
    salt,
    hash: hashPassword(password, salt),
    verified: false,
    tokenVersion: 0,
    createdAt: new Date().toISOString(),
  };
  users[user.id] = user;
  persistUsers();

  // DB mode: mirror the account and provision its profile row immediately, so
  // the user exists for interests/chat/quotas from their very first login.
  if (dbEnabled) {
    try {
      await domain.upsertMyProfile(
        user.id,
        // Mirror the REAL verification state (false at registration); the
        // verify-email endpoint keeps app_users.verified in sync afterwards,
        // so the admin console reports true status (audit H-2 slice).
        {
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          specialty: user.specialty,
          degree: user.degree,
          careerStage: user.careerStage,
          verified: false,
          passwordHash: user.hash,
          salt: user.salt,
          tokenVersion: user.tokenVersion,
        },
        { full_name: `${mayUseDrTitle(user) ? "Dr. " : ""}${user.firstName} ${user.lastName}`.trim(), specialty: user.specialty || null, degree: user.degree || null, career_stage: user.careerStage || null }
      );
    } catch (err) {
      // Audit M-14: `app_users.email` is UNIQUE, so this is exactly where a
      // concurrent duplicate registration is caught. The error used to be
      // swallowed, which left TWO in-memory accounts with the same email and
      // different ids — and login (which scans the in-memory map) would pick
      // whichever it found first, so one of them could never sign in and the
      // other could take its place.
      //
      // Fail CLOSED: drop the half-created account and tell the caller. The
      // unique constraint is the race backstop; this is what makes it mean
      // something.
      console.error(JSON.stringify({ level: "error", msg: "user_mirror_failed", userId: user.id, error: String(err) }));
      delete users[user.id];
      persistUsers();
      return res.status(503).json({ error: "Could not create your account. Please try again." });
    }
  }

  const token = mintEmailToken(user.id, "verify");
  const sent = emailSendAllowed(user.email);
  if (sent) {
    sendEmailInBackground({
      to: user.email,
      subject: "Verify your MedicoMatch account",
      text: "Verify your email: " + APP_URL + "/verify-email?token=" + encodeURIComponent(token),
    });
  }

  res.status(201).json({ message, ...(process.env.NODE_ENV === "test" && sent ? { verificationToken: token } : {}) });
});

app.post("/api/auth/login", async (req, res) => {
  if (await rateLimited(req)) return res.status(429).json({ error: "Too many requests." });
  const { email, password } = req.body || {};
  if (typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Email and password are required." });
  }
  const normalizedEmail = email.trim().toLowerCase();
  let user = Object.values(users).find((u) => u.email === normalizedEmail);
  if (!user && dbEnabled) {
    try {
      const r = await query(
        `SELECT id, email, first_name, last_name, specialty, degree, password_hash, salt, is_admin, is_root_admin, verified, token_version, suspended FROM app_users WHERE email = $1`,
        [normalizedEmail]
      );
      if (r.rowCount > 0) {
        const row = r.rows[0];
        user = {
          id: row.id,
          email: row.email,
          firstName: row.first_name || "",
          lastName: row.last_name || "",
          specialty: row.specialty || "",
          degree: row.degree || "",
          hash: row.password_hash,
          salt: row.salt,
          isAdmin: Boolean(row.is_admin),
          isRootAdmin: Boolean(row.is_root_admin),
          verified: Boolean(row.verified),
          tokenVersion: Number(row.token_version || 0),
          suspended: Boolean(row.suspended),
        };
        users[row.id] = user;
      }
    } catch {}
  }
  // Generic error either way — no account enumeration.
  if (!user) {
    // Equalize timing for unknown emails so response latency does not reveal
    // whether an account exists (scrypt is the dominant cost) — audit H2.
    hashPassword(password, crypto.randomBytes(16).toString("hex"));
    // Audit H2: only failed attempts tick the per-account counter, so a
    // distributed guessing run is capped without ever locking out the owner.
    return res
      .status(noteLoginFailure(normalizedEmail) > LOGIN_FAILURE_MAX ? 429 : 401)
      .json({ error: "Invalid email or password." });
  }
  const passwordOk = verifyPassword(password, user.salt, user.hash);
  if (!passwordOk) {
    return res
      .status(noteLoginFailure(normalizedEmail) > LOGIN_FAILURE_MAX ? 429 : 401)
      .json({ error: "Invalid email or password." });
  }
  // Unverified accounts complete sign-up via the emailed link; keep this
  // response indistinguishable from a bad password (no enumeration).
  // Suspended accounts are refused here too — the session middleware enforces
  // the canonical flag on every authenticated call, but a suspended user must
  // not be able to mint a FRESH session at all (smoke-db regression: login
  // returned 200 + a live token for a suspended account). Same generic 401.
  if (!user.verified || user.suspended) {
    return res.status(401).json({ error: "Invalid email or password." });
  }
  clearLoginFailures(normalizedEmail);
  const sessionToken = issueSessionToken(user.id);
  const csrfToken = issueCsrfToken();
  setSessionCookie(res, sessionToken);
  setCsrfCookie(res, csrfToken);
  // H-1 FIX (login): cookie-first for the web SPA; Bearer only for explicit
  // mobile/API opt-in. SAFE DEFAULT: browser callers get { token: null }.
  const wantsBearerLogin = req.body?.mobile === true || req.headers["x-mm-mobile"] === "1";
  res.json({ token: wantsBearerLogin ? sessionToken : null, csrfToken, user: publicUser(user) });
});

app.post("/api/auth/verify-email", async (req, res) => {
  if (await rateLimited(req)) return res.status(429).json({ error: "Too many requests." });
  const { token } = req.body || {};
  if (dbEnabled && typeof token === "string" && token.includes(".")) {
    try {
      const [candidateId] = Buffer.from(token.slice(0, token.lastIndexOf(".")), "base64url").toString("utf8").split("|");
      if (candidateId && !users[candidateId]) await hydrateUserById(candidateId);
    } catch {}
  }
  const userId = verifyEmailToken(token, "verify");
  if (!userId || !users[userId]) {
    return res.status(400).json({ error: "Invalid or expired verification link." });
  }
  const tokenHash = sha256(token);
  // M1: atomic single-use claim — INSERT .. RETURNING is the race backstop.
  // The old SELECT-then-INSERT let concurrent double-submits both pass.
  if (dbEnabled) {
    try {
      const claim = await query(
        `INSERT INTO used_email_tokens (token_hash, purpose) VALUES ($1, 'verify') ON CONFLICT DO NOTHING RETURNING token_hash`,
        [tokenHash]
      );
      if (claim.rowCount === 0) {
        return res.status(409).json({ error: "This verification link has already been used." });
      }
    } catch {
      if (usedVerifyTokens.has(token)) {
        return res.status(409).json({ error: "This verification link has already been used." });
      }
    }
  } else if (usedVerifyTokens.has(token)) {
    return res.status(409).json({ error: "This verification link has already been used." });
  }
  rememberUsed(usedVerifyTokens, token);
  const user = users[userId];
  if (!user.verified) {
    user.verified = true;
    user.emailVerifiedAt = new Date().toISOString();
    persistUsers();
    // Keep the DB mirror's verification status truthful (audit H-2 slice):
    // the admin console reads app_users.verified, which previously stayed
    // FALSE forever after email verification.
    if (dbEnabled) {
      query(`UPDATE app_users SET verified = TRUE WHERE id = $1`, [userId]).catch((err) => {
        console.error(JSON.stringify({ level: "error", msg: "verify_mirror_failed", userId, error: String(err) }));
      });
    }
  }
  const sessionToken = issueSessionToken(user.id);
  const csrfToken = issueCsrfToken();
  setSessionCookie(res, sessionToken);
  setCsrfCookie(res, csrfToken);
  // H-1 FIX (verify-email): same cookie-first split as login.
  const wantsBearerVerify = req.body?.mobile === true || req.headers["x-mm-mobile"] === "1";
  res.json({ token: wantsBearerVerify ? sessionToken : null, csrfToken, user: publicUser(user) });
});

app.post("/api/auth/forgot-password", async (req, res) => {
  if (await rateLimited(req)) return res.status(429).json({ error: "Too many requests." });
  const { email, powChallenge, powNonce } = req.body || {};
  if (typeof email !== "string" || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: "A valid email is required." });
  }
  // Item 9: PoW gate. An attacker cannot hammer forgot-password to either
  // discover which emails exist (no enumeration) or to flood victims with
  // reset emails.
  if (!consumePow(email, powChallenge, powNonce)) {
    return res.status(400).json({
      error: "Verification challenge incomplete. Reload the page and try again.",
    });
  }
  const message = "If this email is registered, a password reset link has been sent.";
  const normalizedEmail = email.trim().toLowerCase();
  const user = await hydrateUserByEmail(normalizedEmail);
  if (user) {
    // Per-recipient throttle: identical response whether or not the email
    // actually goes out (no enumeration); test-mode token only on real sends.
    if (user.verified) {
      const sent = emailSendAllowed(normalizedEmail);
      const token = mintEmailToken(user.id, "reset");
      if (sent) {
        sendEmailInBackground({
          to: user.email,
          subject: "Reset your MedicoMatch password",
          text: "Reset your password: " + APP_URL + "/reset-password?token=" + encodeURIComponent(token),
        });
        return res.status(200).json({ message, ...(process.env.NODE_ENV === "test" ? { resetToken: token } : {}) });
      }
      return res.status(200).json({ message });
    }
    if (emailSendAllowed(normalizedEmail)) {
      const token = mintEmailToken(user.id, "verify");
      sendEmailInBackground({
        to: user.email,
        subject: "Verify your MedicoMatch account",
        text: "Verify your email: " + APP_URL + "/verify-email?token=" + encodeURIComponent(token),
      });
    }
    return res.status(200).json({ message });
  }
  // Timing-equalize against the registered-email path (scrypt dominates).
  hashPassword("dummy-" + Date.now(), crypto.randomBytes(16).toString("hex"));
  res.status(200).json({ message });
});

app.post("/api/auth/reset-password", async (req, res) => {
  if (await rateLimited(req)) return res.status(429).json({ error: "Too many requests." });
  const { token, password } = req.body || {};
  if (dbEnabled && typeof token === "string" && token.includes(".")) {
    try {
      const [candidateId] = Buffer.from(token.slice(0, token.lastIndexOf(".")), "base64url").toString("utf8").split("|");
      if (candidateId && !users[candidateId]) await hydrateUserById(candidateId);
    } catch {}
  }
  const userId = verifyEmailToken(token, "reset");
  if (!userId || !users[userId]) {
    return res.status(400).json({ error: "Invalid or expired reset link." });
  }
  const tokenHash = sha256(token);
  if (typeof password !== "string" || password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  }
  // M1: atomic claim before mutating the password (see verify-email).
  if (dbEnabled) {
    try {
      const claim = await query(
        `INSERT INTO used_email_tokens (token_hash, purpose) VALUES ($1, 'reset') ON CONFLICT DO NOTHING RETURNING token_hash`,
        [tokenHash]
      );
      if (claim.rowCount === 0) {
        return res.status(409).json({ error: "This reset link has already been used." });
      }
    } catch {
      if (usedResetTokens.has(token)) {
        return res.status(409).json({ error: "This reset link has already been used." });
      }
    }
  } else if (usedResetTokens.has(token)) {
    return res.status(409).json({ error: "This reset link has already been used." });
  }
  rememberUsed(usedResetTokens, token);
  const user = users[userId];
  user.salt = crypto.randomBytes(16).toString("hex");
  user.hash = hashPassword(password, user.salt);
  // Invalidate every session issued before this reset (audit H4).
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  persistUsers();
  if (dbEnabled) {
    try {
      await query(
        `UPDATE app_users SET password_hash = $1, salt = $2, token_version = $3 WHERE id = $4`,
        [user.hash, user.salt, user.tokenVersion, user.id]
      );
    } catch (err) {
      console.error(JSON.stringify({ level: "error", msg: "reset_password_db_sync_failed", error: String(err) }));
    }
  }
  // Professional hygiene: tell the user their password changed (and where).
  sendEmailInBackground({
    to: user.email,
    subject: "Your MedicoMatch password was changed",
    text:
      "Your MedicoMatch password was just reset. If this wasn't you, reply to this email immediately — " +
      "all sessions were signed out, but your email should be secured too.",
  });
  res.json({ message: "Password updated. You can now sign in." });
});

// ---------------------------------------------------------------------------
// Change password for the signed-in user. Requires the CURRENT password and
// bumps tokenVersion so all other sessions die immediately (audit H4).
// ---------------------------------------------------------------------------
app.post("/api/auth/change-password", async (req, res) => {
  if (await rateLimited(req)) return res.status(429).json({ error: "Too many requests." });
  if (!req.user) return res.status(401).json({ error: "Not authenticated." });
  const { currentPassword, newPassword } = req.body || {};
  const user = users[req.user.id];
  if (!user) return res.status(401).json({ error: "Not authenticated." });
  if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
    return res.status(400).json({ error: "Current and new passwords are required." });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  }
  if (!verifyPassword(currentPassword, user.salt, user.hash)) {
    // Same generic message as a failed login — no extra signal.
    return res.status(401).json({ error: "Current password is incorrect." });
  }
  user.salt = crypto.randomBytes(16).toString("hex");
  user.hash = hashPassword(newPassword, user.salt);
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  persistUsers();
  if (dbEnabled) {
    try {
      await query(
        `UPDATE app_users SET password_hash = $1, salt = $2, token_version = $3 WHERE id = $4`,
        [user.hash, user.salt, user.tokenVersion, user.id]
      );
    } catch (err) {
      console.error(JSON.stringify({ level: "error", msg: "change_password_db_sync_failed", error: String(err) }));
    }
  }
  sendEmailInBackground({
    to: user.email,
    subject: "Your MedicoMatch password was changed",
    text:
      "Your MedicoMatch password was just changed. All sessions were signed out. " +
      "If this wasn't you, contact support immediately.",
  });
  res.json({ message: "Password updated. Please sign in again." });
});

// Audit M-12 / item 1: sign-out endpoint that clears the session cookie and
// rotates a fresh CSRF token. The Bearer token (mobile path) is stateless and
// cannot be revoked here — rotation is the only way to invalidate it (the
// client should drop the local copy on 200).
app.post("/api/auth/sign-out", (req, res) => {
  clearSessionCookie(res);
  setCsrfCookie(res, issueCsrfToken());
  res.json({ ok: true });
});

app.get("/api/auth/me", wrap(async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated." });
  const mirrored = entitlements[req.user.id];
  let activePlan = mirrored ? mirrored.sku : null;
  let activatedAt = mirrored ? mirrored.activatedAt : null;
  // Audit H3: in DB mode `subscriptions` is the source of truth for a
  // MEMBERSHIP. The mirror read above lives on the container's ephemeral
  // filesystem (so it was empty after every redeploy, demoting paying members to
  // "basic" in the UI) and it carries no expiry (so a lapsed plan stayed
  // active-looking forever). Non-membership skus (consultations/reports) remain
  // mirror-driven: they are single-use products, not access windows.
  if (dbEnabled) {
    try {
      const truthSku = await domain.getActiveMembershipSku(req.user.id);
      if (truthSku) {
        activePlan = truthSku;
      } else if (mirrored && MEMBERSHIP_SKUS.indexOf(mirrored.sku) === -1) {
        activePlan = mirrored.sku;
      } else {
        activePlan = null;
        activatedAt = null;
      }
    } catch (err) {
      console.error(JSON.stringify({ level: "error", msg: "me_plan_lookup_failed", error: String(err) }));
    }
  }
  res.json({ user: req.user, activePlan, activatedAt });
}));

// ---------------------------------------------------------------------------
// Create a Razorpay Order (server-side, keeps the KEY SECRET safe).
// Body: { sku, amount (INR rupees), currency?, receipt?, notes? }
// ---------------------------------------------------------------------------
app.post("/api/razorpay/create-order", async (req, res) => {
  if (await rateLimited(req)) return res.status(429).json({ error: "Too many requests." });

  // Audit M-7: in DB mode every order MUST be attributable to a known user —
  // otherwise a captured payment has no row to land against and the user can
  // never claim their plan via the webhook. The simulate path is intentionally
  // permissive (dev/smoke tests boot without a session) but the production
  // DB path enforces attribution.
  if (dbEnabled && !req.user) {
    return res.status(401).json({ error: "Sign in to start a purchase." });
  }

  // Audit H-15: the coupon reservation taken below must be released if the
  // order never gets created (Razorpay unreachable, order write failed).
  let reservedCoupon = null;

  try {
    const {
      sku,
      amount,
      currency = "INR",
      receipt = `rcpt_${Date.now()}`,
      notes = {},
      coupon,
    } = req.body || {};

    if (typeof sku !== "string" || !PLAN_CATALOG[sku]) {
      return res.status(400).json({ error: "Unknown plan." });
    }
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: "A positive amount is required." });
    }

    // Audit X4 / M-11: never take money for a plan the account cannot use.
    // Buying a lower tier while a higher one is active captured the payment,
    // skipped the grant (recordCapturedPayment's rank guard) and still
    // reported success.
    //
    // `premium` and `premium-annual` share a rank, so the old "strictly lower
    // rank" test let a member holding the ANNUAL plan buy the MONTHLY one —
    // ₹1,499 for 30 days of access they already had for 365 — and left two
    // equal-rank subscription rows that `getActiveMembership` picked between
    // non-deterministically.
    //
    // PRODUCT DECISION (safe default): a membership may be bought only when
    // it is a strict tier upgrade, or the same tier with the same billing
    // period (a genuine renewal). Buying a shorter period at the same tier
    // is refused.
    const PLAN_PERIOD_DAYS = (s) => (String(s || "").endsWith("-annual") ? 365 : 30);
    if (dbEnabled && req.user) {
      const [activeMembership, requestedPlan] = await Promise.all([
        domain.getActiveMembership(req.user.id).catch(() => null),
        domain.getPlan(sku).catch(() => null),
      ]);
      if (activeMembership && requestedPlan && requestedPlan.kind === "membership") {
        const sameTier = Number(activeMembership.rank) === Number(requestedPlan.rank);
        const shorterPeriod = PLAN_PERIOD_DAYS(activeMembership.sku) > PLAN_PERIOD_DAYS(sku);
        if (Number(activeMembership.rank) > Number(requestedPlan.rank) || (sameTier && shorterPeriod)) {
          return res.status(409).json({
            error: `Your ${activeMembership.sku} membership is already active and includes everything in this plan, so there is nothing to buy right now. It stays valid until it expires.`,
          });
        }
      }
    }
    // P0-10 coupons: validated server-side; the payable amount must equal the
    // discounted catalog price (integer rupees). Consumed at verify-time, not here.
    let couponPct = 0;
    let couponCode = null;
    if (typeof coupon === "string" && coupon.trim()) {
      if (dbEnabled) {
        // M-1: per-user check — a redeemed once-per-user coupon is invalid.
        const c = await domain.validateCoupon(coupon, req.user?.id ?? null);
        if (!c) return res.status(400).json({ error: "Invalid or expired coupon." });
        couponPct = c.percentOff;
        couponCode = c.code;
      } else {
        const codeUpper = coupon.trim().toUpperCase();
        if (codeUpper === "WELCOME10") {
          couponPct = 10;
          couponCode = "WELCOME10";
        } else {
          return res.status(400).json({ error: "Invalid or expired coupon." });
        }
      }
      const base = PLAN_CATALOG[sku][0];
      const expected = Math.round((base * (100 - couponPct)) / 100);
      // Coupon path must also require integer rupees like catalogAllows does —
      // otherwise 1349.49 passes (round==1349) then charges 134949 paise.
      if (!Number.isInteger(amount) || amount !== expected) {
        return res.status(400).json({ error: `Amount does not match the coupon price (₹${expected}).` });
      }
    } else if (!catalogAllows(sku, amount)) {
      return res.status(400).json({ error: "Amount does not match the price of that plan." });
    }
    if (!/^INR$/i.test(currency)) {
      return res.status(400).json({ error: "Only INR is supported." });
    }

    // Audit H-15: RESERVE the coupon NOW, before a discounted order exists.
    //
    // The reservation is an atomic INSERT on the primary key
    // `coupon_redemptions(code, user_id)`, so two concurrent orders race on it
    // and exactly one wins — the loser is rejected here instead of taking a
    // second discount. Previously the DISCOUNT was applied at order time but
    // the redemption was only recorded at capture time, and every call site
    // discarded the null result: N parallel orders all took the discount, each
    // extending the membership window by 30 days, while the global pool
    // counter ticked exactly once.
    //
    // A stale reservation on an order that was never paid for is released
    // after 30 minutes (see domain.reserveCoupon), so an abandoned checkout
    // can be retried.
    if (couponCode && dbEnabled && req.user?.id) {
      const reserved = await domain.reserveCoupon(couponCode, req.user.id);
      if (!reserved) {
        return res.status(400).json({ error: "This coupon has already been used on your account." });
      }
      reservedCoupon = { code: couponCode, userId: req.user.id };
    }

    const amountInPaise = Math.round(amount * 100);

    if (simulatePayments) {
      pruneSimOrders();
      const id = `order_sim_${crypto.randomUUID()}`;
      simOrders.set(id, { sku, amount: amountInPaise, couponCode, userId: req.user?.id ?? null, createdAt: Date.now() });
      if (dbEnabled) {
        try {
          await domain.recordOrder({ orderId: id, userId: req.user?.id ?? null, sku, amountPaise: amountInPaise, simulated: true, couponCode });
        } catch (err) {
          // Audit C-2: the order row IS the binding that lets verify-payment
          // prove a payment belongs to this sku. Losing it means the payment
          // can never be verified or invoiced, so fail loudly NOW — before any
          // money moves — instead of handing the client an order the server
          // cannot honour later.
          console.error(JSON.stringify({ level: "error", msg: "order_record_failed", error: String(err) }));
          await domain.releaseCouponReservation(reservedCoupon?.code, reservedCoupon?.userId);
          return res.status(503).json({ error: "Could not reserve the order. Please try again." });
        }
      }
      return res.json({
        id,
        amount: amountInPaise,
        currency,
        receipt,
        status: "created",
        simulated: true,
      });
    }

    if (!razorpayConfigured) {
      await domain.releaseCouponReservation(reservedCoupon?.code, reservedCoupon?.userId);
      return res
        .status(500)
        .json({ error: "Razorpay is not configured on the server." });
    }

    const auth = Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString("base64");
    // Audit M-14: echo the authenticated user id into Razorpay's order notes so
    // a webhook arriving for an anonymous/cookie-less browser can still resolve
    // the order back to a real account (e.g. mobile webview with cookies
    // stripped, or the post-redirect recovery path before sign-in).
    const razorpayNotes = {
      ...notes,
      sku,
      ...(req.user?.id ? { user_id: req.user.id } : {}),
      ...(couponCode ? { coupon: couponCode } : {}),
    };
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      // Audit H12: bounded outbound call — a hung Razorpay socket must not park
      // the checkout request until the proxy times out.
      signal: AbortSignal.timeout(15_000),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({ amount: amountInPaise, currency, receipt, notes: razorpayNotes }),
    });

    let orderData;
    try {
      orderData = await response.json();
    } catch {
      orderData = {};
    }

    if (!response.ok) {
      await domain.releaseCouponReservation(reservedCoupon?.code, reservedCoupon?.userId);
      return res.status(response.status).json({
        error: orderData?.error?.description || "Could not create the Razorpay order.",
      });
    }
    if (orderData?.id) {
      pruneLiveOrders();
      liveOrders.set(orderData.id, { sku, amount: amountInPaise, couponCode, userId: req.user?.id ?? null, createdAt: Date.now() });
      if (dbEnabled) {
        try {
          await domain.recordOrder({ orderId: orderData.id, userId: req.user?.id ?? null, sku, amountPaise: amountInPaise, simulated: false, couponCode });
        } catch (err) {
          // Audit C-2: same reasoning as the simulated path above. No payment
          // has been taken yet, so failing here is free and keeps the
          // order -> payment -> entitlement chain verifiable end to end.
          console.error(JSON.stringify({ level: "error", msg: "order_record_failed", error: String(err) }));
          await domain.releaseCouponReservation(reservedCoupon?.code, reservedCoupon?.userId);
          return res.status(503).json({ error: "Could not reserve the order. Please try again." });
        }
      }
    }
    return res.json(orderData);
  } catch (error) {
    console.error(JSON.stringify({ level: "error", msg: "order_creation_failed", error: String(error) }));
    await domain.releaseCouponReservation(reservedCoupon?.code, reservedCoupon?.userId);
    res.status(500).json({ error: "Could not create the Razorpay order." });
  }
});

// ---------------------------------------------------------------------------
// Verify a Razorpay payment signature (HMAC-SHA256 over order_id|payment_id)
// and mint a single-use entitlement token for the purchased plan.
// Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature, sku }
// ---------------------------------------------------------------------------
app.post("/api/razorpay/verify-payment", wrap(async (req, res) => {
  if (await rateLimited(req)) return res.status(429).json({ error: "Too many requests." });

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, sku } = req.body || {};

  if (!razorpay_order_id || typeof razorpay_order_id !== "string") {
    return res.status(400).json({ verified: false, error: "Missing order id." });
  }
  if (!razorpay_payment_id || typeof razorpay_payment_id !== "string") {
    return res.status(400).json({ verified: false, error: "Missing payment id." });
  }
  if (typeof sku !== "string" || !PLAN_CATALOG[sku]) {
    return res.status(400).json({ verified: false, error: "Unknown plan." });
  }

  let boundOrder = null;

  if (simulatePayments) {
    // Only order ids issued by this process in this session are accepted —
    // never trust a client-supplied "order_sim_*" string.
    const sim = simOrders.get(razorpay_order_id);
    if (!sim || sim.sku !== sku) {
      return res.json({ verified: false, error: "Unknown simulated order." });
    }
  } else {
    if (!razorpayKeySecret) {
      return res
        .status(500)
        .json({ verified: false, error: "Razorpay is not configured on the server." });
    }
    if (typeof razorpay_signature !== "string" || !razorpay_signature) {
      return res.status(400).json({ verified: false, error: "Missing payment signature." });
    }

    const expected = crypto
      .createHmac("sha256", razorpayKeySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest();
    let received;
    try {
      received = Buffer.from(razorpay_signature, "hex");
    } catch {
      return res.json({ verified: false });
    }

    const isAuthentic =
      expected.length === received.length && crypto.timingSafeEqual(expected, received);
    if (!isAuthentic) {
      return res.json({ verified: false });
    }

    // Bind the payment to the order THIS server issued for THIS sku (C1).
    // Without this, a replay of a legitimate ₹1,499 payment with sku
    // "platinum-annual" would mint a token for the ₹28,790 plan.
    if (dbEnabled) {
      const o = await domain.getOrder(razorpay_order_id);
      if (!o || o.sku !== sku) {
        return res.json({ verified: false, error: "Order does not match the purchased plan." });
      }
      boundOrder = o;
    } else {
      const live = liveOrders.get(razorpay_order_id);
      if (!live || live.sku !== sku) {
        return res.json({ verified: false, error: "Order does not match the purchased plan." });
      }
    }
  }

  const orderUserId = req.user?.id || boundOrder?.user_id || liveOrders.get(razorpay_order_id)?.userId || simOrders.get(razorpay_order_id)?.userId || "";
  const token = mintActivationToken(sku, razorpay_order_id, razorpay_payment_id, orderUserId);

  // DB mode: record the captured payment immediately (source=verify) so the
  // subscription is granted server-side even if the browser never redeems the
  // token (audit M7's browser-independence). Webhooks remain the backstop.
  // P0-10: consume the coupon exactly once — only when this payment applies
  // for the first time (duplicate verify retries must not burn uses).
  if (dbEnabled && !simulatePayments) {
    try {
      const out = await domain.recordCapturedPayment({
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        userId: req.user?.id ?? null,
        sku,
        amountPaise: boundOrder?.amount_paise ?? null,
        source: "verify",
      });
      if (out.result === "applied" && out.userId && out.sku) {
        const rank = (s) => MEMBERSHIP_SKUS.indexOf(s);
        const current = entitlements[out.userId];
        if (!current || (rank(out.sku) !== -1 && rank(out.sku) >= rank(current.sku))) {
          entitlements[out.userId] = {
            sku: out.sku,
            activatedAt: new Date().toISOString(),
            paymentId: razorpay_payment_id,
          };
          persistEntitlements();
        }
      }
      // Audit H-15: the coupon pool counter is advanced inside
      // domain.recordCapturedPayment (payment-idempotent transaction), so no
      // separate consumption call is needed here.
    } catch (err) {
      console.error(JSON.stringify({ level: "error", msg: "verify_grant_failed", error: String(err) }));
    }
  }

  res.json({
    verified: true,
    simulated: simulatePayments,
    paymentId: razorpay_payment_id,
    activation: { token, sku, expiresAt: Date.now() + ACTIVATION_TTL_MS },
  });
}));

// ---------------------------------------------------------------------------
// Redeem an entitlement token (single-use). The frontend activates a plan ONLY
// through this endpoint. When the request is authenticated, the entitlement is
// persisted to the user's account (server-side source of truth).
// ---------------------------------------------------------------------------
app.post("/api/razorpay/redeem", async (req, res) => {
  if (await rateLimited(req)) return res.status(429).json({ error: "Too many requests." });

  const { token } = req.body || {};
  const parsed = verifyActivationToken(token);
  if (!parsed) {
    return res.status(400).json({ error: "Invalid or expired activation token." });
  }
  // Never consume a paid token while signed out: the entitlement would be
  // burned with no account to attach it to and no retry path (H4).
  if (!req.user) {
    return res.status(401).json({ error: "Sign in to activate your purchase." });
  }
  if (parsed.userId && parsed.userId !== req.user.id) {
    return res.status(403).json({ error: "This activation token was issued to a different account." });
  }
  // Audit M3: single-use is DURABLE in DB mode (token hash keyed PK) so a
  // spent token stays spent across restarts and across replica instances. The
  // in-memory Set is retained only for the legacy JSON-store mode (dev/test);
  // DB is always the source of truth before we grant anything.
  if (dbEnabled) {
    try {
      const tokenHash = sha256(token);
      const spent = await query(`SELECT 1 FROM redeemed_tokens WHERE token_hash = $1`, [tokenHash]);
      if (spent.rowCount > 0) {
        return res.status(409).json({ error: "This activation token has already been used." });
      }
      // Reserve under the hash PK. ON CONFLICT DO NOTHING never throws, so the
      // rowCount check is the race backstop: the loser of a concurrent double
      // redeem gets rowCount 0 and is rejected as a duplicate (C1).
      const reserve = await query(
        `INSERT INTO redeemed_tokens (token_hash, sku) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING token_hash`,
        [tokenHash, parsed.sku]
      );
      if (reserve.rowCount === 0) {
        return res.status(409).json({ error: "This activation token has already been used." });
      }
      
      // recordCapturedPayment is idempotent on paymentId: verify/webhook/redeem
      // share the same gate, so only the first path gets 'applied'. Coupon
      // consumption below is gated on that (H2) to avoid burning 3 uses.
      const redeemGrant = await domain.recordCapturedPayment({
        paymentId: parsed.paymentId,
        orderId: parsed.orderId,
        userId: req.user.id,
        sku: parsed.sku,
        amountPaise: null,
        source: "redeem",
      });
      // Stash for the coupon step below: only consume when this redeem was the
      // first to apply the payment.
      req._redeemApplied = redeemGrant?.result === "applied";

      // Audit M-4: automatically mint and persist the sequential GST invoice on
      // redemption so Account -> Invoices & Receipts (GET /api/invoices) is
      // populated immediately without requiring a separate manual call.
      try {
        await ensureDbInvoice({
          tokenHash,
          parsed,
          userId: req.user.id,
          doctorName: `${mayUseDrTitle(req.user) ? "Dr. " : ""}${req.user.firstName || ""} ${req.user.lastName || ""}`.trim() || null,
        });
      } catch (invErr) {
        console.error(JSON.stringify({ level: "error", msg: "auto_invoice_failed", error: String(invErr) }));
      }
    } catch (err) {
      console.error(JSON.stringify({ level: "error", msg: "redeem_token_reserve_error", error: String(err) }));
      return res.status(500).json({ error: "Internal server error." });
    }
  } else if (redeemedTokens.has(token)) {
    return res.status(409).json({ error: "This activation token has already been used." });
  } else {
    rememberUsed(redeemedTokens, token);
  }

  // Persist for the signed-in user. Memberships upgrade idempotently among
  // themselves; consultations are a separate product and never overwrite a
  // membership, and a membership always wins over a prior consultation (H3).
  const isMembership = membershipRank(parsed.sku) !== -1;
  // H-5: in DB mode the SOURCE OF TRUTH for "current plan" is the
  // subscriptions table (window-extension semantics live there via
  // recordCapturedPayment). Ranking the display mirror against itself could
  // disagree with billing reality (e.g. equal-rank repurchase extended in the
  // DB but "downgraded-looking" here). DB truth wins whenever available.
  let current = entitlements[req.user.id];
  let currentIsMembership = current ? membershipRank(current.sku) !== -1 : false;
  if (dbEnabled) {
    try {
      const truthSku = await domain.getActiveMembershipSku(req.user.id);
      if (truthSku) {
        current = { sku: truthSku };
        currentIsMembership = true;
      } else {
        current = undefined;
        currentIsMembership = false;
      }
    } catch (err) {
      console.error(JSON.stringify({ level: "error", msg: "redeem_truth_lookup_failed", error: String(err) }));
    }
  }
  if (isMembership) {
    const currentRank = currentIsMembership ? membershipRank(current.sku) : -1;
    if (!current || !currentIsMembership || membershipRank(parsed.sku) >= currentRank) {
      entitlements[req.user.id] = {
        sku: parsed.sku,
        activatedAt: new Date().toISOString(),
        paymentId: parsed.paymentId,
      };
      persistEntitlements();
    }
  } else if (!currentIsMembership) {
    entitlements[req.user.id] = {
      sku: parsed.sku,
      activatedAt: new Date().toISOString(),
      paymentId: parsed.paymentId,
    };
    persistEntitlements();
  }
  // Audit H-15: the coupon pool counter is advanced inside
  // domain.recordCapturedPayment, which is idempotent per payment id — so a
  // single payment can never burn more than one coupon use, whichever of the
  // verify / webhook / redeem paths applies it first. The old block ticked it
  // from here as well, so one payment burned up to three coupon uses.
  res.json({ plan: parsed.sku });
});

// ---------------------------------------------------------------------------
// GST invoicing metadata (India — 18% GST split into CGST/SGST). All math in
// integer paise so subtotal + CGST + SGST always sums exactly to the total.
// Requires a valid (not-yet-redeemed) activation token.
// ---------------------------------------------------------------------------
const SKU_DISPLAY_NAMES = {
  "premium": "Premium Membership (Monthly)",
  "premium-annual": "Premium Membership (Annual)",
  "platinum": "Platinum Membership (Monthly)",
  "platinum-annual": "Platinum Membership (Annual)",
  "astrologer-consultation": "Astrology Consultation",
  "astrologer-consultation-1499": "Astrology Consultation (Essential)",
  "astrologer-consultation-1699": "Astrology Consultation (Classic)",
  "astrologer-consultation-1999": "Astrology Consultation (Expert)",
  "kundali-report": "Detailed Kundali Match Report",
};

async function resolveAuthoritativePaymentPaise(parsed) {
  let capturedPaise = null;
  if (dbEnabled && parsed?.paymentId) {
    try {
      // Audit C-3 FIX: payment_transactions PK is payment_id, NOT razorpay_payment_id.
      const paymentRow = await query(
        `SELECT amount_paise FROM payment_transactions WHERE payment_id = $1`,
        [parsed.paymentId]
      );
      if (paymentRow.rows[0] && Number(paymentRow.rows[0].amount_paise) > 0) {
        capturedPaise = Number(paymentRow.rows[0].amount_paise);
      }
    } catch {}
  }
  let orderPaise = null;
  if (parsed?.orderId) {
    if (dbEnabled) {
      try {
        const ord = await domain.getOrder(parsed.orderId);
        if (ord && Number(ord.amount_paise) > 0) {
          orderPaise = Number(ord.amount_paise);
        }
      } catch {}
    }
    if (orderPaise === null) {
      const memOrder = liveOrders.get(parsed.orderId) || simOrders.get(parsed.orderId);
      if (memOrder && Number(memOrder.amount) > 0) {
        orderPaise = Number(memOrder.amount);
      }
    }
  }
  return { capturedPaise, orderPaise, authoritativePaise: capturedPaise ?? orderPaise };
}

async function ensureDbInvoice({ tokenHash, parsed, userId = null, doctorName = null, gstin = null, billingAddress = null, fallbackPaise = null }) {
  const { authoritativePaise } = await resolveAuthoritativePaymentPaise(parsed);
  const catalogDefaultPaise = (PLAN_CATALOG[parsed.sku]?.[0] || 0) * 100;
  const totalPaise = authoritativePaise ?? fallbackPaise ?? catalogDefaultPaise;
  if (!totalPaise || totalPaise <= 0) return null;
  const basePaise = Math.round(totalPaise / 1.18);
  const gstPaise = totalPaise - basePaise;
  const istToday = istDateString();
  const seqYear = Number(istToday.slice(0, 4));

  return withTx(async (client) => {
    // Audit X2: the invoice identity is the PAYMENT, not the activation token.
    // verify-payment can be replayed for the same (order, payment, signature)
    // and mints a fresh token each time (its payload embeds an expiry), so
    // keying only on token_hash let one payment allocate several sequential GST
    // invoice numbers. The advisory lock serialises concurrent attempts for the
    // same payment so the check-then-allocate cannot burn a sequence number;
    // uq_invoices_payment is the durable backstop.
    if (parsed.paymentId) {
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
        `invoice:${parsed.paymentId}`,
      ]);
      const byPayment = await client.query(`SELECT * FROM invoices WHERE payment_id = $1`, [parsed.paymentId]);
      if (byPayment.rowCount > 0) {
        const found = byPayment.rows[0];
        if (doctorName || gstin || billingAddress || userId || parsed.userId) {
          const upd = await client.query(
            `UPDATE invoices
                SET doctor_name = COALESCE($2, doctor_name),
                    gstin = COALESCE($3, gstin),
                    billing_address = COALESCE($4, billing_address),
                    user_id = COALESCE(user_id, $5)
              WHERE id = $1
              RETURNING *`,
            [found.id, doctorName ? String(doctorName).slice(0, 120) : null, gstin ? String(gstin).slice(0, 30) : null, billingAddress ? String(billingAddress).slice(0, 200) : null, userId || parsed.userId || null]
          );
          return upd.rows[0] || found;
        }
        return found;
      }
    }
    const existing = await client.query(`SELECT * FROM invoices WHERE token_hash = $1`, [tokenHash]);
    if (existing.rowCount > 0) {
      if (doctorName || gstin || billingAddress) {
        const upd = await client.query(
          `UPDATE invoices
              SET doctor_name = COALESCE($2, doctor_name),
                  gstin = COALESCE($3, gstin),
                  billing_address = COALESCE($4, billing_address),
                  user_id = COALESCE(user_id, $5)
            WHERE token_hash = $1
            RETURNING *`,
          [tokenHash, doctorName ? String(doctorName).slice(0, 120) : null, gstin ? String(gstin).slice(0, 30) : null, billingAddress ? String(billingAddress).slice(0, 200) : null, userId || parsed.userId || null]
        );
        return upd.rows[0] || existing.rows[0];
      }
      return existing.rows[0];
    }
    const seqRes = await client.query(
      `INSERT INTO invoice_sequences (year, next_n) VALUES ($1, 2)
       ON CONFLICT (year) DO UPDATE SET next_n = invoice_sequences.next_n + 1
       RETURNING (invoice_sequences.next_n - 1) AS n`,
      [seqYear]
    );
    const assignedSeq = Number(seqRes.rows[0]?.n || 1);
    const invNumber = `MM-INV-${seqYear}-${String(assignedSeq).padStart(6, "0")}`;
    const ins = await client.query(
      `INSERT INTO invoices (invoice_number, user_id, payment_id, token_hash, sku, amount_paise, gst_paise, doctor_name, gstin, billing_address)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT DO NOTHING
       RETURNING *`,
      [
        invNumber,
        userId || parsed.userId || null,
        parsed.paymentId,
        tokenHash,
        parsed.sku,
        totalPaise,
        gstPaise,
        doctorName ? String(doctorName).slice(0, 120) : null,
        gstin ? String(gstin).slice(0, 30) : null,
        billingAddress ? String(billingAddress).slice(0, 200) : null,
      ]
    );
    if (ins.rowCount === 0) {
      // Lost a race (or a legacy row already holds this payment id) — return the
      // winner's invoice rather than allocating a second number for one payment.
      const winner = parsed.paymentId
        ? await client.query(`SELECT * FROM invoices WHERE payment_id = $1`, [parsed.paymentId])
        : await client.query(`SELECT * FROM invoices WHERE token_hash = $1`, [tokenHash]);
      if (winner.rowCount > 0) return winner.rows[0];
      throw new Error("Invoice could not be created.");
    }
    return ins.rows[0];
  });
}

app.post("/api/generate-invoice", async (req, res) => {
  if (await rateLimited(req)) return res.status(429).json({ error: "Too many requests." });

  const { planName, amount, doctorName, gstin, billingAddress, token } = req.body || {};

  const parsed = verifyActivationToken(token);
  if (!parsed) {
    return res
      .status(400)
      .json({ error: "Invoices are only generated for verified payments." });
  }

  const tokenHash = sha256(token);
  const { authoritativePaise } = await resolveAuthoritativePaymentPaise(parsed);

  if (!dbEnabled && generatedInvoices.has(token)) {
    return res.json(generatedInvoices.get(token));
  }

  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: "A positive amount is required." });
  }

  // Audit C-3 / M-2 FIX: when a captured payment or server-issued order exists,
  // its recorded amount is the sole authority and overrides any forged client
  // amount (so neither amount=1 nor inflating a discounted ₹1,349 coupon order
  // to ₹1,499 can alter the GST invoice total). When no server order/payment
  // record exists (stateless fallback), the caller amount must match catalog.
  const allowedAmounts = PLAN_CATALOG[parsed.sku] || [];
  const isAllowed =
    authoritativePaise !== null ||
    allowedAmounts.includes(Math.round(amount));

  if (!isAllowed) {
    return res.status(400).json({ error: "Invoice amount does not match the purchased plan." });
  }

  const totalPaise = authoritativePaise !== null ? authoritativePaise : Math.round(amount * 100);
  const basePaise = Math.round(totalPaise / 1.18);
  const gstPaise = totalPaise - basePaise;
  const cgstPaise = Math.ceil(gstPaise / 2);
  const sgstPaise = gstPaise - cgstPaise;
  const paiseToRupees = (p) => Number((p / 100).toFixed(2));

  // Sequential invoice number, persisted in Postgres (audit M-2) in DB mode
  // and in invoice_seq.json in test/dev mode. Year rolls over with the IST calendar year.
  const istToday = istDateString();
  const seqYear = Number(istToday.slice(0, 4));

  const officialPlanName = SKU_DISPLAY_NAMES[parsed.sku] || (planName ? String(planName).slice(0, 100) : "MedicoMatch Membership");

  let outInvoice = null;

  if (dbEnabled) {
    try {
      const invRow = await ensureDbInvoice({
        tokenHash,
        parsed,
        userId: req.user?.id || parsed.userId || null,
        doctorName: doctorName || null,
        gstin: gstin || null,
        billingAddress: billingAddress || null,
        fallbackPaise: totalPaise,
      });
      if (invRow) {
        const bPaise = Math.round(invRow.amount_paise / 1.18);
        const gPaise = invRow.amount_paise - bPaise;
        const cPaise = Math.ceil(gPaise / 2);
        const sPaise = gPaise - cPaise;
        outInvoice = {
          invoiceNumber: invRow.invoice_number,
          date: istDateString(new Date(invRow.issued_at || Date.now())),
          planName: officialPlanName,
          doctorName: invRow.doctor_name || "Doctor User",
          gstin: invRow.gstin || "Not provided",
          billingAddress: invRow.billing_address || "India",
          subtotal: Number((bPaise / 100).toFixed(2)),
          cgst: Number((cPaise / 100).toFixed(2)),
          sgst: Number((sPaise / 100).toFixed(2)),
          total: Number((invRow.amount_paise / 100).toFixed(2)),
          status: "PAID",
        };
      }
    } catch (err) {
      console.error(JSON.stringify({ level: "error", msg: "invoice_db_tx_failed", error: String(err) }));
      return res.status(500).json({ error: "Failed to allocate invoice sequence from database." });
    }
  }

  if (!outInvoice) {
    if (dbEnabled) {
      return res.status(500).json({ error: "Failed to allocate invoice sequence from database." });
    }
    if (invoiceSeq.year !== seqYear) {
      invoiceSeq = { year: seqYear, n: 0 };
    }
    invoiceSeq.n += 1;
    writeJson(INVOICE_SEQ_FILE, invoiceSeq);
    const seqNumber = invoiceSeq.n;

    outInvoice = {
      invoiceNumber: `MM-INV-${seqYear}-${String(seqNumber).padStart(6, "0")}`,
      date: istToday,
      planName: officialPlanName,
      doctorName: doctorName ? String(doctorName).slice(0, 120) : "Doctor User",
      gstin: gstin ? String(gstin).slice(0, 30) : "Not provided",
      billingAddress: billingAddress ? String(billingAddress).slice(0, 200) : "India",
      subtotal: paiseToRupees(basePaise),
      cgst: paiseToRupees(cgstPaise),
      sgst: paiseToRupees(sgstPaise),
      total: paiseToRupees(totalPaise),
      status: "PAID",
    };
    generatedInvoices.set(token, outInvoice);
  }

  res.json(outInvoice);
});

// ---------------------------------------------------------------------------
// Wired product APIs (DB mode). Every route requires a real session; every
// query is scoped by req.user.id. In non-DB mode these return 503 so the SPA
// can fall back to demo behaviour.
// ---------------------------------------------------------------------------
const requireDbUser = (req, res, next) => {
  if (!dbEnabled) return res.status(503).json({ error: "Database not configured on this server." });
  if (!req.user) return res.status(401).json({ error: "Not authenticated." });
  next();
};

app.get("/api/invoices", requireDbUser, wrap(async (req, res) => {
  const invs = await query(
    `SELECT invoice_number, issued_at, sku, amount_paise, gst_paise, doctor_name, gstin, billing_address
     FROM invoices WHERE user_id = $1 ORDER BY issued_at DESC LIMIT 50`,
    [req.user.id]
  );
  res.json({
    invoices: invs.rows.map((inv) => ({
      invoiceNumber: inv.invoice_number,
      date: istDateString(new Date(inv.issued_at)),
      planName: inv.sku,
      amount: inv.amount_paise / 100,
      total: inv.amount_paise / 100,
      status: "PAID",
    })),
  });
}));

// ---------------------------------------------------------------------------
// Item 6: DPDP Act rights — data export + account deletion.
//
// Both routes require an authenticated session (cookie or Bearer). The
// delete route additionally requires the user's CURRENT password to
// authenticate the destructive intent.
// ---------------------------------------------------------------------------
app.get("/api/me/export", requireDbUser, wrap(async (req, res) => {
  const data = await domain.exportMyData(req.user.id);
  res.setHeader("Content-Disposition", `attachment; filename="medicomatch-export-${req.user.id}.json"`);
  res.json(data);
}));

app.post("/api/me/delete", rateLimitMiddleware, requireDbUser, wrap(async (req, res) => {
  const { currentPassword } = req.body || {};
  if (typeof currentPassword !== "string" || !currentPassword) {
    return res.status(400).json({ error: "Current password is required to confirm deletion." });
  }
  const u = users[req.user.id];
  if (!u) return res.status(404).json({ error: "User not found." });
  if (!verifyPassword(currentPassword, u.salt, u.hash)) {
    return res.status(401).json({ error: "Current password is incorrect." });
  }
  const out = await domain.deleteMyAccount(req.user.id);
  delete users[req.user.id];
  persistUsers();
  delete entitlements[req.user.id];
  persistEntitlements();
  invalidateAdminFlagCache(req.user.id);
  clearSessionCookie(res);
  setCsrfCookie(res, issueCsrfToken());
  await domain.writeAudit(req.user.id, "user.delete_self", req.user.id, "");
  // Audit M6: the account is gone — do not keep its address in the log stream.
  console.log(JSON.stringify({ level: "info", msg: "user_deleted", userId: req.user.id }));
  res.json({ ok: true, tombstoneEmail: out.tombstoneEmail });
}));

app.get("/api/quota", requireDbUser, wrap(async (req, res) => {
  res.json(await domain.getQuotaSummary(req.user.id));
}));

app.get("/api/profiles", requireDbUser, requireVerifiedInteract, wrap(async (req, res) => {
  // H1: the route previously dropped every advanced filter the UI sends —
  // domain.browseProfiles already supports them. Accept canonical + short
  // aliases used by Search/Matches (rel, mt, ori, eth, gunas) so SQL filtering
  // matches what the user picked instead of silently returning unfiltered rows.
  const str = (v) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 80) : undefined);
  const num = (v) => (/^\d+$/.test(String(v || "")) ? Number(v) : undefined);
  // H-NEW-1: clamp limit + offset BEFORE the budget check so the budget sees
  // the same number of rows we'll actually return.
  const limit = Math.min(Math.max(Number(req.query.limit) || 60, 1), 200);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  // Admins bypass the daily scrape budget (moderation / support flow).
  if (!req.isAdmin && (await browseOverBudget(req.user.id, limit))) {
    return res.status(429).json({
      error: "Daily browse limit reached. Try again tomorrow or contact support.",
      code: "browse_budget",
    });
  }
  const profiles = await domain.browseProfiles({
    viewerId: req.user.id,
    city: str(req.query.city),
    specialty: str(req.query.specialty),
    q: typeof req.query.q === "string" && req.query.q.trim() ? req.query.q.trim().slice(0, 100) : undefined,
    minAge: num(req.query.min),
    maxAge: num(req.query.max),
    verifiedOnly: req.query.verified === "1",
    religion: str(req.query.religion ?? req.query.rel),
    caste: str(req.query.caste ?? req.query.cast),
    motherTongue: str(req.query.motherTongue ?? req.query.mt),
    gotra: str(req.query.gotra),
    orientation: str(req.query.orientation ?? req.query.ori),
    ethnicity: str(req.query.ethnicity ?? req.query.eth),
    minGunas: num(req.query.minGunas ?? req.query.gunas),
    familyType: str(req.query.familyType),
    familyStatus: str(req.query.familyStatus),
    incomeBand: str(req.query.incomeBand),
    diet: str(req.query.diet),
    limit,
    offset,
  });
  res.json({ profiles });
}));

app.get("/api/profiles/:id", requireDbUser, requireVerifiedInteract, wrap(async (req, res) => {
  const profile = await domain.getProfile(req.params.id, req.user?.id);
  if (!profile) return res.status(404).json({ error: "Profile not found." });
  res.json({ profile });
}));

app.get("/api/me/profile", requireDbUser, wrap(async (req, res) => {
  res.json({ profile: await domain.getMyProfile(req.user.id) });
}));

app.put("/api/me/profile", rateLimitMiddleware, requireDbUser, wrap(async (req, res) => {
  const profile = await domain.upsertMyProfile(req.user.id, req.user, req.body || {});
  res.json({ profile });
}));

app.get("/api/interests", requireDbUser, wrap(async (req, res) => {
  res.json(await domain.listMyInterests(req.user.id));
}));

app.post("/api/interests", rateLimitMiddleware, requireDbUser, requireVerifiedInteract, wrap(async (req, res) => {
  const { profileId, note } = req.body || {};
  if (typeof profileId !== "string" || !profileId) {
    return res.status(400).json({ error: "profileId is required." });
  }
  const out = await domain.sendInterest(req.user.id, profileId, note);
  res.status(out.alreadyInterested ? 200 : 201).json(out);
}));

app.post("/api/interests/:id/respond", rateLimitMiddleware, requireDbUser, wrap(async (req, res) => {
  const action = String(req.body?.action || "");
  if (!["accept", "decline"].includes(action)) {
    return res.status(400).json({ error: "action must be accept or decline." });
  }
  res.json(await domain.respondToInterest(req.user.id, req.params.id, action));
}));

app.delete("/api/interests/:id", rateLimitMiddleware, requireDbUser, wrap(async (req, res) => {
  res.json(await domain.withdrawInterest(req.user.id, req.params.id));
}));

app.get("/api/favorites", requireDbUser, wrap(async (req, res) => {
  res.json({ favorites: await domain.listFavorites(req.user.id) });
}));

app.post("/api/favorites", rateLimitMiddleware, requireDbUser, wrap(async (req, res) => {
  const { profileId } = req.body || {};
  if (typeof profileId !== "string" || !profileId) return res.status(400).json({ error: "profileId is required." });
  res.json(await domain.addFavorite(req.user.id, profileId));
}));

app.delete("/api/favorites/:profileId", rateLimitMiddleware, requireDbUser, wrap(async (req, res) => {
  res.json(await domain.removeFavorite(req.user.id, req.params.profileId));
}));

app.get("/api/shortlists", requireDbUser, wrap(async (req, res) => {
  res.json({ shortlists: await domain.listShortlists(req.user.id) });
}));

app.post("/api/shortlists", rateLimitMiddleware, requireDbUser, wrap(async (req, res) => {
  const { profileId } = req.body || {};
  if (typeof profileId !== "string" || !profileId) return res.status(400).json({ error: "profileId is required." });
  res.json(await domain.addShortlist(req.user.id, profileId));
}));

app.delete("/api/shortlists/:profileId", rateLimitMiddleware, requireDbUser, wrap(async (req, res) => {
  res.json(await domain.removeShortlist(req.user.id, req.params.profileId));
}));

app.get("/api/channels", requireDbUser, wrap(async (req, res) => {
  res.json({ channels: await domain.listChannels(req.user.id) });
}));

app.get("/api/channels/:id/messages", requireDbUser, wrap(async (req, res) => {
  // M7: forward the caller's limit instead of always using the 100 default.
  res.json({ messages: await domain.listMessages(req.user.id, req.params.id, req.query.limit) });
}));

app.post("/api/channels/:id/messages", rateLimitMiddleware, requireDbUser, requireVerifiedInteract, wrap(async (req, res) => {
  res.status(201).json(await domain.sendMessage(req.user.id, req.params.id, req.body?.body));
}));

app.get("/api/video-dates", requireDbUser, wrap(async (req, res) => {
  res.json({ videoDates: await domain.listVideoDates(req.user.id) });
}));

app.post("/api/video-dates", rateLimitMiddleware, requireDbUser, requireVerifiedInteract, wrap(async (req, res) => {
  const { profileId, scheduledFor, durationMinutes } = req.body || {};
  if (typeof profileId !== "string" || !profileId || !scheduledFor) {
    return res.status(400).json({ error: "profileId and scheduledFor are required." });
  }
  res.status(201).json(await domain.createVideoDate(req.user.id, profileId, scheduledFor, durationMinutes));
}));

app.post("/api/video-dates/:id/cancel", rateLimitMiddleware, requireDbUser, wrap(async (req, res) => {
  res.json(await domain.cancelVideoDate(req.user.id, req.params.id));
}));

app.post("/api/video-dates/:id/respond", rateLimitMiddleware, requireDbUser, wrap(async (req, res) => {
  const action = String(req.body?.action || "");
  if (!["accept", "decline"].includes(action)) {
    return res.status(400).json({ error: "action must be accept or decline." });
  }
  res.json(await domain.respondVideoDate(req.user.id, req.params.id, action));
}));

app.get("/api/blocks", requireDbUser, wrap(async (req, res) => {
  res.json({ blocked: await domain.listBlocks(req.user.id) });
}));

app.post("/api/blocks", rateLimitMiddleware, requireDbUser, wrap(async (req, res) => {
  const { userId, profileId } = req.body || {};
  const target = (typeof userId === "string" && userId) || (typeof profileId === "string" && profileId) || "";
  if (!target) return res.status(400).json({ error: "userId or profileId is required." });
  res.json(await domain.blockUser(req.user.id, target, typeof profileId === "string" ? profileId : null));
}));

app.post("/api/blocks/unblock", rateLimitMiddleware, requireDbUser, wrap(async (req, res) => {
  const { userId, profileId } = req.body || {};
  const target = (typeof userId === "string" && userId) || (typeof profileId === "string" && profileId) || "";
  if (!target) return res.status(400).json({ error: "userId or profileId is required." });
  res.json(await domain.unblockUser(req.user.id, target, typeof profileId === "string" ? profileId : null));
}));

app.post("/api/reports", rateLimitMiddleware, requireDbUser, wrap(async (req, res) => {
  const { profileId, reason, details } = req.body || {};
  if (typeof profileId !== "string" || !profileId) return res.status(400).json({ error: "profileId is required." });
  res.status(201).json(await domain.reportUser(req.user.id, profileId, reason, details));
}));

app.post("/api/contact-reveal", rateLimitMiddleware, requireDbUser, requireVerifiedInteract, wrap(async (req, res) => {
  const { profileId } = req.body || {};
  if (typeof profileId !== "string" || !profileId) return res.status(400).json({ error: "profileId is required." });
  res.json(await domain.revealContact(req.user.id, profileId));
}));

// ---------------------------------------------------------------------------
// Support inbox (M6): the Help contact form previously saved to localStorage
// only — nobody read it. Anonymous, rate-limited, and delivered via the same
// Resend transport as verify/reset mail so prod has a real support path.
// ---------------------------------------------------------------------------
app.post("/api/support", rateLimitMiddleware, wrap(async (req, res) => {
  const { name, email, subject, message } = req.body || {};
  if (typeof name !== "string" || !name.trim() || typeof email !== "string" || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: "A valid name and email are required." });
  }
  if (typeof message !== "string" || !message.trim() || message.trim().length < 10) {
    return res.status(400).json({ error: "Please describe your issue (min 10 characters)." });
  }
  const to = process.env.SUPPORT_EMAIL || process.env.EMAIL_FROM || "MedicoMatch <no-reply@medicomatch.in>";
  try {
    await sendEmail({
      to,
      subject: `[Support] ${String(subject || "Help request").slice(0, 120)} — ${name.trim().slice(0, 80)}`,
      text: `From: ${name.trim().slice(0, 80)} <${email.trim().toLowerCase()}>\nUser: ${req.user?.id ?? "guest"}\n\n${message.trim().slice(0, 4000)}`,
    });
  } catch {
    return res.status(503).json({ error: "Support is unavailable right now. Please email us directly." });
  }
  res.json({ ok: true });
}));

// ---------------------------------------------------------------------------
// Launch-gap fix #5: member-facing refund request. Delivered to SUPPORT_EMAIL
// (defaults to the sender address). SAFE DEFAULT: this is an ADVISORY ticket —
// approval & execution still flow through the admin refund endpoints / Razorpay
// dashboard webhook revocation. Never auto-refunds.
// ---------------------------------------------------------------------------
app.post("/api/refund-request", rateLimitMiddleware, requireDbUser, wrap(async (req, res) => {
  const reason = String(req.body?.reason || "").trim();
  if (!reason) return res.status(400).json({ error: "Please tell us why you are requesting a refund." });
  if (reason.length < 10) {
    return res.status(400).json({ error: "Please describe the reason (min 10 characters)." });
  }
  let ctx;
  try {
    ctx = await domain.requestRefund(req.user.id, reason);
  } catch {
    return res.status(503).json({ error: "Refund requests are unavailable right now. Email us directly." });
  }
  if (!ctx?.ok) return res.status(404).json({ error: "Account not found." });
  const to = process.env.SUPPORT_EMAIL || process.env.EMAIL_FROM || "MedicoMatch <no-reply@medicomatch.in>";
  try {
    await sendEmail({
      to,
      subject: `[Refund request] ${ctx.name || ctx.email || req.user.id}`,
      text:
        `Refund request from ${ctx.name || "Member"} <${ctx.email}>` +
        `\nUser id: ${req.user.id}` +
        `\nLast plan: ${ctx.lastSku || "none"}` +
        (ctx.periodEnd ? `\nPeriod end: ${new Date(ctx.periodEnd).toISOString()}` : "") +
        `\nPayments on account: ${ctx.paymentsCount}` +
        `\n\nReason: ${ctx.reason}`,
    });
  } catch {
    return res.status(503).json({ error: "Refund requests are unavailable right now. Email us directly." });
  }
  res.json({ ok: true, message: "Your refund request has been sent. Our billing team will reach out within 2 business days." });
}));

// ---------------------------------------------------------------------------
// Parity increment (rival Shaadi): trust (OTP + verification queue), daily
// matches, events/stories, boost/coupons, read receipts, renewal reminders.
// All DB-mode; 503 without DATABASE_URL so the SPA falls back to demo.
// ---------------------------------------------------------------------------

// P0-1 phone OTP. Delivery: MSG91/Twilio hook when configured, else the code
// is emailed to the account address (documented fallback for launch; set an
// SMS provider for true mobile possession). Test mode returns the code.
// ---------------------------------------------------------------------------
// Kundali match report (REPORTS_ENABLED). Buyer-pays: purchase via the normal
// create-order -> verify -> redeem path with sku 'kundali-report', then the
// report is generated server-side and stored per (buyer, profile).
// ---------------------------------------------------------------------------
app.post("/api/kundali/report", rateLimitMiddleware, requireDbUser, requireVerifiedInteract, wrap(async (req, res) => {
  if (!REPORTS_ENABLED) return res.status(503).json({ error: "Kundali reports are not enabled on this server." });
  const { profileId } = req.body || {};
  if (typeof profileId !== "string" || !profileId) return res.status(400).json({ error: "profileId is required." });
  // Purchase + generate. POST is covered by the CSRF guard.
  res.json(await domain.getKundaliReport(req.user.id, profileId));
}));

// Audit M-31: this GET performed a PAID WRITE — it inserted the
// `kundali_reports` row, decremented `subscriptions.credits_remaining` and
// flipped the subscription to 'expired'. The CSRF guard skips GET/HEAD/OPTIONS
// and production sets SameSite=None on the session cookie (so the cookie IS
// attached to a cross-site GET), which meant any third-party page containing
// `<img src=".../api/kundali/report/<profileId>">` burned the victim's ₹499
// credit. The victim saw no report and lost the entitlement.
//
// A GET must never have side effects, so this route is now READ-ONLY: it
// returns a report the buyer already owns, and answers 402 when they have not
// purchased one. Generation happens on the POST route above.
app.get("/api/kundali/report/:profileId", requireDbUser, requireVerifiedInteract, wrap(async (req, res) => {
  if (!REPORTS_ENABLED) return res.status(503).json({ error: "Kundali reports are not enabled on this server." });
  const stored = await domain.readKundaliReport(req.user.id, req.params.profileId);
  if (!stored) {
    return res.status(402).json({
      error: "Purchase the Detailed Kundali Match Report to view this breakdown.",
      code: "purchase_required",
      sku: "kundali-report",
    });
  }
  res.json(stored);
}));

// ---------------------------------------------------------------------------
// SMS delivery (MSG91). Wired to the real provider API when SMS_PROVIDER and
// the key are configured; otherwise the existing EMAIL fallback carries the
// code. The OTP model is unchanged: hashed at rest, 10-min TTL, 5 attempts.
// ---------------------------------------------------------------------------
const MSG91_ENDPOINT = "https://api.msg91.com/api/v5/otp";
async function sendOtpSms(phone, code) {
  const provider = String(process.env.SMS_PROVIDER || "").trim().toLowerCase();
  const key = process.env.MSG91_API_KEY || "";
  if (provider !== "msg91" || !key) return { sent: false, provider: "none" };
  // MSG91 expects the country code without '+'; Indian numbers default to 91.
  const mobile = String(phone).replace(/[^\d]/g, "");
  const withCc = mobile.length === 10 ? `91${mobile}` : mobile;
  try {
    const res = await fetch(`${MSG91_ENDPOINT}?otp=${encodeURIComponent(code)}&mobile=${encodeURIComponent(withCc)}`, {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
      headers: { authkey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ otp: code, mobile: withCc }),
    });
    if (!res.ok) {
      console.error(JSON.stringify({ level: "error", msg: "sms_send_failed", provider: "msg91", status: res.status }));
      return { sent: false, provider: "msg91" };
    }
    return { sent: true, provider: "msg91" };
  } catch (err) {
    console.error(JSON.stringify({ level: "error", msg: "sms_send_failed", provider: "msg91", error: String(err) }));
    return { sent: false, provider: "msg91" };
  }
}

app.post("/api/phone/request", rateLimitMiddleware, requireDbUser, wrap(async (req, res) => {
  const { phone } = req.body || {};
  const out = await domain.requestPhoneOtp(req.user.id, phone);
  // SMS first (when configured); on provider miss the EMAIL fallback carries
  // the code so the member is never stranded. Both paths are structured-logged.
  const sms = await sendOtpSms(phone, out.code);
  const email = req.user?.email || users[req.user.id]?.email || (await query(`SELECT email FROM app_users WHERE id=$1`, [req.user.id])).rows[0]?.email;
  if (!sms.sent && email) {
    sendEmailInBackground({
      to: email,
      subject: "Your MedicoMatch verification code",
      text: `Your verification code is ${out.code}. It expires in 10 minutes. Enter it in the app to verify your number.`,
    });
  }
  console.log(JSON.stringify({ level: "info", msg: "otp_delivery", provider: sms.sent ? "msg91" : "email_fallback", userId: req.user.id }));
  const returnCode = process.env.NODE_ENV === "test" || process.env.NODE_ENV === "development";
  res.json({ ok: true, expiresAt: out.expiresAt, channel: sms.sent ? "sms" : "email", ...(returnCode ? { code: out.code } : {}) });
}));

app.post("/api/phone/verify", rateLimitMiddleware, requireDbUser, wrap(async (req, res) => {
  res.json(await domain.verifyPhoneOtp(req.user.id, req.body?.code));
}));

app.get("/api/phone/status", requireDbUser, wrap(async (req, res) => {
  const r = await query(`SELECT phone, phone_verified FROM app_users WHERE id=$1`, [req.user.id]);
  res.json({ phone: r.rows[0]?.phone ?? null, verified: Boolean(r.rows[0]?.phone_verified) });
}));

// P0-2 verification documents.
app.post("/api/verification/documents", rateLimitMiddleware, requireDbUser, wrap(async (req, res) => {
  const { docType, url } = req.body || {};
  res.status(201).json(await domain.submitVerificationDoc(req.user.id, docType, url));
}));

app.get("/api/verification/me", requireDbUser, wrap(async (req, res) => {
  res.json({ documents: await domain.listMyVerificationDocs(req.user.id) });
}));

// P0-5 daily matches for the signed-in member.
app.get("/api/matches/daily", requireDbUser, wrap(async (req, res) => {
  res.json({ matches: await domain.getDailyMatches(req.user.id, req.query.limit) });
}));

// P0-6 events (public list) + RSVP + admin create.
// If a ticket parameter is present, pass through to the SSE stream handler below.
app.get("/api/events", (req, res, next) => {
  if (req.query.ticket) return next();
  return wrap(async (req, res) => {
    if (!dbEnabled) return res.status(503).json({ error: "Database not configured on this server." });
    res.json({ events: await domain.listEvents() });
  })(req, res, next);
});

app.post("/api/events", rateLimitMiddleware, requireDbUser, requireAdmin, wrap(async (req, res) => {
  res.status(201).json(await domain.createEvent(req.user.id, req.body || {}));
}));

app.post("/api/events/:id/rsvp", rateLimitMiddleware, requireDbUser, wrap(async (req, res) => {
  res.json(await domain.rsvpEvent(req.user.id, req.params.id));
}));

// P0-6 success stories (public approved list) + submit + admin approve.
app.get("/api/stories", wrap(async (req, res) => {
  if (!dbEnabled) return res.status(503).json({ error: "Database not configured on this server." });
  res.json({ stories: await domain.listStories(true) });
}));

app.post("/api/stories", rateLimitMiddleware, requireDbUser, wrap(async (req, res) => {
  res.status(201).json(await domain.submitStory(req.user.id, req.body || {}));
}));

// P0-10 Spotlight boost: paid-member perk (7-day window, rate-limited).
app.post("/api/boost", rateLimitMiddleware, requireDbUser, wrap(async (req, res) => {
  const sku = await domain.getActiveMembershipSku(req.user.id);
  if (!sku) return res.status(402).json({ error: "Spotlight is a paid-member perk. Upgrade to boost your profile." });
  res.json(await domain.grantBoost(req.user.id, 7));
}));

app.get("/api/boost", requireDbUser, wrap(async (req, res) => {
  res.json(await domain.getBoost(req.user.id));
}));

// P0-10 coupon preview (applied for real at create-order).
app.get("/api/coupons/validate", requireDbUser, wrap(async (req, res) => {
  if (dbEnabled) {
    const c = await domain.validateCoupon(String(req.query.code || ""), req.user?.id || null);
    if (!c) return res.status(404).json({ error: "Invalid or expired coupon." });
    return res.json(c);
  }
  const code = String(req.query.code || "").trim().toUpperCase();
  if (code === "WELCOME10") {
    return res.json({ code: "WELCOME10", percentOff: 10 });
  }
  return res.status(404).json({ error: "Invalid or expired coupon." });
}));

// P0-7 read receipts.
app.post("/api/channels/:id/read", rateLimitMiddleware, requireDbUser, wrap(async (req, res) => {
  res.json(await domain.markMessagesRead(req.user.id, req.params.id));
}));

// P0-3 renewal reminders: admin-triggered + daily auto-run (see boot block).
// Sends to subscriptions expiring within `days` (default 3).
app.post("/api/admin/reminders/renewals", rateLimitMiddleware, requireDbUser, requireAdmin, wrap(async (req, res) => {
  const rows = await domain.subscriptionsExpiring(req.body?.days ?? req.query.days ?? 3);
  let sent = 0;
  for (const s of rows) {
    try {
      await sendEmail({
        to: s.email,
        subject: "Your MedicoMatch membership renews soon",
        text: `Your ${s.sku} membership ends on ${new Date(s.expiresAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}. Renew from your Account page to keep unlimited benefits.`,
      });
      await domain.markRenewalNotified(s.userId, s.sku);
      sent++;
    } catch { /* per-recipient failure must not abort the batch */ }
  }
  await domain.writeAudit(req.user.id, "reminders.renewals", "*", `sent=${sent} of ${rows.length}`);
  res.json({ sent, total: rows.length });
}));

// P0-2/P0-8 admin moderation: verification queue + warn/strike ladder.
app.get("/api/admin/verifications", requireDbUser, requireAdmin, wrap(async (req, res) => {
  res.json({ documents: await domain.listPendingVerifications(String(req.query.status || "pending"), req.query.limit) });
}));

app.post("/api/admin/verifications/:id/review", rateLimitMiddleware, requireDbUser, requireAdmin, wrap(async (req, res) => {
  res.json(await domain.reviewVerification(
    req.user.id, req.params.id, req.body?.outcome, req.body?.note,
    req.body?.registryChecked === true, req.body?.registryReference,
  ));
}));

// Audit C-3: the target hierarchy is checked BEFORE the database check, so an
// unauthorised caller is refused with 403 regardless of deployment mode — the
// privilege decision must not depend on whether a database happens to be
// configured. requireDbUser still applies (the strike counter lives in
// app_users), so /warn remains a DB-mode-only action.
app.post("/api/admin/users/:id/warn", rateLimitMiddleware, requireAdmin, requireAdminTargetHierarchy, requireDbUser, wrap(async (req, res) => {
  // Audit C-3: the target hierarchy is enforced by requireAdminTargetHierarchy
  // above. Without it a regular admin could strike a ROOT admin three times
  // and auto-suspend them (killing their sessions) — the 3rd-strike path
  // below is therefore only reachable for a target the caller is allowed to
  // moderate.
  const out = await domain.warnUser(req.user.id, req.params.id, req.body?.reason);
  if (out.autoSuspend) {
    // 3rd strike: suspend canonically (same path as manual suspend).
    const target = req.adminTarget;
    if (target && !target.suspended) {
      target.suspended = true;
      target.tokenVersion = (target.tokenVersion ?? 0) + 1;
      persistUsers();
      if (dbEnabled) {
        try { await query(`UPDATE app_users SET suspended = TRUE, token_version = token_version + 1 WHERE id=$1`, [target.id]); } catch {}
      }
      kickSse(target.id);
    }
  }
  res.json(out);
}));

app.post("/api/admin/stories/:id/approve", rateLimitMiddleware, requireDbUser, requireAdmin, wrap(async (req, res) => {
  res.json(await domain.approveStory(req.user.id, req.params.id, req.body?.approved !== false));
}));

// ---------------------------------------------------------------------------
// Admin / moderation APIs (DB mode). requireAdmin is enforced by the session
// middleware flag; every mutation is audit-logged in admin_audit_log.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Realtime event stream (SSE). Auth via single-use short-lived ticket because
// EventSource cannot set Authorization headers. Heartbeats defeat proxy idle
// timeouts; clients reconnect with a fresh ticket on error.
// ---------------------------------------------------------------------------
const eventTickets = new Map(); // ticket -> { userId, exp }
setInterval(() => {
  const now = Date.now();
  for (const [t, rec] of eventTickets) {
    if (rec.exp <= now) eventTickets.delete(t);
  }
}, 30_000).unref();

app.post("/api/events/ticket", rateLimitMiddleware, (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated." });
  const ticket = crypto.randomBytes(24).toString("hex");
  eventTickets.set(ticket, { userId: req.user.id, exp: Date.now() + 60_000 });
  res.json({ ticket });
});

app.get("/api/events", (req, res) => {
  const ticket = typeof req.query.ticket === "string" ? req.query.ticket : "";
  const rec = eventTickets.get(ticket);
  if (!rec || rec.exp <= Date.now()) {
    return res.status(401).json({ error: "Invalid or expired ticket." });
  }
  eventTickets.delete(ticket); // single-use

  // Audit C3: Instance-wide cap on concurrent SSE streams to prevent FD/memory exhaustion.
  const MAX_GLOBAL_SSE = Math.max(100, Number(process.env.MAX_GLOBAL_SSE_CONNECTIONS) || 5000);
  if (connectionCount() >= MAX_GLOBAL_SSE) {
    return res.status(503).json({ error: "Server connection limit reached. Please retry shortly." });
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", // nginx: don't buffer the stream
  });
  res.write(":connected\n\n");

  const remove = addClient(rec.userId, res);
  const heartbeat = setInterval(() => {
    try {
      res.write(":ping\n\n");
    } catch {
      /* close handler cleans up */
    }
  }, 25_000);
  req.on("close", () => {
    clearInterval(heartbeat);
    remove();
  });
});

// ---------------------------------------------------------------------------
// Billing lifecycle (self-service, professional semantics)
// ---------------------------------------------------------------------------
app.post("/api/billing/cancel", rateLimitMiddleware, requireDbUser, wrap(async (req, res) => {
  res.json(await domain.cancelBilling(req.user.id));
}));

app.post("/api/billing/resume", rateLimitMiddleware, requireDbUser, wrap(async (req, res) => {
  res.json(await domain.resumeBilling(req.user.id));
}));

// ---------------------------------------------------------------------------
// Realtime WebRTC signaling (1:1 calls). Authenticated + channel-gated:
// both parties must share an accepted-interest channel. Payloads are opaque
// SDP/ICE blobs relayed verbatim over SSE to the peer.
// ---------------------------------------------------------------------------
app.post("/api/webrtc/signal", rateLimitMiddleware, requireDbUser, wrap(async (req, res) => {
  const { toUserId, payload } = req.body || {};
  if (typeof toUserId !== "string" || !toUserId || toUserId === req.user.id) {
    return res.status(400).json({ error: "A peer user id is required." });
  }
  if (!payload || typeof payload !== "object") {
    return res.status(400).json({ error: "A signal payload is required." });
  }
  // C2: domain.query / domain.publishToUser never existed (domain.mjs does not
  // re-export them) — every signal 500'd. Use the db query + events hub directly.
  const ch = await query(
    `SELECT c.id FROM channels c
     WHERE ($1 IN (c.user_a, c.user_b)) AND ($2 IN (c.user_a, c.user_b))
       AND NOT EXISTS (
         SELECT 1 FROM blocks b
         WHERE (b.blocker_id = $1 AND b.blocked_id = $2)
            OR (b.blocker_id = $2 AND b.blocked_id = $1)
       )`,
    [req.user.id, toUserId]
  );
  if (ch.rowCount === 0) {
    return res.status(403).json({ error: "You are not connected to this user." });
  }
  publishToUser(toUserId, "webrtc", {
    from: req.user.id,
    fromName: `${req.user.firstName || ""} ${req.user.lastName || ""}`.trim(),
    payload,
  });
  res.json({ sent: true });
}));

// Chat typing indicator: same channel gate as messages; ephemeral SSE-only
// (never persisted — a typing state has no durable value and would bloat the
// notifications table). Rate-limited to keep a chatty client from flooding.
app.post("/api/channels/:id/typing", rateLimitMiddleware, requireDbUser, wrap(async (req, res) => {
  const ch = await query(
    `SELECT CASE WHEN c.user_a = $2 THEN c.user_b ELSE c.user_a END AS other
     FROM channels c WHERE c.id = $1 AND $2 IN (c.user_a, c.user_b)
       AND NOT EXISTS (
         SELECT 1 FROM blocks b
         WHERE (b.blocker_id = c.user_a AND b.blocked_id = c.user_b)
            OR (b.blocker_id = c.user_b AND b.blocked_id = c.user_a)
       )`,
    [req.params.id, req.user.id]
  );
  if (ch.rowCount === 0) {
    return res.status(403).json({ error: "You are not connected to this user." });
  }
  publishToUser(ch.rows[0].other, "typing", {
    channelId: req.params.id,
    from: req.user.id,
    fromName: `${req.user.firstName || ""} ${req.user.lastName || ""}`.trim(),
  });
  res.json({ sent: true });
}));

// ---------------------------------------------------------------------------
// Notification center
// ---------------------------------------------------------------------------
app.get("/api/notifications", requireDbUser, wrap(async (req, res) => {
  res.json(await domain.listNotifications(req.user.id, {
    unreadOnly: req.query.unread === "1",
    limit: Number(req.query.limit) || 50,
  }));
}));

app.post("/api/notifications/:id/read", rateLimitMiddleware, requireDbUser, wrap(async (req, res) => {
  res.json(await domain.markNotificationRead(req.user.id, req.params.id));
}));

app.post("/api/notifications/read-all", rateLimitMiddleware, requireDbUser, wrap(async (req, res) => {
  res.json(await domain.markAllNotificationsRead(req.user.id));
}));

// ---------------------------------------------------------------------------
// Profile photo (primary). Uploads to Supabase Storage when configured,
// otherwise stores a bounded data URL directly in Postgres.
// ---------------------------------------------------------------------------
const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";

// Audit M-6: minimal JPEG EXIF/XMP stripper. EXIF (APP1 0xFFE1), XMP (APP1
// 0xFFE1 with a different signature), and JFIF-thumbnail segments live in the
// JPEG header; stripping them is enough to drop the GPS / camera serial /
// timestamp metadata that phone-camera JPEGs carry by default. PNG and WebP
// metadata isn't stripped here (the legacy data-URL path stores the bytes as
// uploaded); for production, prefer Supabase object storage + a Worker-side
// re-encode, which is what SUPABASE_URL is for.
function stripJpegExif(bytes) {
  // JPEG SOI is FF D8; we only operate on a buffer that starts that way.
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return bytes;
  const out = [bytes.subarray(0, 2)];
  let i = 2;
  while (i < bytes.length) {
    if (bytes[i] !== 0xff) break; // malformed; bail and return original
    // Skip any fill bytes between markers (legal in JPEG).
    while (i < bytes.length && bytes[i] === 0xff) i++;
    if (i >= bytes.length) break;
    const marker = bytes[i];
    i++;
    // Standalone markers without a length field.
    if (marker === 0xd8 /* SOI */ || marker === 0xd9 /* EOI */ || (marker >= 0xd0 && marker <= 0xd7) /* RSTn */) {
      out.push(bytes.subarray(i - 2, marker === 0xd8 ? i : i));
      if (marker === 0xd9) break;
      continue;
    }
    if (i + 2 > bytes.length) break;
    const segLen = (bytes[i] << 8) | bytes[i + 1];
    // APP1 (0xE1) is where EXIF + XMP live. Drop every APP segment to be safe
    // — none of them are needed to render the image.
    if (marker >= 0xe0 && marker <= 0xef) {
      i += segLen;
      continue;
    }
    // Keep the segment. Write the marker byte back then copy its payload.
    out.push(bytes.subarray(i - 2, i + segLen));
    i += segLen;
    if (marker === 0xda) {
      // SOS: the rest is compressed image data. Copy verbatim.
      out.push(bytes.subarray(i));
      break;
    }
  }
  return Buffer.concat(out);
}

app.post("/api/me/photo", rateLimitMiddleware, requireDbUser, wrap(async (req, res) => {
  const dataUrl = String(req.body?.dataUrl || "");
  const m = /^data:(image\/(?:png|jpe?g|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return res.status(400).json({ error: "Upload a PNG, JPEG or WebP image." });
  if (dataUrl.length > 2 * 1024 * 1024) {
    return res.status(413).json({ error: "Image too large (max ~1.5 MB)." });
  }
  let payload = Buffer.from(m[2], "base64");
  // Audit M-6: drop EXIF/XMP/JFIF-thumbnail segments from JPEG uploads.
  if (m[1] === "image/jpeg" || m[1] === "image/jpg") {
    payload = stripJpegExif(payload);
  }
  const cleanDataUrl = `data:${m[1]};base64,${payload.toString("base64")}`;
  let url = cleanDataUrl;
  if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    const ext = m[1] === "image/png" ? "png" : m[1] === "image/webp" ? "webp" : "jpg";
    const objectPath = `${req.user.id}/${crypto.randomBytes(8).toString("hex")}.${ext}`;
    const up = await fetch(`${SUPABASE_URL}/storage/v1/object/profile-photos/${objectPath}`, {
      method: "POST",
      // Audit H12: image bodies are the largest outbound payload — bound it so a
      // stalled storage host cannot hold a request slot indefinitely.
      signal: AbortSignal.timeout(20_000),
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Content-Type": m[1],
        "x-upsert": "true",
      },
      body: payload,
    });
    if (!up.ok) {
      console.error(JSON.stringify({ level: "error", msg: "photo_upload_failed", status: up.status }));
      return res.status(502).json({ error: "Photo storage is unavailable right now." });
    }
    url = `${SUPABASE_URL}/storage/v1/object/public/profile-photos/${objectPath}`;
  }
  res.json(await domain.addGalleryPhoto(req.user.id, url));
}));

// ---------------------------------------------------------------------------
// Photo gallery (matrimony parity: multi-photo, orderable, cap + daily limit).
// The first upload becomes primary automatically; set-primary/delete below.
// ---------------------------------------------------------------------------
app.get("/api/me/photos", requireDbUser, wrap(async (req, res) => {
  res.json({ photos: await domain.listMyPhotos(req.user.id) });
}));

app.post("/api/me/photos/:id/primary", rateLimitMiddleware, requireDbUser, wrap(async (req, res) => {
  // set-primary now UPDATES the existing row (id), not re-insert a duplicate.
  res.json(await domain.setPrimaryPhoto(req.user.id, req.params.id));
}));

app.delete("/api/me/photos/:id", rateLimitMiddleware, requireDbUser, wrap(async (req, res) => {
  res.json(await domain.deleteGalleryPhoto(req.user.id, req.params.id));
}));

// ---------------------------------------------------------------------------
// "Who viewed my profile" — owner-only feed of distinct viewers.
// ---------------------------------------------------------------------------
app.get("/api/me/profile-views", requireDbUser, wrap(async (req, res) => {
  res.json(await domain.listProfileViewers(req.user.id, req.query.limit));
}));

// ---------------------------------------------------------------------------
// Consultations (paid astrologer sessions)
// ---------------------------------------------------------------------------
app.get("/api/consultations/active", requireDbUser, wrap(async (req, res) => {
  res.json(await domain.hasActiveConsultation(req.user.id));
}));

app.post("/api/consultations", rateLimitMiddleware, requireDbUser, wrap(async (req, res) => {
  const { scheduledFor, durationMinutes } = req.body || {};
  res.status(201).json(await domain.createConsultation(req.user.id, scheduledFor, durationMinutes));
}));

// ---------------------------------------------------------------------------
// Admin / moderation APIs (DB mode). requireAdmin is enforced by the session
// middleware flag; every mutation is audit-logged in admin_audit_log.
// Root admins (env-seeded via ADMIN_EMAILS) additionally manage the admin
// roster itself — promote/demote from the console, fully audited.
//
// The role hierarchy on the moderation TARGET is enforced by
// requireAdminTargetHierarchy (defined next to requireAdmin, above).
// ---------------------------------------------------------------------------

app.get("/api/admin/me", requireAdmin, wrap(async (req, res) => {
  res.json({ admin: true, root: Boolean(req.isRootAdmin), userId: req.user.id, email: req.user.email });
}));

// Audit M-4: the admin roster routes work in BOTH modes — the DB write is
// added when DATABASE_URL is set and the JSON mirror is always updated — so
// they deliberately do NOT carry requireDbUser (which would 503 in JSON mode).
// They DO carry the rate limiter, which every sibling admin mutation has.
app.post("/api/admin/users/:id/promote-admin", rateLimitMiddleware, requireAdmin, wrap(async (req, res) => {
  if (!req.isRootAdmin) return res.status(403).json({ error: "Root admin required." });
  const target = users[req.params.id] || (await hydrateUserById(req.params.id));
  if (!target) return res.status(404).json({ error: "User not found." });
  if (target.isRootAdmin) return res.status(400).json({ error: "Root admins are managed via ADMIN_EMAILS." });
  // Audit H4: write the DB FIRST and fail loudly. The old order updated the
  // JSON mirror, swallowed the DB error with .catch(() => {}) and still
  // returned 200 — resolveAdminFlags then re-read the DB on the next cache miss
  // and silently reverted the promotion the operator was told had succeeded.
  if (dbEnabled) {
    try {
      await query(`UPDATE app_users SET is_admin = TRUE WHERE id = $1`, [target.id]);
    } catch (err) {
      console.error(JSON.stringify({ level: "error", msg: "admin_promote_db_failed", userId: target.id, error: String(err) }));
      return res.status(503).json({ error: "Could not save the role change. Try again." });
    }
  }
  target.isAdmin = true;
  persistUsers();
  invalidateAdminFlagCache(target.id);
  await domain.writeAudit(req.user.id, "admin.promote", target.id);
  res.json({ isAdmin: true });
}));

app.post("/api/admin/users/:id/demote-admin", rateLimitMiddleware, requireAdmin, wrap(async (req, res) => {
  if (!req.isRootAdmin) return res.status(403).json({ error: "Root admin required." });
  const target = users[req.params.id] || (await hydrateUserById(req.params.id));
  if (!target) return res.status(404).json({ error: "User not found." });
  if (target.isRootAdmin) return res.status(400).json({ error: "Root admins are managed via ADMIN_EMAILS." });
  // Audit H4: DB first (see promote-admin). A revocation that only lands in the
  // ephemeral mirror is a security hole, not a cosmetic bug.
  if (dbEnabled) {
    try {
      await query(`UPDATE app_users SET is_admin = FALSE, token_version = COALESCE(token_version, 0) + 1 WHERE id = $1`, [target.id]);
    } catch (err) {
      console.error(JSON.stringify({ level: "error", msg: "admin_demote_db_failed", userId: target.id, error: String(err) }));
      return res.status(503).json({ error: "Could not save the role change. Try again." });
    }
  }
  target.isAdmin = false;
  target.tokenVersion = (target.tokenVersion || 0) + 1;
  persistUsers();
  invalidateAdminFlagCache(target.id);
  await domain.writeAudit(req.user.id, "admin.demote", target.id);
  res.json({ isAdmin: false });
}));

app.get("/api/admin/reports", requireDbUser, requireAdmin, wrap(async (req, res) => {
  res.json({ reports: await domain.listReports(String(req.query.status || "open")) });
}));

app.post("/api/admin/reports/:id/resolve", rateLimitMiddleware, requireDbUser, requireAdmin, wrap(async (req, res) => {
  const outcome = String(req.body?.outcome || "resolved");
  if (!["resolved", "dismissed"].includes(outcome)) {
    return res.status(400).json({ error: "outcome must be resolved or dismissed." });
  }
  res.json(await domain.resolveReport(req.user.id, req.params.id, outcome, req.body?.note));
}));

app.get("/api/admin/users", requireDbUser, requireAdmin, wrap(async (req, res) => {
  const rows = await domain.listAdminUsers(req.query.q, Number(req.query.limit) || 50);
  // Suspension is canonical on the auth store — merge it into admin view.
  const enriched = rows.map((r) => ({ ...r, suspended: Boolean(r.suspended) || Boolean(users[r.id]?.suspended) }));
  res.json({ users: enriched });
}));

// The suspend/unsuspend routes work in BOTH modes (the JSON mirror is the
// canonical auth store; the DB write is added when DATABASE_URL is set), so
// they deliberately do NOT carry requireDbUser.
app.post("/api/admin/users/:id/suspend", rateLimitMiddleware, requireAdmin, requireAdminTargetHierarchy, wrap(async (req, res) => {
  // Audit C-3: the role hierarchy is now enforced by the shared
  // requireAdminTargetHierarchy guard (root admins are untouchable; only a
  // root admin may suspend another admin) — the same rule the warn and
  // unsuspend routes use.
  const target = req.adminTarget;
  if (target.id === req.user.id) return res.status(400).json({ error: "You cannot suspend yourself." });
  target.suspended = true;
  // Audit H-10: bump the user's tokenVersion so EVERY session issued before
  // this suspension dies immediately at verifySessionToken (defence in depth —
  // the in-process check below is the fast path; tokenVersion is the durable
  // backstop that survives a process restart).
  target.tokenVersion = (target.tokenVersion ?? 0) + 1;
  persistUsers();
  // Mirror to the DB so DB-backed admin suspensions revoke sessions too.
  // M3: awaited — a fire-and-forget bump could be lost on shutdown and leave
  // the DB mirror version behind the JSON canonical store.
  if (dbEnabled) {
    try {
      await query(
        `UPDATE app_users SET token_version = token_version + 1, suspended = TRUE WHERE id = $1`,
        [target.id]
      );
    } catch (err) {
      console.error(
        JSON.stringify({ level: "error", msg: "suspend_token_version_failed", userId: target.id, error: String(err) })
      );
    }
  }
  await domain.writeAudit(req.user.id, "user.suspend", target.id, String(req.body?.reason || "").slice(0, 300));
  kickSse(target.id); // drop their live stream immediately
  res.json({ suspended: true });
}));

app.post("/api/admin/users/:id/unsuspend", rateLimitMiddleware, requireAdmin, requireAdminTargetHierarchy, wrap(async (req, res) => {
  // Audit C-3: the target hierarchy is enforced by requireAdminTargetHierarchy
  // above — without it a regular admin could un-suspend any admin, including
  // a root admin suspended by an operator.
  const target = req.adminTarget;
  target.suspended = false;
  persistUsers();
  if (dbEnabled) {
    try {
      await query(
        `UPDATE app_users SET suspended = FALSE WHERE id = $1`,
        [target.id]
      );
    } catch (err) {
      console.error(
        JSON.stringify({ level: "error", msg: "unsuspend_db_failed", userId: target.id, error: String(err) })
      );
    }
  }
  await domain.writeAudit(req.user.id, "user.unsuspend", target.id);
  res.json({ suspended: false });
}));

app.get("/api/admin/profiles", requireDbUser, requireAdmin, wrap(async (req, res) => {
  const profiles = await domain.adminListProfiles(req.query.q, Number(req.query.limit) || 50);
  await domain.writeAudit(req.user.id, "profiles.read", "*", `query=${req.query.q || ""} count=${profiles.length}`);
  res.json({ profiles });
}));

app.patch("/api/admin/profiles/:id", rateLimitMiddleware, requireDbUser, requireAdmin, wrap(async (req, res) => {
  res.json({ profile: await domain.patchProfileAdmin(req.user.id, req.params.id, req.body || {}) });
}));

app.get("/api/admin/payments", requireDbUser, requireAdmin, wrap(async (req, res) => {
  res.json({ payments: await domain.listPayments(Number(req.query.limit) || 50) });
}));

app.get("/api/admin/audit", requireDbUser, requireAdmin, wrap(async (req, res) => {
  res.json({ audit: await domain.listAudit(Number(req.query.limit) || 100) });
}));

// Launch-gap fix #3: admin dashboard counts. One round-trip scalar-query.
app.get("/api/admin/stats", requireDbUser, requireAdmin, wrap(async (req, res) => {
  res.json({ stats: await domain.adminStats() });
}));

app.post("/api/admin/samples/hide-all", rateLimitMiddleware, requireAdmin, wrap(async (req, res) => {
  const hidden = req.body?.hidden !== false;
  res.json(await domain.setSamplesHidden(req.user.id, hidden));
}));

// Admin-initiated refund: calls Razorpay's refund API with the key secret,
// then records the refund (which downgrades the membership per policy).
app.post("/api/admin/refunds", rateLimitMiddleware, requireAdmin, wrap(async (req, res) => {
  if (!razorpayConfigured) {
    return res.status(503).json({ error: "Razorpay keys not configured — issue refunds from the Razorpay dashboard instead." });
  }
  const { paymentId, amountPaise, reason } = req.body || {};
  if (typeof paymentId !== "string" || !/^pay_[A-Za-z0-9]+$/.test(paymentId)) {
    return res.status(400).json({ error: "A valid Razorpay payment id is required." });
  }
  const auth = Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString("base64");
  let rzPayment = null;
  try {
    const r0 = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
      signal: AbortSignal.timeout(15_000),
      headers: { Authorization: `Basic ${auth}` },
    });
    rzPayment = r0.ok ? await r0.json() : null;
  } catch (err) {
    // Audit H12: distinguish "Razorpay unreachable" from "unknown payment" —
    // claiming 400 for a timeout tells the operator the wrong thing.
    console.error(JSON.stringify({ level: "error", msg: "refund_payment_lookup_failed", paymentId, error: String(err) }));
    return res.status(502).json({ error: "Could not reach Razorpay to verify this payment. Try again." });
  }
  if (!rzPayment || rzPayment.id !== paymentId) {
    return res.status(400).json({ error: "Unknown Razorpay payment." });
  }
  const refundAmount = Number.isFinite(amountPaise) && amountPaise > 0
    ? Math.min(Math.round(amountPaise), rzPayment.amount)
    : rzPayment.amount;
  let r1;
  try {
    r1 = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/refund`, {
      method: "POST",
      signal: AbortSignal.timeout(20_000),
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({ amount: refundAmount, speed: "normal" }),
    });
  } catch (err) {
    // The request may still have reached Razorpay before the socket died. Never
    // report a plain failure here — money may have moved, so the operator has to
    // confirm in the dashboard before retrying (audit H12).
    console.error(JSON.stringify({ level: "error", msg: "refund_request_unconfirmed", paymentId, amountPaise: refundAmount, error: String(err) }));
    return res.status(502).json({
      error: "The refund could not be confirmed — check this payment in the Razorpay dashboard before retrying.",
    });
  }
  const data = await r1.json().catch(() => ({}));
  if (!r1.ok) {
    return res.status(502).json({ error: data?.error?.description || "Razorpay refund failed." });
  }
  const out = await domain.recordAdminRefund({
    refundId: data.id, paymentId, amountPaise: data.amount, reason: reason || "admin-initiated",
  });
  await domain.writeAudit(req.user.id, "refund.initiate", paymentId, `refund=${data.id} amount=${data.amount}`);
  // Audit X7: only a FULL refund (cumulative) may demote; a partial refund keeps
  // the plan exactly as it was (bookkept, audited, no access change).
  if (out.result === "applied" && out.userId && out.revoked) {
    // Same unified policy mirror as the webhook path (audit H-3).
    const current = entitlements[out.userId];
    if (!current || MEMBERSHIP_SKUS.indexOf(current.sku) !== -1) {
      entitlements[out.userId] = { sku: "basic", activatedAt: new Date().toISOString(), paymentId: "" };
      persistEntitlements();
    }
  }
  res.json(out);
}));

// Central error handler — no stack traces in responses.
app.use((err, _req, res, _next) => {
  // Body-parser (and other Express internals) raise errors that carry a status.
  // Report them as they are instead of masking every client mistake as a 500 —
  // an oversized upload used to answer "Internal server error" (audit X6).
  const status = Number(err?.status || err?.statusCode) || 500;
  if (status >= 400 && status < 500) {
    const message =
      err?.type === "entity.too.large" || status === 413
        ? "That upload is too large — please choose an image under ~1.5 MB."
        : err?.type === "entity.parse.failed"
          ? "Malformed request body."
          : err?.message || "Request failed.";
    return res.status(status).json({ error: message });
  }
  console.error(JSON.stringify({ level: "error", msg: "unhandled_error", error: String(err) }));
  res.status(500).json({ error: "Internal server error." });
});

// Boot: apply migrations (idempotent) before accepting traffic when in DB
// mode, then listen. A migration failure is a hard boot failure — the server
// must never serve traffic against an unknown schema.
async function main() {
  if (dbEnabled) {
    try {
      await migrate();
      console.log(JSON.stringify({ level: "info", msg: "migrations_applied" }));
      await initEventsPubSub();
      // Prune minute buckets after 15m but keep daily browse buckets (midnight)
      // for 2 days: the browse-daily keys share this table.
      query("DELETE FROM rate_limit_buckets WHERE window_start < NOW() - INTERVAL '2 days'").catch(() => {});
      query("DELETE FROM rate_limit_buckets WHERE bucket_key NOT LIKE 'browse-daily:%' AND window_start < NOW() - INTERVAL '15 minutes'").catch(() => {});
      setInterval(() => {
        // Audit C2: Repeat both daily and 15m minute bucket cleanup in interval.
        query("DELETE FROM rate_limit_buckets WHERE window_start < NOW() - INTERVAL '2 days'").catch(() => {});
        query("DELETE FROM rate_limit_buckets WHERE bucket_key NOT LIKE 'browse-daily:%' AND window_start < NOW() - INTERVAL '15 minutes'").catch(() => {});
      }, 10 * 60 * 1000).unref();
    } catch (err) {
      console.error(
        JSON.stringify({ level: "error", msg: "migrations_failed", error: String(err) })
      );
      process.exit(1);
    }
    try {
      const dbUsers = await query(
        `SELECT id, email, first_name, last_name, specialty, degree, password_hash, salt, verified, token_version, created_at, is_admin, is_root_admin, suspended
         FROM app_users`
      );
      for (const r of dbUsers.rows) {
        users[r.id] = {
          id: r.id,
          email: r.email,
          firstName: r.first_name || "",
          lastName: r.last_name || "",
          specialty: r.specialty || "",
          degree: r.degree || "",
          salt: r.salt || "",
          hash: r.password_hash || "",
          verified: Boolean(r.verified),
          tokenVersion: r.token_version ?? 0,
          createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
          isAdmin: Boolean(r.is_admin),
          isRootAdmin: Boolean(r.is_root_admin),
          suspended: Boolean(r.suspended),
        };
      }
      if (dbUsers.rowCount > 0) {
        console.log(JSON.stringify({ level: "info", msg: "users_hydrated_from_db", count: dbUsers.rowCount }));
      }
    } catch (err) {
      console.error(JSON.stringify({ level: "error", msg: "users_db_hydrate_failed", error: String(err) }));
    }
    // Item 13: bound the admin_audit_log table. The default cap is 12 months;
    // override with ADMIN_AUDIT_RETENTION_DAYS for compliance (e.g. 7 years for
    // financial services). Runs once at boot; not a hot loop.
    const retentionDays = Math.max(
      1,
      Number(process.env.ADMIN_AUDIT_RETENTION_DAYS) || 365
    );
    try {
      const r = await query(
        `DELETE FROM admin_audit_log WHERE created_at < NOW() - make_interval(days => $1::int)`,
        [retentionDays]
      );
      if (r.rowCount > 0) {
        console.log(JSON.stringify({
          level: "info",
          msg: "audit_log_pruned",
          rows: r.rowCount,
          retentionDays,
        }));
      }
    } catch (err) {
      console.error(JSON.stringify({ level: "error", msg: "audit_prune_failed", error: String(err) }));
    }
    // M-NEW-3: bound the notifications table. Defaults to 90 days; override
    // with NOTIFICATION_RETENTION_DAYS. Read receipts stay forever (audit log);
    // the transient feed is what's pruned. Runs once at boot.
    const notifRetentionDays = Math.max(
      1,
      Number(process.env.NOTIFICATION_RETENTION_DAYS) || 90
    );
    try {
      const r = await query(
        `DELETE FROM notifications WHERE created_at < NOW() - make_interval(days => $1::int)`,
        [notifRetentionDays]
      );
      if (r.rowCount > 0) {
        console.log(JSON.stringify({
          level: "info",
          msg: "notifications_pruned",
          rows: r.rowCount,
          retentionDays: notifRetentionDays,
        }));
      }
    } catch (err) {
      console.error(JSON.stringify({ level: "error", msg: "notifications_prune_failed", error: String(err) }));
    }

    // Audit B6: Bound ephemeral tables (used_email_tokens, redeemed_tokens, webhook_events).
    // Settled webhook idempotency records and redeemed/used token hashes are kept for 90 days
    // to prevent replay across retry/reconnect windows, then safely purged.
    const tokenRetentionDays = Math.max(
      1,
      Number(process.env.TOKEN_RETENTION_DAYS) || 90
    );
    try {
      const emailTokens = await query(
        `DELETE FROM used_email_tokens WHERE used_at < NOW() - make_interval(days => $1::int)`,
        [tokenRetentionDays]
      );
      const redeemed = await query(
        `DELETE FROM redeemed_tokens WHERE redeemed_at < NOW() - make_interval(days => $1::int)`,
        [tokenRetentionDays]
      );
      const webhooks = await query(
        `DELETE FROM webhook_events WHERE received_at < NOW() - make_interval(days => $1::int)`,
        [tokenRetentionDays]
      );
      const prunedCount = emailTokens.rowCount + redeemed.rowCount + webhooks.rowCount;
      if (prunedCount > 0) {
        console.log(JSON.stringify({
          level: "info",
          msg: "ephemeral_records_pruned",
          usedEmailTokens: emailTokens.rowCount,
          redeemedTokens: redeemed.rowCount,
          webhookEvents: webhooks.rowCount,
          retentionDays: tokenRetentionDays,
        }));
      }
    } catch (err) {
      console.error(JSON.stringify({ level: "error", msg: "ephemeral_prune_failed", error: String(err) }));
    }
  }

  // Bootstrap ROOT admins from ADMIN_EMAILS (comma-separated). Idempotent.
  // Root admins manage the admin roster from /admin; regular admins cannot.
  // NOTE (audit L12): ADMIN_EMAILS grants ROOT admins — documentation and env
  // examples must say "root", not merely "admin".
  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (adminEmails.length > 0) {
    if (dbEnabled) {
      for (const email of adminEmails) {
        try {
          await query(
            `UPDATE app_users SET is_admin = TRUE, is_root_admin = TRUE WHERE lower(email) = $1`,
            [email]
          );
          for (const u of Object.values(users)) {
            if (String(u.email || "").toLowerCase() === email) {
              u.isAdmin = true;
              u.isRootAdmin = true;
              invalidateAdminFlagCache(u.id);
            }
          }
        } catch (err) {
          console.error(JSON.stringify({ level: "error", msg: "admin_promote_failed", email, error: String(err) }));
        }
      }
    } else {
      let promoted = 0;
      for (const u of Object.values(users)) {
        if (adminEmails.includes(String(u.email).toLowerCase())) {
          u.isAdmin = true;
          u.isRootAdmin = true;
          invalidateAdminFlagCache(u.id);
          promoted++;
        }
      }
      if (promoted > 0) persistUsers();
    }
    console.log(JSON.stringify({ level: "info", msg: "root_admins_promoted", count: adminEmails.length }));
  }

  // P0-3/P0-5 background digest (single-instance): daily renewal reminders.
  // Best practice: best-effort, unref'd, DB-mode only; failures never crash boot.
  // Operators needing multi-replica fanout should move this to a job runner.
  if (dbEnabled && process.env.DISABLE_DIGEST !== "true") {
    // Re-entrancy guard (audit H12): every send in this loop awaits Resend, so a
    // slow provider could otherwise let the next daily tick start on top of a
    // run that never finished (duplicate reminders within one 3-day claim window).
    let renewalDigestRunning = false;
    const runRenewalDigest = async () => {
      if (renewalDigestRunning) return;
      renewalDigestRunning = true;
      try {
        const rows = await domain.subscriptionsExpiring(3);
        for (const s of rows.slice(0, 200)) {
          try {
            const claimed = await query(
              `UPDATE subscriptions
                  SET renewal_notified_at = NOW()
                WHERE user_id = $1 AND sku = $2
                  AND (renewal_notified_at IS NULL OR renewal_notified_at < NOW() - INTERVAL '3 days')
                RETURNING user_id`,
              [s.userId, s.sku]
            );
            if (claimed.rowCount === 0) continue;
            await sendEmail({
              to: s.email,
              subject: "Your MedicoMatch membership ends soon",
              text: `Your ${s.sku} membership ends on ${new Date(s.expiresAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}. Renew from your Account page to keep your benefits.`,
            });
          } catch { /* per-recipient failure is non-fatal */ }
        }
        if (rows.length > 0) console.log(JSON.stringify({ level: "info", msg: "renewal_digest_sent", total: rows.length }));
      } catch (err) {
        console.error(JSON.stringify({ level: "error", msg: "renewal_digest_failed", error: String(err) }));
      } finally {
        renewalDigestRunning = false;
      }
    };
    setImmediate(runRenewalDigest);
    setInterval(runRenewalDigest, 24 * 60 * 60 * 1000).unref();

    // Engagement digest (matrimony conversion lever): users who haven't logged
    // in for 24h+ get ONE daily email with their unread social signals (new
    // views, interests, messages). Capped; per-recipient failure is non-fatal.
    let engagementDigestRunning = false;
    const runEngagementDigest = async () => {
      if (engagementDigestRunning) return;
      engagementDigestRunning = true;
      try {
        const r = await query(
          `SELECT u.id, u.email,
                  (SELECT COUNT(*)::int FROM notifications n WHERE n.user_id = u.id AND n.read_at IS NULL AND n.created_at > NOW() - INTERVAL '2 days') AS unread,
                  (SELECT COUNT(*)::int FROM profile_views v JOIN profiles p ON p.id = v.profile_id WHERE p.user_id = u.id AND v.viewed_on >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date - 2) AS views
           FROM app_users u
           WHERE u.verified = TRUE
             AND u.suspended = FALSE
             AND EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = u.id AND p.last_active_at < NOW() - INTERVAL '24 hours')
             AND (u.digest_sent_at IS NULL OR u.digest_sent_at < NOW() - INTERVAL '20 hours')
           LIMIT 200`
        );
        for (const row of r.rows) {
          try {
            if ((row.unread ?? 0) + (row.views ?? 0) === 0) continue;
            const claimed = await query(
              `UPDATE app_users
                  SET digest_sent_at = NOW()
                WHERE id = $1
                  AND (digest_sent_at IS NULL OR digest_sent_at < NOW() - INTERVAL '20 hours')
                RETURNING id`,
              [row.id]
            );
            if (claimed.rowCount === 0) continue;
            await sendEmail({
              to: row.email,
              subject: "You have new activity on MedicoMatch",
              text: `Namaste! Since your last visit: ${row.views ?? 0} new profile view(s) and ${row.unread ?? 0} unread notification(s) (interests, messages, matches). Sign in to see who's waiting: ${APP_URL}/matches`,
            });
          } catch { /* per-recipient failure is non-fatal */ }
        }
        if (r.rows.length > 0) console.log(JSON.stringify({ level: "info", msg: "engagement_digest_sent", total: r.rows.length }));
      } catch (err) {
        console.error(JSON.stringify({ level: "error", msg: "engagement_digest_failed", error: String(err) }));
      } finally {
        engagementDigestRunning = false;
      }
    };
    setImmediate(runEngagementDigest);
    setInterval(runEngagementDigest, 24 * 60 * 60 * 1000).unref();
  }

  const server = app.listen(PORT, () => {
    markReady();
    console.log(
      JSON.stringify({
        level: "info",
        msg: "server_started",
        port: PORT,
        razorpayConfigured,
        simulatePayments,
        database: dbEnabled,
      })
    );
  });

  // Graceful shutdown (audit H10): the host sends SIGTERM before replacing a
  // container. Stop accepting connections, drain the pool, then exit — a hard
  // kill mid-transaction is how billing rows and audit entries diverge.
  const shutdown = (signal) => {
    console.log(JSON.stringify({ level: "info", msg: "shutdown_started", signal }));
    server.close(async () => {
      try {
        if (dbEnabled) await getPool().end();
      } catch {
        /* pool already closed */
      }
      process.exit(0);
    });
    // Never wedge a deploy: force-exit if connections refuse to drain.
    setTimeout(() => process.exit(0), 10_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main();
