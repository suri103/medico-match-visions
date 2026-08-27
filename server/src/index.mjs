import "dotenv/config";
import express from "express";
import cors from "cors";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { sendEmail } from "./email.mjs";
import { dbEnabled, DATABASE_URL, migrate, query } from "./db.mjs";
import { addClient, closeUser as kickSse } from "./events.mjs";
import * as domain from "./domain.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Behind Railway/Fly/Nginx-style proxies, req.ip must be taken from
// X-Forwarded-For — otherwise the rate limiter buckets EVERY visitor under the
// proxy's IP and legitimate users get 429s in production (audit H6).
app.set("trust proxy", true);

// Minimal hardening headers Express can own. HSTS/TLS termination belongs to
// the reverse proxy / hosting layer.
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});

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
  if (simulatePayments) {
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
  if (bootErrors.length > 0) {
    console.error("Refusing to start:\n  - " + bootErrors.join("\n  - "));
    process.exit(1);
  }
}

// Signs sessions and activation tokens. Required in production (boot-checked
// above); the dev fallback keeps local development friction-free.
const activationSecret =
  process.env.ACTIVATION_SECRET ||
  (razorpayKeySecret ? `razorpay:${razorpayKeySecret}` : "dev-only-insecure-activation-secret");

// ---------------------------------------------------------------------------
// Simple JSON-file stores (server/data/). There is no database in this stack;
// these files are the persistence layer — include them in backups. Swap for a
// real database before scaling beyond a single instance.
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
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
};

/** @type {Record<string, {id:string,email:string,firstName:string,lastName:string,specialty:string,degree:string,salt:string,hash:string,verified:boolean,tokenVersion:number,createdAt:string}>} */
let users = readJson(USERS_FILE, {});
// Accounts created before email verification shipped have no `verified` field;
// treat them as already-verified so existing users aren't locked out.
// Accounts created before session versioning have no tokenVersion; treat as 0.
for (const user of Object.values(users)) {
  if (user.verified === undefined) user.verified = true;
  if (user.tokenVersion === undefined) user.tokenVersion = 0;
}
/** @type {Record<string, {sku:string,activatedAt:string,paymentId:string}>} */ // keyed by user id
let entitlements = readJson(ENTITLEMENTS_FILE, {});

const persistUsers = () => writeJson(USERS_FILE, users);
const persistEntitlements = () => writeJson(ENTITLEMENTS_FILE, entitlements);

// Sequential GST invoice numbering, persisted across restarts (GST invoices
// must carry sequential numbers — random ids are not acceptable).
const INVOICE_SEQ_FILE = path.join(DATA_DIR, "invoice_seq.json");
let invoiceSeq = readJson(INVOICE_SEQ_FILE, { year: null, n: 0 });

// Calendar date in India's business timezone. Invoice dates were previously
// taken from UTC, so invoices issued 00:00–05:30 IST carried yesterday's date.
const istDateString = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

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
// Sessions: stateless signed tokens `uid.exp.hmac` (7-day expiry). Revocation
// means rotating ACTIVATION_SECRET (documented in DEPLOYMENT.md); per-session
// revocation requires server-side session storage.
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
const ADMIN_FLAG_TTL_MS = 30_000;
const adminFlagCache = new Map(); // userId -> { v: [isAdmin, isRootAdmin], exp }

async function resolveAdminFlags(user) {
  if (!dbEnabled) return [Boolean(user.isAdmin), Boolean(user.isRootAdmin)];
  const hit = adminFlagCache.get(user.id);
  if (hit && hit.exp > Date.now()) return hit.v;
  let v;
  try {
    const r = await query(`SELECT is_admin, is_root_admin FROM app_users WHERE id = $1`, [user.id]);
    if (r.rowCount > 0) {
      v = [Boolean(r.rows[0].is_admin) || Boolean(user.isAdmin), Boolean(r.rows[0].is_root_admin)];
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

const sessionMiddleware = (req, res, next) => {
  const header = req.headers.authorization || "";
  const match = /^Bearer (.+)$/.exec(header);
  if (match) {
    const parsed = verifySessionToken(match[1]);
    const u = parsed && users[parsed.userId];
    if (u) {
      if (u.suspended) {
        return res.status(403).json({ error: "This account has been suspended. Contact support." });
      }
      resolveAdminFlags(u)
        .then(([dbAdmin, dbRoot]) => {
          const { id, email, firstName, lastName, specialty, degree } = u;
          req.user = { id, email, firstName, lastName, specialty, degree };
          req.isAdmin = Boolean(u.isAdmin) || Boolean(u.isRootAdmin) || dbAdmin;
          req.isRootAdmin = Boolean(u.isRootAdmin) || dbRoot;
          next();
        })
        .catch(() => next());
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

// ---------------------------------------------------------------------------
// Server-side price catalog (INR, whole rupees). The client declares WHAT it is
// buying; the server decides what it costs.
// ---------------------------------------------------------------------------
// Astrology consultations ship gated behind ASTROLOGY_ENABLED so the product
// is never sold before launch (there is no reachable booking UI while off).
// When disabled the SKUs are simply omitted from the catalog and create-order
// rejects them. Enabling sells the SKUs; the existing booking path, the C1
// subscription grant and hasActiveConsultation already work unchanged.
const ASTROLOGY_ENABLED = process.env.ASTROLOGY_ENABLED === "true";
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
};

const catalogAllows = (sku, amount) => {
  const allowed = PLAN_CATALOG[sku];
  return Array.isArray(allowed) && allowed.includes(Math.round(amount));
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

const mintActivationToken = (sku, orderId, paymentId) => {
  const exp = Date.now() + ACTIVATION_TTL_MS;
  const payload = `${sku}|${exp}|${orderId}|${paymentId}`;
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
  const [sku, expStr, orderId, paymentId] = payload.split("|");
  const exp = Number(expStr);
  if (!PLAN_CATALOG[sku] || !Number.isFinite(exp) || Date.now() > exp) return null;
  return { sku, exp, orderId, paymentId };
};

// ---------------------------------------------------------------------------
// Email tokens (verification + password reset). Same HMAC construction as
// activation tokens: single-use, short TTL, bound memory.
// ---------------------------------------------------------------------------
const EMAIL_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const usedVerifyTokens = new Set();
const usedResetTokens = new Set();

const mintEmailToken = (userId, purpose) => {
  const exp = Date.now() + EMAIL_TOKEN_TTL_MS;
  const payload = userId + "|" + purpose + "|" + exp;
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
  if (parts.length !== 3) return null;
  const [userId, tokenPurpose, expStr] = parts;
  if (tokenPurpose !== purpose) return null;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) return null;
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
const RATE_LIMIT_MAX = 30;
const RATE_WINDOW_MS = 60 * 1000;
const hitsByIp = new Map();
const rateLimited = (req) => {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const hits = (hitsByIp.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  hits.push(now);
  // Re-insert so Map iteration order reflects recency (LRU eviction below).
  hitsByIp.delete(ip);
  hitsByIp.set(ip, hits);
  // Bound memory by pruning IDLE entries first; never bulk-clear — a flood of
  // spoofed/new IPs must not be able to reset other clients' counters (H6).
  if (hitsByIp.size > 1000) {
    for (const [key, val] of hitsByIp) {
      if (val[val.length - 1] <= now - RATE_WINDOW_MS) hitsByIp.delete(key);
    }
  }
  while (hitsByIp.size > 2000) {
    hitsByIp.delete(hitsByIp.keys().next().value); // least-recently-seen
  }
  return hits.length > RATE_LIMIT_MAX;
};

// Express middleware form of the limiter. The predicate above must never be
// passed to app.METHOD directly: as middleware it would never call next() and
// every request on that route would hang until timeout (audit Phase 2, C-1).
const rateLimitMiddleware = (req, res, next) => {
  if (rateLimited(req)) return res.status(429).json({ error: "Too many requests." });
  next();
};

// Outbound email throttle per recipient (verification/reset links). Caps how
// many emails one actor can trigger for a single address through
// register/forgot-password. The HTTP response stays IDENTICAL whether the
// send happened or not — no enumeration (audit M8).
const EMAIL_SEND_MAX = 3;
const EMAIL_SEND_WINDOW_MS = 15 * 60 * 1000;
const emailsSent = new Map(); // normalized email -> recent send timestamps[]
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

const allowedOrigins = (process.env.CORS_ORIGINS || APP_URL).split(",").map((s) => s.trim());
app.use(cors({ origin: allowedOrigins }));

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
    // Respond fast; Razorpay retries on non-2xx. Processing is idempotent.
    res.json({ ok: true });

    try {
      const type = event?.event || event?.type || "";
      const payload = event?.payload ?? {};
      const paymentEntity =
        payload?.payment?.entity ?? payload?.order?.entity?.payment ?? null;
      const paymentId = paymentEntity?.id ?? null;
      const orderId = paymentEntity?.order_id ?? payload?.order?.entity?.id ?? null;
      const amountPaise = paymentEntity?.amount ?? null;

      if (!dbEnabled) {
        console.warn(JSON.stringify({ level: "warn", msg: "webhook_no_db_ignored", type }));
        return;
      }
      const refundEntity = payload?.refund?.entity ?? null;
      if (String(type).startsWith("refund.") && refundEntity?.id) {
        const out = await domain.recordRefund({
          refundId: refundEntity.id,
          paymentId: refundEntity.payment_id ?? paymentId,
          orderId: refundEntity.order_id ?? orderId,
          amountPaise: refundEntity.amount ?? null,
          reason: refundEntity.notes ? JSON.stringify(refundEntity.notes).slice(0, 280) : "",
          source: "webhook",
        });
        console.log(JSON.stringify({ level: "info", msg: "webhook_refund_processed", type, refundId: refundEntity.id, result: out.result }));
        if (out.result === "applied" && out.userId) {
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
        return;
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
        return;
      }
      const out = await domain.recordCapturedPayment({
        paymentId,
        orderId,
        amountPaise,
        source: "webhook",
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
      }
    } catch (err) {
      console.error(JSON.stringify({ level: "error", msg: "webhook_handler_failed", error: String(err) }));
    }
  }
);

app.use(express.json({ limit: "100kb" }));
app.use(sessionMiddleware);

app.get("/health", (_req, res) => {
  // Intentionally does not expose record counts on a public endpoint (audit L1).
  res.json({
    ok: true,
    razorpayConfigured,
    simulatePayments,
    database: dbEnabled,
    webhookConfigured: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET),
  });
});

// ---------------------------------------------------------------------------
// Auth: register / login / me.
// ---------------------------------------------------------------------------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const publicUser = (u) => ({
  id: u.id,
  email: u.email,
  firstName: u.firstName,
  lastName: u.lastName,
  fullName: `Dr. ${u.firstName} ${u.lastName}`.trim(),
  specialty: u.specialty,
  degree: u.degree,
});

app.post("/api/auth/register", async (req, res) => {
  if (rateLimited(req)) return res.status(429).json({ error: "Too many requests." });
  const { email, password, firstName, lastName, specialty, degree } = req.body || {};
  if (typeof email !== "string" || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: "A valid email is required." });
  }
  if (typeof password !== "string" || password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  }
  if (typeof firstName !== "string" || !firstName.trim()) {
    return res.status(400).json({ error: "First name is required." });
  }
  const normalizedEmail = email.trim().toLowerCase();
  const existing = Object.values(users).find((u) => u.email === normalizedEmail);

  // Identical response for new and existing accounts — no account enumeration.
  const message = "If this email is registered, check your inbox for a verification link.";

  if (existing) {
    if (existing.verified) {
      if (emailSendAllowed(normalizedEmail)) {
        sendEmail({
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
      sendEmail({
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
        { email: user.email, firstName: user.firstName, lastName: user.lastName, specialty: user.specialty, degree: user.degree, verified: false },
        { full_name: `Dr. ${user.firstName} ${user.lastName}`.trim(), specialty: user.specialty || null, degree: user.degree || null }
      );
    } catch (err) {
      console.error(JSON.stringify({ level: "error", msg: "user_mirror_failed", userId: user.id, error: String(err) }));
    }
  }

  const token = mintEmailToken(user.id, "verify");
  const sent = emailSendAllowed(user.email);
  if (sent) {
    sendEmail({
      to: user.email,
      subject: "Verify your MedicoMatch account",
      text: "Verify your email: " + APP_URL + "/verify-email?token=" + encodeURIComponent(token),
    });
  }

  res.status(201).json({ message, ...(process.env.NODE_ENV === "test" && sent ? { verificationToken: token } : {}) });
});

app.post("/api/auth/login", (req, res) => {
  if (rateLimited(req)) return res.status(429).json({ error: "Too many requests." });
  const { email, password } = req.body || {};
  if (typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Email and password are required." });
  }
  const normalizedEmail = email.trim().toLowerCase();
  const user = Object.values(users).find((u) => u.email === normalizedEmail);
  // Generic error either way — no account enumeration.
  if (!user) {
    // Equalize timing for unknown emails so response latency does not reveal
    // whether an account exists (scrypt is the dominant cost) — audit H2.
    hashPassword(password, crypto.randomBytes(16).toString("hex"));
    return res.status(401).json({ error: "Invalid email or password." });
  }
  const passwordOk = verifyPassword(password, user.salt, user.hash);
  // Unverified accounts complete sign-up via the emailed link; keep this
  // response indistinguishable from a bad password (no enumeration).
  if (!user.verified || !passwordOk) {
    return res.status(401).json({ error: "Invalid email or password." });
  }
  res.json({ token: issueSessionToken(user.id), user: publicUser(user) });
});

app.post("/api/auth/verify-email", (req, res) => {
  if (rateLimited(req)) return res.status(429).json({ error: "Too many requests." });
  const { token } = req.body || {};
  const userId = verifyEmailToken(token, "verify");
  if (!userId || !users[userId]) {
    return res.status(400).json({ error: "Invalid or expired verification link." });
  }
  if (usedVerifyTokens.has(token)) {
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
  res.json({ token: issueSessionToken(user.id), user: publicUser(user) });
});

app.post("/api/auth/forgot-password", (req, res) => {
  if (rateLimited(req)) return res.status(429).json({ error: "Too many requests." });
  const { email } = req.body || {};
  if (typeof email !== "string" || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: "A valid email is required." });
  }
  const message = "If this email is registered, a password reset link has been sent.";
  const normalizedEmail = email.trim().toLowerCase();
  const user = Object.values(users).find((u) => u.email === normalizedEmail);
  if (user) {
    // Per-recipient throttle: identical response whether or not the email
    // actually goes out (no enumeration); test-mode token only on real sends.
    if (user.verified) {
      const sent = emailSendAllowed(normalizedEmail);
      const token = mintEmailToken(user.id, "reset");
      if (sent) {
        sendEmail({
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
      sendEmail({
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

app.post("/api/auth/reset-password", (req, res) => {
  if (rateLimited(req)) return res.status(429).json({ error: "Too many requests." });
  const { token, password } = req.body || {};
  const userId = verifyEmailToken(token, "reset");
  if (!userId || !users[userId]) {
    return res.status(400).json({ error: "Invalid or expired reset link." });
  }
  if (usedResetTokens.has(token)) {
    return res.status(409).json({ error: "This reset link has already been used." });
  }
  if (typeof password !== "string" || password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  }
  rememberUsed(usedResetTokens, token);
  const user = users[userId];
  user.salt = crypto.randomBytes(16).toString("hex");
  user.hash = hashPassword(password, user.salt);
  // Invalidate every session issued before this reset (audit H4).
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  persistUsers();
  // Professional hygiene: tell the user their password changed (and where).
  sendEmail({
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
app.post("/api/auth/change-password", (req, res) => {
  if (rateLimited(req)) return res.status(429).json({ error: "Too many requests." });
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
  sendEmail({
    to: user.email,
    subject: "Your MedicoMatch password was changed",
    text:
      "Your MedicoMatch password was just changed. All sessions were signed out. " +
      "If this wasn't you, contact support immediately.",
  });
  res.json({ message: "Password updated. Please sign in again." });
});

app.get("/api/auth/me", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated." });
  const entitlement = entitlements[req.user.id];
  res.json({
    user: req.user,
    activePlan: entitlement ? entitlement.sku : null,
    activatedAt: entitlement ? entitlement.activatedAt : null,
  });
});

// ---------------------------------------------------------------------------
// Create a Razorpay Order (server-side, keeps the KEY SECRET safe).
// Body: { sku, amount (INR rupees), currency?, receipt?, notes? }
// ---------------------------------------------------------------------------
app.post("/api/razorpay/create-order", async (req, res) => {
  if (rateLimited(req)) return res.status(429).json({ error: "Too many requests." });

  try {
    const {
      sku,
      amount,
      currency = "INR",
      receipt = `rcpt_${Date.now()}`,
      notes = {},
    } = req.body || {};

    if (typeof sku !== "string" || !PLAN_CATALOG[sku]) {
      return res.status(400).json({ error: "Unknown plan." });
    }
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: "A positive amount is required." });
    }
    if (!catalogAllows(sku, amount)) {
      return res.status(400).json({ error: "Amount does not match the price of that plan." });
    }
    if (!/^INR$/i.test(currency)) {
      return res.status(400).json({ error: "Only INR is supported." });
    }

    const amountInPaise = Math.round(amount * 100);

    if (simulatePayments) {
      pruneSimOrders();
      const id = `order_sim_${crypto.randomUUID()}`;
      simOrders.set(id, { sku, amount: amountInPaise, createdAt: Date.now() });
      if (dbEnabled) {
        try {
          await domain.recordOrder({ orderId: id, userId: req.user?.id ?? null, sku, amountPaise: amountInPaise, simulated: true });
        } catch (err) {
          console.error(JSON.stringify({ level: "error", msg: "order_record_failed", error: String(err) }));
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
      return res
        .status(500)
        .json({ error: "Razorpay is not configured on the server." });
    }

    const auth = Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString("base64");
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({ amount: amountInPaise, currency, receipt, notes: { ...notes, sku } }),
    });

    let orderData;
    try {
      orderData = await response.json();
    } catch {
      orderData = {};
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: orderData?.error?.description || "Could not create the Razorpay order.",
      });
    }
    if (orderData?.id) {
      pruneLiveOrders();
      liveOrders.set(orderData.id, { sku, amount: amountInPaise, createdAt: Date.now() });
      if (dbEnabled) {
        try {
          await domain.recordOrder({ orderId: orderData.id, userId: req.user?.id ?? null, sku, amountPaise: amountInPaise, simulated: false });
        } catch (err) {
          console.error(JSON.stringify({ level: "error", msg: "order_record_failed", error: String(err) }));
        }
      }
    }
    return res.json(orderData);
  } catch (error) {
    console.error(JSON.stringify({ level: "error", msg: "order_creation_failed", error: String(error) }));
    res.status(500).json({ error: "Could not create the Razorpay order." });
  }
});

// ---------------------------------------------------------------------------
// Verify a Razorpay payment signature (HMAC-SHA256 over order_id|payment_id)
// and mint a single-use entitlement token for the purchased plan.
// Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature, sku }
// ---------------------------------------------------------------------------
app.post("/api/razorpay/verify-payment", async (req, res) => {
  if (rateLimited(req)) return res.status(429).json({ error: "Too many requests." });

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
    let boundOrder = null;
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

  const token = mintActivationToken(sku, razorpay_order_id, razorpay_payment_id);

  // DB mode: record the captured payment immediately (source=verify) so the
  // subscription is granted server-side even if the browser never redeems the
  // token (audit M7's browser-independence). Webhooks remain the backstop.
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
});

// ---------------------------------------------------------------------------
// Redeem an entitlement token (single-use). The frontend activates a plan ONLY
// through this endpoint. When the request is authenticated, the entitlement is
// persisted to the user's account (server-side source of truth).
// ---------------------------------------------------------------------------
app.post("/api/razorpay/redeem", async (req, res) => {
  if (rateLimited(req)) return res.status(429).json({ error: "Too many requests." });

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
      // Reserve under the hash PK; a concurrent duplicate insert collides and
      // is caught, treating the second redeem as a duplicate.
      await query(
        `INSERT INTO redeemed_tokens (token_hash, sku) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [tokenHash, parsed.sku]
      );
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
  res.json({ plan: parsed.sku });
});

// ---------------------------------------------------------------------------
// GST invoicing metadata (India — 18% GST split into CGST/SGST). All math in
// integer paise so subtotal + CGST + SGST always sums exactly to the total.
// Requires a valid (not-yet-redeemed) activation token.
// ---------------------------------------------------------------------------
app.post("/api/generate-invoice", (req, res) => {
  if (rateLimited(req)) return res.status(429).json({ error: "Too many requests." });

  const { planName, amount, doctorName, gstin, billingAddress, token } = req.body || {};

  const parsed = verifyActivationToken(token);
  if (!parsed) {
    return res
      .status(400)
      .json({ error: "Invoices are only generated for verified payments." });
  }

  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: "A positive amount is required." });
  }

  // Price the invoice from the token's sku in the server catalog; reject any
  // amount outside that plan's allowed prices (H1). A ₹1,499 token can no
  // longer generate a "PAID" invoice for ₹28,790.
  const allowedAmounts = PLAN_CATALOG[parsed.sku];
  if (!Array.isArray(allowedAmounts) || !allowedAmounts.includes(Math.round(amount))) {
    return res.status(400).json({ error: "Invoice amount does not match the purchased plan." });
  }

  const totalPaise = Math.round(amount * 100);
  const basePaise = Math.round(totalPaise / 1.18);
  const gstPaise = totalPaise - basePaise;
  const cgstPaise = Math.ceil(gstPaise / 2);
  const sgstPaise = gstPaise - cgstPaise;
  const paiseToRupees = (p) => Number((p / 100).toFixed(2));

  // Sequential invoice number, persisted across restarts; year rolls over with
  // the IST calendar year. Random hex ids are not acceptable on GST invoices.
  const istToday = istDateString();
  const seqYear = Number(istToday.slice(0, 4));
  if (invoiceSeq.year !== seqYear) {
    invoiceSeq = { year: seqYear, n: 0 };
  }
  invoiceSeq.n += 1;
  writeJson(INVOICE_SEQ_FILE, invoiceSeq);

  res.json({
    invoiceNumber: `MM-INV-${seqYear}-${String(invoiceSeq.n).padStart(6, "0")}`,
    date: istToday,
    planName: planName || "Premium Membership",
    doctorName: doctorName || "Doctor User",
    gstin: gstin || "Not provided",
    billingAddress: billingAddress || "India",
    subtotal: paiseToRupees(basePaise),
    cgst: paiseToRupees(cgstPaise),
    sgst: paiseToRupees(sgstPaise),
    total: paiseToRupees(totalPaise),
    status: "PAID",
  });
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

app.get("/api/quota", requireDbUser, wrap(async (req, res) => {
  res.json(await domain.getQuotaSummary(req.user.id));
}));

app.get("/api/profiles", requireDbUser, wrap(async (req, res) => {
  const profiles = await domain.browseProfiles({
    viewerId: req.user.id,
    city: typeof req.query.city === "string" ? req.query.city : undefined,
    specialty: typeof req.query.specialty === "string" ? req.query.specialty : undefined,
    q: typeof req.query.q === "string" && req.query.q.trim() ? req.query.q.trim().slice(0, 100) : undefined,
    minAge: /^\d+$/.test(req.query.min || "") ? Number(req.query.min) : undefined,
    maxAge: /^\d+$/.test(req.query.max || "") ? Number(req.query.max) : undefined,
    verifiedOnly: req.query.verified === "1",
    limit: Number(req.query.limit) || 60,
  });
  res.json({ profiles });
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

app.post("/api/interests", rateLimitMiddleware, requireDbUser, wrap(async (req, res) => {
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

app.get("/api/channels", requireDbUser, wrap(async (req, res) => {
  res.json({ channels: await domain.listChannels(req.user.id) });
}));

app.get("/api/channels/:id/messages", requireDbUser, wrap(async (req, res) => {
  res.json({ messages: await domain.listMessages(req.user.id, req.params.id) });
}));

app.post("/api/channels/:id/messages", rateLimitMiddleware, requireDbUser, wrap(async (req, res) => {
  res.status(201).json(await domain.sendMessage(req.user.id, req.params.id, req.body?.body));
}));

app.get("/api/video-dates", requireDbUser, wrap(async (req, res) => {
  res.json({ videoDates: await domain.listVideoDates(req.user.id) });
}));

app.post("/api/video-dates", rateLimitMiddleware, requireDbUser, wrap(async (req, res) => {
  const { profileId, scheduledFor, durationMinutes } = req.body || {};
  if (typeof profileId !== "string" || !profileId || !scheduledFor) {
    return res.status(400).json({ error: "profileId and scheduledFor are required." });
  }
  res.status(201).json(await domain.createVideoDate(req.user.id, profileId, scheduledFor, durationMinutes));
}));

app.post("/api/video-dates/:id/cancel", rateLimitMiddleware, requireDbUser, wrap(async (req, res) => {
  res.json(await domain.cancelVideoDate(req.user.id, req.params.id));
}));

app.get("/api/blocks", requireDbUser, wrap(async (req, res) => {
  res.json({ blocked: await domain.listBlocks(req.user.id) });
}));

app.post("/api/blocks", rateLimitMiddleware, requireDbUser, wrap(async (req, res) => {
  const { userId } = req.body || {};
  if (typeof userId !== "string" || !userId) return res.status(400).json({ error: "userId is required." });
  res.json(await domain.blockUser(req.user.id, userId));
}));

app.post("/api/blocks/unblock", rateLimitMiddleware, requireDbUser, wrap(async (req, res) => {
  const { userId } = req.body || {};
  if (typeof userId !== "string" || !userId) return res.status(400).json({ error: "userId is required." });
  res.json(await domain.unblockUser(req.user.id, userId));
}));

app.post("/api/reports", rateLimitMiddleware, requireDbUser, wrap(async (req, res) => {
  const { profileId, reason, details } = req.body || {};
  if (typeof profileId !== "string" || !profileId) return res.status(400).json({ error: "profileId is required." });
  res.status(201).json(await domain.reportUser(req.user.id, profileId, reason, details));
}));

app.post("/api/contact-reveal", rateLimitMiddleware, requireDbUser, wrap(async (req, res) => {
  const { profileId } = req.body || {};
  if (typeof profileId !== "string" || !profileId) return res.status(400).json({ error: "profileId is required." });
  res.json(await domain.revealContact(req.user.id, profileId));
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
  const ch = await domain.query(
    `SELECT id FROM channels
     WHERE ($1 IN (user_a, user_b)) AND ($2 IN (user_a, user_b))`,
    [req.user.id, toUserId]
  );
  if (ch.rowCount === 0) {
    return res.status(403).json({ error: "You are not connected to this user." });
  }
  domain.publishToUser(toUserId, "webrtc", {
    from: req.user.id,
    fromName: `${req.user.firstName || ""} ${req.user.lastName || ""}`.trim(),
    payload,
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

app.post("/api/me/photo", rateLimitMiddleware, requireDbUser, wrap(async (req, res) => {
  const dataUrl = String(req.body?.dataUrl || "");
  const m = /^data:(image\/(?:png|jpe?g|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return res.status(400).json({ error: "Upload a PNG, JPEG or WebP image." });
  if (dataUrl.length > 2 * 1024 * 1024) {
    return res.status(413).json({ error: "Image too large (max ~1.5 MB)." });
  }
  let url = dataUrl;
  if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    const ext = m[1] === "image/png" ? "png" : m[1] === "image/webp" ? "webp" : "jpg";
    const objectPath = `${req.user.id}/${crypto.randomBytes(8).toString("hex")}.${ext}`;
    const up = await fetch(`${SUPABASE_URL}/storage/v1/object/profile-photos/${objectPath}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Content-Type": m[1],
        "x-upsert": "true",
      },
      body: Buffer.from(m[2], "base64"),
    });
    if (!up.ok) {
      console.error(JSON.stringify({ level: "error", msg: "photo_upload_failed", status: up.status }));
      return res.status(502).json({ error: "Photo storage is unavailable right now." });
    }
    url = `${SUPABASE_URL}/storage/v1/object/public/profile-photos/${objectPath}`;
  }
  res.json(await domain.setPrimaryPhoto(req.user.id, url));
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
// ---------------------------------------------------------------------------
app.get("/api/admin/me", requireAdmin, wrap(async (req, res) => {
  res.json({ admin: true, root: Boolean(req.isRootAdmin), userId: req.user.id, email: req.user.email });
}));

app.post("/api/admin/users/:id/promote-admin", requireAdmin, wrap(async (req, res) => {
  if (!req.isRootAdmin) return res.status(403).json({ error: "Root admin required." });
  const target = users[req.params.id];
  if (!target) return res.status(404).json({ error: "User not found." });
  if (target.isRootAdmin) return res.status(400).json({ error: "Root admins are managed via ADMIN_EMAILS." });
  target.isAdmin = true;
  persistUsers();
  invalidateAdminFlagCache(target.id);
  if (dbEnabled) {
    await query(`UPDATE app_users SET is_admin = TRUE WHERE id = $1`, [target.id]).catch(() => {});
  }
  await domain.writeAudit(req.user.id, "admin.promote", target.id);
  res.json({ isAdmin: true });
}));

app.post("/api/admin/users/:id/demote-admin", requireAdmin, wrap(async (req, res) => {
  if (!req.isRootAdmin) return res.status(403).json({ error: "Root admin required." });
  const target = users[req.params.id];
  if (!target) return res.status(404).json({ error: "User not found." });
  if (target.isRootAdmin) return res.status(400).json({ error: "Root admins are managed via ADMIN_EMAILS." });
  target.isAdmin = false;
  persistUsers();
  invalidateAdminFlagCache(target.id);
  if (dbEnabled) {
    await query(`UPDATE app_users SET is_admin = FALSE WHERE id = $1`, [target.id]).catch(() => {});
  }
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
  const enriched = rows.map((r) => ({ ...r, suspended: Boolean(users[r.id]?.suspended) }));
  res.json({ users: enriched });
}));

app.post("/api/admin/users/:id/suspend", requireAdmin, wrap(async (req, res) => {
  const target = users[req.params.id];
  if (!target) return res.status(404).json({ error: "User not found." });
  if (target.id === req.user.id) return res.status(400).json({ error: "You cannot suspend yourself." });
  // Role hierarchy: root accounts are env-managed and untouchable here;
  // regular admins need ROOT to suspend another admin.
  if (target.isRootAdmin) return res.status(403).json({ error: "Root admins are managed via ADMIN_EMAILS." });
  if ((target.isAdmin || target.isRootAdmin) && !req.isRootAdmin) {
    return res.status(403).json({ error: "Only root admins can suspend other admins." });
  }
  target.suspended = true;
  persistUsers();
  await domain.writeAudit(req.user.id, "user.suspend", target.id, String(req.body?.reason || "").slice(0, 300));
  kickSse(target.id); // drop their live stream immediately
  res.json({ suspended: true });
}));

app.post("/api/admin/users/:id/unsuspend", requireAdmin, wrap(async (req, res) => {
  const target = users[req.params.id];
  if (!target) return res.status(404).json({ error: "User not found." });
  target.suspended = false;
  persistUsers();
  await domain.writeAudit(req.user.id, "user.unsuspend", target.id);
  res.json({ suspended: false });
}));

app.get("/api/admin/profiles", requireDbUser, requireAdmin, wrap(async (req, res) => {
  res.json({ profiles: await domain.adminListProfiles(req.query.q, Number(req.query.limit) || 50) });
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

app.post("/api/admin/samples/hide-all", requireDbUser, requireAdmin, wrap(async (req, res) => {
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
      headers: { Authorization: `Basic ${auth}` },
    });
    rzPayment = r0.ok ? await r0.json() : null;
  } catch {
    rzPayment = null;
  }
  if (!rzPayment || rzPayment.id !== paymentId) {
    return res.status(400).json({ error: "Unknown Razorpay payment." });
  }
  const refundAmount = Number.isFinite(amountPaise) && amountPaise > 0
    ? Math.min(Math.round(amountPaise), rzPayment.amount)
    : rzPayment.amount;
  const r1 = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/refund`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({ amount: refundAmount, speed: "normal" }),
  });
  const data = await r1.json().catch(() => ({}));
  if (!r1.ok) {
    return res.status(502).json({ error: data?.error?.description || "Razorpay refund failed." });
  }
  const out = await domain.recordAdminRefund({
    refundId: data.id, paymentId, amountPaise: data.amount, reason: reason || "admin-initiated",
  });
  await domain.writeAudit(req.user.id, "refund.initiate", paymentId, `refund=${data.id} amount=${data.amount}`);
  if (out.result === "applied" && out.userId) {
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
    } catch (err) {
      console.error(
        JSON.stringify({ level: "error", msg: "migrations_failed", error: String(err) })
      );
      process.exit(1);
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
          promoted++;
        }
      }
      if (promoted > 0) persistUsers();
    }
    console.log(JSON.stringify({ level: "info", msg: "root_admins_promoted", count: adminEmails.length }));
  }

  app.listen(PORT, () => {
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
}

main();
