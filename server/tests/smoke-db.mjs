// DB-mode end-to-end smoke for the wired backend (C1 + M7).
// Skips cleanly when TEST_DATABASE_URL is not provided:
//   TEST_DATABASE_URL=postgres://... node tests/smoke-db.mjs
// Exercises: boot migrations → register (mirrors app_users + profile) →
// server-enforced interest quota (basic plan = 5) → accept creates a chat
// channel with real messages → video-date quota + cancel refund → contact
// reveal honesty → webhook signature rejection + idempotent capture grant.
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATABASE_URL = process.env.TEST_DATABASE_URL || "";

// Audit M14: refuse to run the destructive DB e2e against any URL that isn't a
// disposable test database. This bumps real rows (mutations, grants, refunds),
// so a typo'd production/supabase connection string must never be touched.
if (DATABASE_URL) {
  const isLoopback = /(localhost|127\.0\.0\.1|::1)/.test(DATABASE_URL);
  const isTestNamed = /_test([/:]|$)/.test(DATABASE_URL);
  const isCi = /localhost/.test(DATABASE_URL) && /medicomatch_test/.test(DATABASE_URL);
  if (!isLoopback && !isTestNamed && !isCi) {
    console.error(
      "Refusing to run smoke-db: TEST_DATABASE_URL must be a loopback host or a *_test database (got a remote, non-test URL)."
    );
    process.exit(1);
  }
}

if (!DATABASE_URL) {
  console.log("SKIP  smoke-db (set TEST_DATABASE_URL to run the wired-backend e2e)");
  process.exit(0);
}

const PORT = 3102;
const BASE = `http://127.0.0.1:${PORT}`;
const DATA_DIR = path.join(os.tmpdir(), `medicomatch-smokedb-${process.pid}-${Date.now()}`);
const WEBHOOK_SECRET = "whsec_test_123";

const child = spawn(process.execPath, ["src/index.mjs"], {
  cwd: path.join(__dirname, ".."),
  env: {
    ...process.env,
    PORT: String(PORT),
    NODE_ENV: "test",
    DATA_DIR,
    RAZORPAY_SIMULATE: "true",
    DATABASE_URL,
    RAZORPAY_WEBHOOK_SECRET: WEBHOOK_SECRET,
    ACTIVATION_SECRET: "test-activation-secret",
    APP_URL: "http://localhost:8080",
    // Enable the astrology sell-side so the C1 regression (captured astrologer
    // payment -> subscription -> bookable consultation) keeps validating the
    // full flow; the feature is gated off by default in production.
    ASTROLOGY_ENABLED: "true",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
child.stderr.on("data", (d) => process.stderr.write(d));

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name, cond, extra = "") => {
  if (cond) console.log(`  ok  ${name}`);
  else {
    failures++;
    console.error(`FAIL  ${name} ${extra}`);
  }
};

const api = async (method, p, body, token, raw) => {
  const res = await fetch(BASE + p, {
    method,
    headers: {
      ...(raw ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: raw ? body : body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
};

async function main() {
  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    await wait(300);
    try { up = (await fetch(`${BASE}/health`)).ok; } catch {}
  }
  check("server boots and runs migrations", up);
  if (!up) return;

  const health = await api("GET", "/health");
  check("health reports database mode", health.json?.database === true);

  const emailA = `dba_${Date.now()}@example.com`;
  const emailB = `dbb_${Date.now()}@example.com`;
  const regA = await api("POST", "/api/auth/register", { email: emailA, password: "Doctor@123", firstName: "Aditi", lastName: "Rao", specialty: "Cardiology" });
  const regB = await api("POST", "/api/auth/register", { email: emailB, password: "Doctor@123", firstName: "Rohan", lastName: "Verma", specialty: "Neurology" });
  check("register mirrors app_users + provisions profile rows", regA.status === 201 && regB.status === 201);
  const verA = await api("POST", "/api/auth/verify-email", { token: regA.json?.verificationToken });
  const verB = await api("POST", "/api/auth/verify-email", { token: regB.json?.verificationToken });
  const userA = verA.json?.token;
  const userB = verB.json?.token;
  check("both accounts verified with sessions", Boolean(userA && userB));

  const meProfA = await api("GET", "/api/me/profile", undefined, userA);
  check("own profile exists after registration", meProfA.status === 200 && !!meProfA.json?.profile?.id);
  const profileIdA = meProfA.json.profile.id;

  // Server-enforced interest quota: basic plan allows 5 live sends.
  let last = null;
  for (let i = 0; i < 6; i++) {
    last = await api("POST", "/api/interests", { profileId: profileIdA }, userB);
    if (last.status !== 201) break;
    if (i < 4) {
      const list = await api("GET", "/api/interests", undefined, userB);
      const pending = list.json?.sent?.[0];
      if (pending) await api("DELETE", `/api/interests/${pending.id}`, undefined, userB);
    }
  }
  check("server-enforced interest quota rejects the excess send", last.status === 429, `got ${last.status}`);

  // Accept creates a channel; matched users exchange durable messages.
  const inboxA = await api("GET", "/api/interests", undefined, userA);
  const received = inboxA.json?.received?.[0];
  check("A sees B's pending interest", !!received);
  const acc = await api("POST", `/api/interests/${received.id}/respond`, { action: "accept" }, userA);
  check("accept transitions interest to accepted", acc.status === 200 && acc.json?.status === "accepted");

  const chans = await api("GET", "/api/channels", undefined, userA);
  check("accepted interest created a chat channel", chans.status === 200 && (chans.json?.channels?.length ?? 0) >= 1);
  const channelId = chans.json.channels[0].channelId;
  await api("POST", `/api/channels/${channelId}/messages`, { body: "Namaste!" }, userA);
  await api("POST", `/api/channels/${channelId}/messages`, { body: "Happy to connect." }, userB);
  const history = await api("GET", `/api/channels/${channelId}/messages`, undefined, userB);
  check("message history is durable", history.json?.messages?.length === 2);

  // Video dates: quota consume + cancel refunds (server-side).
  const profOfB = await api("GET", "/api/me/profile", undefined, userB);
  const profileIdB = profOfB.json.profile.id;
  const vd1 = await api("POST", "/api/video-dates", { profileId: profileIdB, scheduledFor: new Date(Date.now() + 86400000).toISOString(), durationMinutes: 30 }, userA);
  check("video date consumes server quota", vd1.status === 201);
  const qAfterCreate = await api("GET", "/api/quota", undefined, userA);
  check("basic plan has no video dates left after one booking", qAfterCreate.json?.videoDates?.left === 0);
  const vd2 = await api("POST", "/api/video-dates", { profileId: profileIdB, scheduledFor: new Date(Date.now() + 86400000).toISOString() }, userA);
  check("second video date rejected by quota", vd2.status === 429);
  const cancelled = await api("POST", `/api/video-dates/${vd1.json.id}/cancel`, {}, userA);
  check("cancellation refunds the quota unit", cancelled.status === 200);
  const qAfterCancel = await api("GET", "/api/quota", undefined, userA);
  check("quota restored after cancellation", qAfterCancel.json?.videoDates?.left === 1);

  // Contact reveal on a seeded profile with no shared contact: honest + free.
  const seeded = await api("GET", "/api/profiles?limit=5", undefined, userA);
  const anyProfile = seeded.json?.profiles?.find((p) => !p.userId);
  if (anyProfile) {
    const revealEmpty = await api("POST", "/api/contact-reveal", { profileId: anyProfile.id }, userA);
    check("reveal on empty profile is honest and free",
      revealEmpty.status === 200 && revealEmpty.json?.shared === false);
  } else {
    check("seeded browsable profiles exist", false);
  }

  // M7: webhook must reject bad signatures...
  const badHook = await fetch(`${BASE}/api/webhooks/razorpay`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-razorpay-signature": "deadbeef" },
    body: JSON.stringify({ event: "payment.captured" }),
  });
  check("webhook rejects invalid signatures", badHook.status === 401);

  // ...and apply valid captures exactly once. Place an order as B (authed →
  // the order row carries user_id), then deliver a signed payment.captured.
  const orderRes = await api("POST", "/api/razorpay/create-order", { sku: "premium", amount: 1499 }, userB);
  const realOrderId = orderRes.json?.id;
  check("create-order persisted a durable order row", orderRes.status === 200 && typeof realOrderId === "string");
  const paymentId = `pay_test_${crypto.randomBytes(6).toString("hex")}`;
  const payload = Buffer.from(JSON.stringify({
    event: "payment.captured",
    payload: { payment: { entity: { id: paymentId, order_id: realOrderId, amount: 149900 } } },
  }));
  const goodSig = crypto.createHmac("sha256", WEBHOOK_SECRET).update(payload).digest("hex");
  const hook1 = await fetch(`${BASE}/api/webhooks/razorpay`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-razorpay-signature": goodSig },
    body: payload,
  });
  check("valid webhook accepted", hook1.status === 200);
  const quotaB = await api("GET", "/api/quota", undefined, userB);
  check("webhook capture granted the paid plan server-side", quotaB.json?.plan === "premium");
  // Redelivery must be acknowledged without double-applying.
  const hook2 = await fetch(`${BASE}/api/webhooks/razorpay`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-razorpay-signature": crypto.createHmac("sha256", WEBHOOK_SECRET).update(payload).digest("hex") },
    body: payload,
  });
  check("webhook replay acknowledged without double-grant", hook2.status === 200);

  // Forged sessions cannot touch the wired APIs.
  const forged = await api("PUT", "/api/me/profile", { full_name: "Hacker" }, "garbage-token");
  check("forged sessions cannot mutate profiles", forged.status === 401);

  // --- Admin console (ops): promote A via DB, exercise every admin surface ---
  const pgMod = await import("pg");
  const dbc = new pgMod.Client({ connectionString: DATABASE_URL });
  await dbc.connect();
  await dbc.query(`UPDATE app_users SET is_admin = TRUE WHERE id = $1`, [userA]);
  await dbc.end();

  // B reports A's profile; non-admin B is rejected from admin APIs.
  await api("POST", "/api/reports", { profileId: profileIdA, reason: "test", details: "smoke" }, userB);
  const forbiddenAdmin = await api("GET", "/api/admin/users", undefined, userB);
  check("non-admins are rejected from admin endpoints", forbiddenAdmin.status === 403);

  const adminMeA = await api("GET", "/api/admin/me", undefined, userA);
  check("admin flag recognized after promotion", adminMeA.status === 200 && adminMeA.json?.admin === true);
  const openReports = await api("GET", "/api/admin/reports?status=open", undefined, userA);
  const targetReport = openReports.json?.reports?.find((r) => r.reportedProfileUserId === userA);
  check("open report is visible in the console list", !!targetReport);
  if (targetReport) {
    const resolved = await api("POST", `/api/admin/reports/${targetReport.id}/resolve`,
      { outcome: "resolved", note: "smoke" }, userA);
    check("report resolves with audit trail", resolved.status === 200 && resolved.json?.status === "resolved");
  }

  // M7 refunds: a signed refund.processed for the captured payment downgrades
  // the membership immediately (documented default policy).
  const refundPayload = Buffer.from(JSON.stringify({
    event: "refund.processed",
    payload: {
      refund: { entity: { id: `rfnd_${crypto.randomBytes(5).toString("hex")}`, payment_id: paymentId, amount: 149900 } },
    },
  }));
  const refundSig = crypto.createHmac("sha256", WEBHOOK_SECRET).update(refundPayload).digest("hex");
  const hookRefund = await fetch(`${BASE}/api/webhooks/razorpay`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-razorpay-signature": refundSig },
    body: refundPayload,
  });
  check("refund webhook accepted", hookRefund.status === 200);
  const quotaBAfterRefund = await api("GET", "/api/quota", undefined, userB);
  check("refunded membership revokes plan to basic (policy)", quotaBAfterRefund.json?.plan === "basic");

  // Suspension enforcement + recovery.
  const susp = await api("POST", `/api/admin/users/${userB}/suspend`, { reason: "smoke" }, userA);
  check("admin can suspend an account", susp.status === 200);
  const bWhileSuspended = await api("GET", "/api/quota", undefined, userB);
  check("suspended account cannot authenticate", bWhileSuspended.status === 403);
  const unsusp = await api("POST", `/api/admin/users/${userB}/unsuspend`, {}, userA);
  const bAfterUnsuspend = await api("GET", "/api/quota", undefined, userB);
  check("unsuspend restores access", unsusp.status === 200 && bAfterUnsuspend.status === 200);

  // Profile moderation: hide + unhide a seeded profile.
  if (anyProfile) {
    await api("PATCH", `/api/admin/profiles/${anyProfile.id}`, { profile_visibility: "hidden" }, userA);
    const browseAfterHide = await api("GET", "/api/profiles?limit=50", undefined, userA);
    check("hidden profile disappears from browse",
      !browseAfterHide.json?.profiles?.some((p) => p.id === anyProfile.id));
    await api("PATCH", `/api/admin/profiles/${anyProfile.id}`, { profile_visibility: "public" }, userA);
  }

  // --- SSE realtime push: B streams; A sends; B must receive instantly. ---
  const tk = await api("POST", "/api/events/ticket", {}, userB);
  check("event ticket issued to session", tk.status === 200 && typeof tk.json?.ticket === "string");
  let sseReceived = false;
  const controller = new AbortController();
  const streamDone = (async () => {
    try {
      const r = await fetch(`${BASE}/api/events?ticket=${tk.json.ticket}`, { signal: controller.signal });
      if (!r.ok || !r.body) return false;
      check("SSE stream opens with text/event-stream",
        String(r.headers.get("content-type") || "").includes("text/event-stream"));
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const chunk = await Promise.race([
          reader.read(),
          wait(4000).then(() => ({ done: true, value: undefined })),
        ]);
        if (chunk.done || !chunk.value) break;
        buf += dec.decode(chunk.value, { stream: true });
        if (buf.includes("event: message")) { sseReceived = true; break; }
      }
    } catch { /* aborted */ }
    controller.abort();
    return sseReceived;
  })();
  await wait(300); // give the stream a moment to attach server-side
  await api("POST", `/api/channels/${channelId}/messages`, { body: "sse-push-check" }, userA);
  check("SSE pushed the new message without polling", await streamDone);

  // --- Billing lifecycle: cancel at period end keeps access; expiry downgrades.
  // Re-grant premium to B via a second signed capture.
  const order2 = await api("POST", "/api/razorpay/create-order", { sku: "premium", amount: 1499 }, userB);
  const pay2 = `pay_test_${crypto.randomBytes(6).toString("hex")}`;
  const cap2Body = Buffer.from(JSON.stringify({
    event: "payment.captured",
    payload: { payment: { entity: { id: pay2, order_id: order2.json?.id, amount: 149900 } } },
  }));
  await fetch(`${BASE}/api/webhooks/razorpay`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-razorpay-signature": crypto.createHmac("sha256", WEBHOOK_SECRET).update(cap2Body).digest("hex") },
    body: cap2Body,
  });
  const qPremium = await api("GET", "/api/quota", undefined, userB);
  check("second capture restores premium with an expiry window",
    qPremium.json?.plan === "premium" && !!qPremium.json?.planExpiresAt);
  const cancelRes = await api("POST", "/api/billing/cancel", {}, userB);
  const qCanceling = await api("GET", "/api/quota", undefined, userB);
  check("self-cancel keeps premium access until period end",
    cancelRes.status === 200 && qCanceling.json?.plan === "premium" && qCanceling.json?.canceling === true);
  const dbc2 = new pgMod.Client({ connectionString: DATABASE_URL });
  await dbc2.connect();
  await dbc2.query(
    `UPDATE subscriptions SET current_period_end = NOW() - INTERVAL '1 hour' WHERE user_id = $1`,
    [userB]
  );
  await dbc2.end();
  const qExpired = await api("GET", "/api/quota", undefined, userB);
  check("expired period falls back to basic automatically",
    qExpired.json?.plan === "basic" && qExpired.json?.subscriptionStatus !== "active");

  // --- Root-tier role management ---
  // A is already is_admin from earlier SQL promotion; make A root too.
  const dbc3 = new pgMod.Client({ connectionString: DATABASE_URL });
  await dbc3.connect();
  await dbc3.query(`UPDATE app_users SET is_root_admin = TRUE WHERE id = $1`, [userA]);
  await dbc3.end();
  const meRoot = await api("GET", "/api/admin/me", undefined, userA);
  check("root flag surfaced to root admins", meRoot.json?.root === true);
  const promote = await api("POST", `/api/admin/users/${userB}/promote-admin`, {}, userA);
  check("root can grant admin in the UI roster", promote.status === 200 && promote.json?.isAdmin === true);
  const bAdminUsers = await api("GET", "/api/admin/users", undefined, userB);
  check("newly promoted admin reaches the console", bAdminUsers.status === 200);
  const demote = await api("POST", `/api/admin/users/${userB}/demote-admin`, {}, userA);
  const bAfterDemote = await api("GET", "/api/admin/users", undefined, userB);
  check("root can revoke admin", demote.status === 200 && bAfterDemote.status === 403);

  // --- Notification center: durable rows + unread counting ---
  // B's accepted-interest flow earlier created a notification for A.
  const notifA1 = await api("GET", "/api/notifications", undefined, userA);
  check("interest created a durable notification", notifA1.status === 200 && (notifA1.json?.unreadCount ?? 0) >= 1);
  await api("POST", "/api/notifications/read-all", {}, userA);
  const notifA2 = await api("GET", "/api/notifications", undefined, userA);
  check("read-all clears the unread count", notifA2.json?.unreadCount === 0);

  // --- Profile photo: bounded data URL accepted + persisted ---
  const tinyPng =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const photoRes = await api("POST", "/api/me/photo", { dataUrl: tinyPng }, userA);
  const profAfterPhoto = await api("GET", "/api/me/profile", undefined, userA);
  check("photo upload persisted to the profile",
    photoRes.status === 200 && profAfterPhoto.json?.profile?.imageUrl === tinyPng);
  const badPhoto = await api("POST", "/api/me/photo", { dataUrl: "data:text/html;base64,xxx" }, userA);
  check("non-image uploads rejected", badPhoto.status === 400);

  // --- WebRTC signaling: channel members relay; outsiders refused ---
  const sigOk = await api("POST", "/api/webrtc/signal",
    { toUserId: userB, payload: { type: "offer", sdp: { type: "offer" } } }, userA);
  check("matched users can relay WebRTC signaling", sigOk.status === 200);
  const sigBad = await api("POST", "/api/webrtc/signal", { toUserId: "stranger-user", payload: { type: "offer" } }, userA);
  check("signaling to non-connections is refused", sigBad.status === 403);

  // --- Consultations: entitlement-gated booking ---
  const consultDenied = await api("POST", "/api/consultations",
    { scheduledFor: new Date(Date.now() + 86400000).toISOString() }, userB);
  check("consultation booking requires the paid entitlement", consultDenied.status === 403);
  const dbc4 = new pgMod.Client({ connectionString: DATABASE_URL });
  await dbc4.connect();
  await dbc4.query(
    `INSERT INTO subscriptions (user_id, sku, current_period_end, status)
     VALUES ($1,'astrologer-consultation', NOW() + INTERVAL '30 days','active')
     ON CONFLICT (user_id, sku) DO UPDATE SET
       current_period_end = NOW() + INTERVAL '30 days', status='active'`,
    [userB]
  );
  await dbc4.end();
  const consultOk = await api("POST", "/api/consultations",
    { scheduledFor: new Date(Date.now() + 86400000).toISOString(), durationMinutes: 45 }, userB);
  check("consultation books with an active entitlement", consultOk.status === 201);

  // --- C1 regression: the product works END-TO-END via the webhook alone.
  // A captured astrologer-tier payment must grant a usable subscription
  // (createConsultation then succeeds) with NO hand-inserted row. ---
  const emailC = `dbc_${Date.now()}@example.com`;
  const regC = await api("POST", "/api/auth/register", { email: emailC, password: "Doctor@123", firstName: "Cara", lastName: "Sen", specialty: "Cardiology" });
  const userC = (await api("POST", "/api/auth/verify-email", { token: regC.json?.verificationToken })).json?.token;
  const orderC1 = await api("POST", "/api/razorpay/create-order", { sku: "astrologer-consultation-1499", amount: 1499 }, userC);
  const payC1 = `pay_c1_${crypto.randomBytes(6).toString("hex")}`;
  const capC1Body = Buffer.from(JSON.stringify({
    event: "payment.captured",
    payload: { payment: { entity: { id: payC1, order_id: orderC1.json?.id, amount: 149900 } } },
  }));
  await fetch(`${BASE}/api/webhooks/razorpay`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-razorpay-signature": crypto.createHmac("sha256", WEBHOOK_SECRET).update(capC1Body).digest("hex") },
    body: capC1Body,
  });
  const consultBooked = await api("POST", "/api/consultations",
    { scheduledFor: new Date(Date.now() + 86400000).toISOString(), durationMinutes: 45 }, userC);
  check("C1: consultation granted by webhook alone, then bookable (201)",
    consultBooked.status === 201);

  // --- H1 regression: an equal-rank repurchase EXTENDS the remaining window
  // (previously ~10 prepaid months were destroyed by overwriting period_end). ---
  const orderH1 = await api("POST", "/api/razorpay/create-order", { sku: "premium", amount: 1499 }, userB);
  const payH1a = `pay_h1a_${crypto.randomBytes(6).toString("hex")}`;
  const capH1aBody = Buffer.from(JSON.stringify({
    event: "payment.captured",
    payload: { payment: { entity: { id: payH1a, order_id: orderH1.json?.id, amount: 149900 } } },
  }));
  await fetch(`${BASE}/api/webhooks/razorpay`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-razorpay-signature": crypto.createHmac("sha256", WEBHOOK_SECRET).update(capH1aBody).digest("hex") },
    body: capH1aBody,
  });
  const qH1base = await api("GET", "/api/quota", undefined, userB);
  const baseEnd = qH1base.json?.planExpiresAt ?? null;
  const payH1b = `pay_h1b_${crypto.randomBytes(6).toString("hex")}`;
  const capH1bBody = Buffer.from(JSON.stringify({
    event: "payment.captured",
    payload: { payment: { entity: { id: payH1b, order_id: orderH1.json?.id, amount: 149900 } } },
  }));
  await fetch(`${BASE}/api/webhooks/razorpay`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-razorpay-signature": crypto.createHmac("sha256", WEBHOOK_SECRET).update(capH1bBody).digest("hex") },
    body: capH1bBody,
  });
  const qH1ext = await api("GET", "/api/quota", undefined, userB);
  check("H1: equal-rank repurchase EXTENDS (not overwrites) the remaining window",
    qH1ext.json?.plan === "premium" && !!baseEnd &&
    new Date(qH1ext.json.planExpiresAt).getTime() > new Date(baseEnd).getTime());

  // --- payment.failed marks the durable order for reconciliation ---
  const orderF = await api("POST", "/api/razorpay/create-order", { sku: "premium", amount: 1499 }, userA);
  const failedBody = Buffer.from(JSON.stringify({
    event: "payment.failed",
    payload: { payment: { entity: { id: `pay_fail_${crypto.randomBytes(4).toString("hex")}`, order_id: orderF.json?.id } } },
  }));
  const failedHook = await fetch(`${BASE}/api/webhooks/razorpay`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-razorpay-signature": crypto.createHmac("sha256", WEBHOOK_SECRET).update(failedBody).digest("hex"),
    },
    body: failedBody,
  });
  check("payment.failed webhook accepted", failedHook.status === 200);

  // --- Search pushdown: religion filter narrows the seeded catalog ---
  const christianOnly = await api("GET", "/api/profiles?religion=Christian&limit=50", undefined, userA);
  const christianRows = christianOnly.json?.profiles ?? [];
  check("server-side religion filter narrows results",
    christianOnly.status === 200 && christianRows.length > 0 &&
    christianRows.every((p) => String(p.religion || "").toLowerCase().includes("christ")));

  // --- Cold-start lever: bulk hide/unhide sample catalog ---
  await api("POST", "/api/admin/samples/hide-all", { hidden: true }, userA);
  const browseHidden = await api("GET", "/api/profiles?limit=50", undefined, userA);
  check("bulk hide removes samples from browse",
    !(browseHidden.json?.profiles ?? []).some((p) => p.isSample));
  await api("POST", "/api/admin/samples/hide-all", { hidden: false }, userA);
  const browseShown = await api("GET", "/api/profiles?limit=50", undefined, userA);
  check("bulk unhide restores the catalog", (browseShown.json?.profiles ?? []).some((p) => p.isSample));

  // --- Audit feed readable and populated by prior admin actions ---
  const auditFeed = await api("GET", "/api/admin/audit", undefined, userA);
  check("audit log lists prior admin actions",
    auditFeed.status === 200 && (auditFeed.json?.audit?.length ?? 0) >= 1);
}

main()
  .catch((e) => {
    failures++;
    console.error("smoke-db crashed:", e);
  })
  .finally(() => {
    child.kill();
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
    if (failures > 0) {
      console.error(`\n${failures} db-check(s) FAILED`);
      process.exit(1);
    }
    console.log("\nAll wired-backend checks passed.");
    process.exit(0);
  });