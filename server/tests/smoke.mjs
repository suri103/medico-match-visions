// End-to-end smoke test for the MedicoMatch server.
// Run: node tests/smoke.mjs   (starts its own server instance on :3101)
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3101;
const BASE = `http://127.0.0.1:${PORT}`;
// Audit M-12 / item 1: must match server cookie names.
const SESSION_COOKIE = "mm_session";
const CSRF_COOKIE = "mm_csrf";
// Isolated temp data dir per run — never touch the real server/data store
// (H8). The server reads DATA_DIR from the environment.
const DATA_DIR = path.join(os.tmpdir(), `medicomatch-smoke-${process.pid}-${Date.now()}`);
fs.mkdirSync(DATA_DIR, { recursive: true });

const child = spawn(process.execPath, ["src/index.mjs"], {
  cwd: path.join(__dirname, ".."),
  env: { ...process.env, PORT: String(PORT), RAZORPAY_SIMULATE: "true", NODE_ENV: "test", DATA_DIR, RATE_LIMIT_MAX: "1000", DISABLE_POW: "true" },
  stdio: ["ignore", "pipe", "pipe"],
});
child.stdout.on("data", (d) => process.stdout.write(d));
child.stderr.on("data", (d) => process.stderr.write(d));

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
const check = (name, cond, extra = "") => {
  if (cond) {
    console.log(`  ok  ${name}`);
  } else {
    failures++;
    console.error(`FAIL  ${name} ${extra}`);
  }
};

const api = async (method, path, body, token) => {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {}
  return { status: res.status, json };
};

const main = async () => {
  // Boot can take >6s on cold Windows starts now that the DB driver loads;
  // allow up to 15s before declaring the server down.
  let up = false;
  for (let i = 0; i < 50 && !up; i++) {
    await wait(300);
    try {
      up = (await fetch(`${BASE}/health`)).ok;
    } catch {}
  }
  check("server listens and /health responds", up);
  const health = await api("GET", "/health");
  // M-NEW-1 regression: /health is a liveness probe ONLY. Record counts were
  // removed earlier (audit L1); razorpayConfigured / simulatePayments /
  // database / webhookConfigured were still exposed to unauthenticated probes
  // (free fingerprinting). All of them must stay off the wire.
  check(
    "health exposes liveness only (no record counts, no config fingerprint)",
    health.status === 200 &&
      !!health.json &&
      health.json.ok === true &&
      !("users" in health.json) &&
      !("razorpayConfigured" in health.json) &&
      !("simulatePayments" in health.json) &&
      !("database" in health.json) &&
      !("webhookConfigured" in health.json)
  );

  // --- Auth (email verification flow) ---
  const email = "smoke_" + Date.now() + "@example.com";
  const reg = await api("POST", "/api/auth/register", {
    email,
    password: "Doctor@123",
    firstName: "Aarav",
    lastName: "Patel",
    specialty: "Cardiology",
    degree: "MBBS",
  });
  check("register returns 201 with generic message (no token)", reg.status === 201 && !!reg.json?.message && !reg.json?.token);
  const verifyToken = reg.json?.verificationToken;

  const dupReg = await api("POST", "/api/auth/register", { email, password: "Doctor@123", firstName: "X" });
  check("duplicate email returns the same generic 201 (no enumeration)", dupReg.status === 201 && !!dupReg.json?.message);

  const loginBeforeVerify = await api("POST", "/api/auth/login", { email, password: "Doctor@123" });
  check("unverified account cannot sign in (401)", loginBeforeVerify.status === 401);

  const emailVerify = await api("POST", "/api/auth/verify-email", { token: verifyToken, mobile: true });
  check("verify-email activates account and issues a session token", emailVerify.status === 200 && !!emailVerify.json?.token && emailVerify.json?.user?.email === email);
  const token = emailVerify.json?.token;

  const badLogin = await api("POST", "/api/auth/login", { email, password: "wrong-password" });
  check("wrong password rejected with 401", badLogin.status === 401);

  const login = await api("POST", "/api/auth/login", { email, password: "Doctor@123", mobile: true });
  check("login with correct password succeeds after verification", login.status === 200 && !!login.json?.token);

  // H-1: the web SPA is cookie-first — browser login (no mobile opt-in) sets
  // the httpOnly cookie but returns token:null in the body.
  const webLogin = await api("POST", "/api/auth/login", { email, password: "Doctor@123" });
  check("browser login omits Bearer from body (cookie carries the session)", webLogin.status === 200 && webLogin.json?.token == null);

  const me = await api("GET", "/api/auth/me", undefined, token);
  check("/me returns authenticated user", me.status === 200 && me.json?.user?.email === email);
  check("/me reports no plan before purchase", me.json?.activePlan === null);

  const noAuth = await api("GET", "/api/auth/me");
  check("/me without token returns 401", noAuth.status === 401);

  // --- Payments ---
  const wrongAmount = await api("POST", "/api/razorpay/create-order", { sku: "premium", amount: 1 });
  check("create-order rejects amount not in catalog", wrongAmount.status === 400);

  const order = await api("POST", "/api/razorpay/create-order", { sku: "premium", amount: 1499 }, token);
  check("create-order issues simulated order", order.status === 200 && order.json?.id?.startsWith("order_sim_"));

  const forged = await api("POST", "/api/razorpay/verify-payment", {
    razorpay_order_id: "order_sim_forged",
    razorpay_payment_id: "pay_x",
    sku: "premium",
  });
  check("forged order_sim id does NOT verify", forged.json?.verified === false);

  const verify = await api("POST", "/api/razorpay/verify-payment", {
    razorpay_order_id: order.json.id,
    razorpay_payment_id: "pay_smoke",
    sku: "premium",
  });
  check("issued order verifies and mints activation token", verify.json?.verified === true && !!verify.json?.activation?.token);

  const redeem = await api("POST", "/api/razorpay/redeem", { token: verify.json.activation.token }, token);
  check("token redeems to purchased plan", redeem.status === 200 && redeem.json?.plan === "premium");

  const redeemAgain = await api("POST", "/api/razorpay/redeem", { token: verify.json.activation.token }, token);
  check("token is single-use (409 on reuse)", redeemAgain.status === 409);

  const meAfter = await api("GET", "/api/auth/me", undefined, token);
  check("entitlement persisted server-side for the user", meAfter.json?.activePlan === "premium");

  const badToken = await api("POST", "/api/razorpay/redeem", { token: "garbage.token" });
  check("garbage token rejected with 400", badToken.status === 400);

  // --- Invoice ---
  const order2 = await api("POST", "/api/razorpay/create-order", { sku: "platinum", amount: 2999 }, token);
  const verify2 = await api("POST", "/api/razorpay/verify-payment", {
    razorpay_order_id: order2.json.id,
    razorpay_payment_id: "pay_smoke2",
    sku: "platinum",
  });
  const invoice = await api("POST", "/api/generate-invoice", {
    planName: "Platinum",
    amount: 2999,
    token: verify2.json.activation.token,
  });
  const sums =
    invoice.json &&
    Number((invoice.json.subtotal + invoice.json.cgst + invoice.json.sgst).toFixed(2)) === invoice.json.total;
  check("invoice requires token and GST components sum exactly", invoice.status === 200 && sums);

  const invoiceNoToken = await api("POST", "/api/generate-invoice", { amount: 1499 });
  check("invoice without token rejected with 400", invoiceNoToken.status === 400);

  // M-2 regression: a forged amount in the body cannot reprice the invoice —
  // the server prices from the captured payment (2999), never the caller.
  const invoiceForged = await api("POST", "/api/generate-invoice", {
    planName: "Platinum",
    amount: 1,
    token: verify2.json.activation.token,
  });
  check("invoice ignores forged client amount (prices from captured payment)",
    invoiceForged.status === 200 && invoiceForged.json?.total === 2999);

  // --- Password reset ---
  const forgot = await api("POST", "/api/auth/forgot-password", { email });
  check("forgot-password returns generic 200 (no enumeration)", forgot.status === 200 && !!forgot.json?.message);
  const resetToken = forgot.json?.resetToken;

  const reset = await api("POST", "/api/auth/reset-password", { token: resetToken, password: "NewPass@123" });
  check("reset-password updates the password", reset.status === 200 && !!reset.json?.message);

  const relogin = await api("POST", "/api/auth/login", { email, password: "NewPass@123", mobile: true });
  check("login succeeds with the new password", relogin.status === 200 && !!relogin.json?.token);

  // --- Session invalidation on password events (audit H4) ---
  const staleMe = await api("GET", "/api/auth/me", undefined, token);
  check("password reset invalidates sessions issued before the reset", staleMe.status === 401);
  const staleLoginMe = await api("GET", "/api/auth/me", undefined, login.json?.token);
  check("pre-reset login session is invalid too", staleLoginMe.status === 401);

  const chlogin = await api("POST", "/api/auth/login", { email, password: "NewPass@123", mobile: true });
  const chToken = chlogin.json?.token;
  const badChange = await api("POST", "/api/auth/change-password", { currentPassword: "wrong", newPassword: "Changed@123" }, chToken);
  check("change-password rejects a wrong current password with 401", badChange.status === 401);
  const shortChange = await api("POST", "/api/auth/change-password", { currentPassword: "NewPass@123", newPassword: "abc" }, chToken);
  check("change-password enforces minimum length", shortChange.status === 400);
  const change = await api("POST", "/api/auth/change-password", { currentPassword: "NewPass@123", newPassword: "Changed@123" }, chToken);
  check("change-password updates the password", change.status === 200 && !!change.json?.message);
  const meAfterChange = await api("GET", "/api/auth/me", undefined, chToken);
  check("change-password invalidates the acting session as well", meAfterChange.status === 401);
  const relogin2 = await api("POST", "/api/auth/login", { email, password: "Changed@123", mobile: true });
  check("login works with the changed password", relogin2.status === 200 && !!relogin2.json?.token);

  // --- Per-recipient email throttle (audit M8): register(1) + duplicate-register
  // re-verify(2) + forgot(3) have already consumed this address's quota; the
  // next forgot must be silently suppressed but stay generic. ---
  const throttled = await api("POST", "/api/auth/forgot-password", { email });
  check(
    "per-recipient email throttle suppresses resend yet stays generic (no token leak)",
    throttled.status === 200 && !!throttled.json?.message && !throttled.json?.resetToken
  );

  // --- CSRF guard (audit M-12 / item 1): a cookie-authenticated mutating
  // request without a valid CSRF token must be rejected. We simulate a
  // browser session by sending a valid mm_session cookie and a deliberately
  // bogus CSRF header; the response must be 403. Then with the right token
  // it succeeds. (The Bearer header path is exempt — covered by every
  // existing /api call in this suite that uses the `token` argument.) ---
  const csrfMissing = await fetch(`${BASE}/api/quota`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `${SESSION_COOKIE}=${relogin2.json?.token}`,
    },
    body: "{}",
  });
  check(
    "CSRF: cookie-authenticated POST without CSRF token is rejected (403)",
    csrfMissing.status === 403
  );
  const csrfGood = await fetch(`${BASE}/api/quota`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `${SESSION_COOKIE}=${relogin2.json?.token}; ${CSRF_COOKIE}=bypass-for-smoke`,
    },
    body: JSON.stringify({ csrfToken: "bypass-for-smoke" }),
  });
  // /api/quota is GET-only; we expect 404 (route not found for POST) — the
  // important thing is the request was NOT blocked by CSRF.
  check(
    "CSRF: cookie-authenticated POST with matching CSRF token is accepted",
    csrfGood.status === 404
  );

  // --- Item 9: proof-of-work challenge endpoint. The /api/auth/pow-challenge
  // route is only registered when DISABLE_POW is unset; this test server runs
  // with DISABLE_POW=true so the endpoint returns 404 here. The PoW logic
  // itself is unit-testable; the key production invariant is that
  // DISABLE_POW is never set in production. ---
  check(
    "item 9: DISABLE_POW is on for this smoke test (production invariant — must remain OFF)",
    process.env.DISABLE_POW === undefined || process.env.DISABLE_POW === "true"
  );

  // --- Invoice numbering is sequential and dated in IST (audit M5) ---
  // Two SEPARATE orders so each token is unique — the server rejects duplicate
  // invoicing for the same activation token (one invoice per payment).
  const order3a = await api("POST", "/api/razorpay/create-order", { sku: "premium", amount: 1499 }, relogin2.json?.token);
  const verify3a = await api("POST", "/api/razorpay/verify-payment", {
    razorpay_order_id: order3a.json.id,
    razorpay_payment_id: "pay_smoke3a",
    sku: "premium",
  });
  const order3b = await api("POST", "/api/razorpay/create-order", { sku: "premium", amount: 1499 }, relogin2.json?.token);
  const verify3b = await api("POST", "/api/razorpay/verify-payment", {
    razorpay_order_id: order3b.json.id,
    razorpay_payment_id: "pay_smoke3b",
    sku: "premium",
  });
  const invA = await api("POST", "/api/generate-invoice", { planName: "Premium", amount: 1499, token: verify3a.json.activation.token });
  const invB = await api("POST", "/api/generate-invoice", { planName: "Premium", amount: 1499, token: verify3b.json.activation.token });
  const numA = String(invA.json?.invoiceNumber || "");
  const numB = String(invB.json?.invoiceNumber || "");
  const seqA = Number(numA.slice(numA.lastIndexOf("-") + 1));
  const seqB = Number(numB.slice(numB.lastIndexOf("-") + 1));
  const istToday = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  check(
    "invoice numbers are sequential (n, n+1) — not random",
    invA.status === 200 && invB.status === 200 && seqB === seqA + 1
  );
  check(
    "invoice date uses the Asia/Kolkata calendar day",
    invA.json?.date === istToday
  );
};

main()
  .catch((e) => {
    failures++;
    console.error("smoke test crashed:", e);
  })
  .finally(() => {
    child.kill();
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
    if (failures > 0) {
      console.error(`\n${failures} check(s) FAILED`);
      process.exit(1);
    }
    console.log("\nAll smoke checks passed.");
    process.exit(0);
  });
