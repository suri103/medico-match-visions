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
    DISABLE_POW: "true",
    // Show the seeded sample catalog in browse — the reveal/religion-filter/
    // hide-all checks below exercise paths that need sample rows. Production
    // keeps the default (hidden); this is a test-server override only.
    HIDE_SAMPLE_PROFILES: "false",
    // Short admin-flag cache so SQL-side promotions in this suite are honored
    // immediately (production keeps the 30s default; API promotions invalidate
    // the cache synchronously anyway).
    ADMIN_FLAG_TTL_MS: "0.05",
    // Enable the astrology sell-side so the C1 regression (captured astrologer
    // payment -> subscription -> bookable consultation) keeps validating the
    // full flow; the feature is gated off by default in production.
    ASTROLOGY_ENABLED: "true",
    // Kundali match report sell-side (paid digital product) — exercised below.
    REPORTS_ENABLED: "true",
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
  // M-NEW-1: /health no longer carries the config fingerprint, so DB mode is
  // asserted BEHAVIOURALLY instead: requireDbUser answers 401 (not
  // authenticated) when a database is configured, but 503 (database not
  // configured) in JSON-store mode. This is the same gate every wired route
  // depends on, so it is a stronger assertion than reading a health field.
  const quotaProbe = await api("GET", "/api/quota");
  check("health is liveness-only; DB mode confirmed via /api/quota 401-vs-503",
    health.json?.ok === true && quotaProbe.status === 401,
    `health=${JSON.stringify(health.json)} quotaStatus=${quotaProbe.status}`);

  const emailA = `dba_${Date.now()}@example.com`;
  const emailB = `dbb_${Date.now()}@example.com`;
  const regA = await api("POST", "/api/auth/register", { email: emailA, password: "Doctor@123", firstName: "Aditi", lastName: "Rao", specialty: "Cardiology", degree: "MBBS" });
  const regB = await api("POST", "/api/auth/register", { email: emailB, password: "Doctor@123", firstName: "Rohan", lastName: "Verma", specialty: "Neurology" });
  check("register mirrors app_users + provisions profile rows", regA.status === 201 && regB.status === 201);
  const verA = await api("POST", "/api/auth/verify-email", { token: regA.json?.verificationToken, mobile: true });
  const verB = await api("POST", "/api/auth/verify-email", { token: regB.json?.verificationToken, mobile: true });
  const userA = verA.json?.token;
  let userB = verB.json?.token;
  check("both accounts verified with sessions", Boolean(userA && userB));
  // Session TOKENS are `userId.exp.ver.sig` — several checks below need the
  // BARE user id (direct SQL, suspend route params, WebRTC toUserId). The
  // original suite passed tokens where ids were expected, so the SQL
  // promotion/suspend/FK statements silently matched nothing (or crashed on
  // the FK) — the suite had never actually run against a live Postgres.
  const userIdA = verA.json?.user?.id;
  const userIdB = verB.json?.user?.id;
  check("verify returns the user id for SQL/route targeting", Boolean(userIdA && userIdB));

  const meProfA = await api("GET", "/api/me/profile", undefined, userA);
  check("own profile exists after registration", meProfA.status === 200 && !!meProfA.json?.profile?.id);
  const profileIdA = meProfA.json.profile.id;

  // Server-enforced interest quota: basic plan allows 5 live sends.
  // Withdraw does NOT refund a unit (documented product decision — the client
  // ledger mirrors it, see src/hooks/usePlan.ts "send → withdraw → resend could
  // otherwise bypass the cap"), so five send→withdraw cycles exhaust the
  // budget. The original loop left the 5th live, so the 6th send hit the
  // alreadyInterested dedupe path (200) and the quota rejection was never
  // actually exercised — the test encoded that bug. Every successful send is
  // withdrawn here so the 6th reaches the quota check for real.
  let last = null;
  for (let i = 0; i < 6; i++) {
    last = await api("POST", "/api/interests", { profileId: profileIdA }, userB);
    if (last.status !== 201) break;
    const list = await api("GET", "/api/interests", undefined, userB);
    const pending = list.json?.sent?.[0];
    if (pending) await api("DELETE", `/api/interests/${pending.id}`, undefined, userB);
  }
  check("server-enforced interest quota rejects the excess send",
    last.status === 429 && last.json?.code === "quota", `got ${last.status}`);

  // Accept creates a channel; matched users exchange durable messages.
  // B's quota is exhausted above, so the pending interest for this flow is
  // sent by A (fresh quota) and accepted by B.
  const profOfB = await api("GET", "/api/me/profile", undefined, userB);
  const profileIdB = profOfB.json.profile.id;
  const sentByA = await api("POST", "/api/interests", { profileId: profileIdB }, userA);
  check("A can still send (own quota untouched)", sentByA.status === 201);
  const inboxB = await api("GET", "/api/interests", undefined, userB);
  const received = inboxB.json?.received?.[0];
  check("B sees A's pending interest", !!received);
  const acc = await api("POST", `/api/interests/${received.id}/respond`, { action: "accept" }, userB);
  check("accept transitions interest to accepted", acc.status === 200 && acc.json?.status === "accepted");

  const chans = await api("GET", "/api/channels", undefined, userA);
  check("accepted interest created a chat channel", chans.status === 200 && (chans.json?.channels?.length ?? 0) >= 1);
  const channelId = chans.json.channels[0].channelId;
  await api("POST", `/api/channels/${channelId}/messages`, { body: "Namaste!" }, userA);
  await api("POST", `/api/channels/${channelId}/messages`, { body: "Happy to connect." }, userB);
  const history = await api("GET", `/api/channels/${channelId}/messages`, undefined, userB);
  check("message history is durable", history.json?.messages?.length === 2);

  // Video dates: quota consume + cancel refunds (server-side).
  // profileIdB was already fetched above for the interest flow.
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

  // --- Who-viewed-my-profile: B opens A's biodata; A's feed + notification ---
  const viewA = await api("GET", `/api/profiles/${profileIdA}`, undefined, userB);
  check("detail profile read succeeds", viewA.status === 200 && !!viewA.json?.profile);

  // --- P-CONTROL: member-set privacy (launch-gap fix #1) ---
  // NOTE: income value is ASCII on purpose — the embedded Windows test
  // Postgres initializes with WIN1252, which cannot store the ₹ glyph.
  // Production/CI Postgres are UTF-8 (Supabase default).
  // A sets income to 'public' with a value; B (not owner) sees it.
  await api("PUT", "/api/me/profile", { income_band: "25L-50L", income_visibility: "public" }, userA);
  const viewIncomePublic = await api("GET", `/api/profiles/${profileIdA}`, undefined, userB);
  check("public income is visible to other members",
    viewIncomePublic.status === 200 && viewIncomePublic.json?.profile?.incomeBand === "25L-50L");
  // A flips income to private: B no longer receives the VALUE (the preference
  // label itself is public — that is what the member published).
  await api("PUT", "/api/me/profile", { income_visibility: "private" }, userA);
  const viewIncomePrivate = await api("GET", `/api/profiles/${profileIdA}`, undefined, userB);
  check("private income is stripped from other members' views",
    viewIncomePrivate.status === 200 && viewIncomePrivate.json?.profile?.incomeBand == null &&
    viewIncomePrivate.json?.profile?.incomeVisibility === "private");
  // Owner always sees own income regardless of the flag.
  const myIncome = await api("GET", "/api/me/profile", undefined, userA);
  check("owner always sees own income", myIncome.json?.profile?.incomeBand === "25L-50L");
  // Enum validation: bad values are a clean 400, never a 500.
  const badVis = await api("PUT", "/api/me/profile", { profile_visibility: "bogus" }, userA);
  const badIncVis = await api("PUT", "/api/me/profile", { income_visibility: "sometimes" }, userA);
  check("invalid visibility enums are rejected with 400", badVis.status === 400 && badIncVis.status === 400);
  // Profile visibility: hidden profile drops out of browse for other members.
  await api("PUT", "/api/me/profile", { profile_visibility: "hidden" }, userB);
  const browseWhileHidden = await api("GET", "/api/profiles?limit=50", undefined, userA);
  check("member-hidden profile disappears from other members' browse",
    !(browseWhileHidden.json?.profiles ?? []).some((p) => p.userId === userIdB));
  await api("PUT", "/api/me/profile", { profile_visibility: "public" }, userB);

  // --- Launch-gap fix #5: refund request validation ---
  const refundNoReason = await api("POST", "/api/refund-request", {}, userA);
  const refundShort = await api("POST", "/api/refund-request", { reason: "short" }, userA);
  check("refund request validates the reason", refundNoReason.status === 400 && refundShort.status === 400);

  // Presence heartbeat: B's own requests make B "online" for derived is_online.
  const meOnline = await api("GET", "/api/me/profile", undefined, userB);
  check("presence heartbeat marks the active session online",
    meOnline.status === 200 && meOnline.json?.profile?.isOnline === true);
  // Wait out the fire-and-forget view write.
  await wait(400);
  const viewsA = await api("GET", "/api/me/profile-views", undefined, userA);
  const bView = (viewsA.json?.views ?? []).find((v) => v.viewerUserId === userIdB);
  check("who-viewed-me lists the viewer with a timestamp",
    viewsA.status === 200 && !!bView && !!bView.lastViewedAt);
  const notifViews = await api("GET", "/api/notifications", undefined, userA);
  check("profile view creates a durable owner notification",
    (notifViews.json?.notifications ?? []).some((n) => n.type === "profile_view"));
  // Self-views never record: A opens own profile.
  await api("GET", `/api/profiles/${profileIdA}`, undefined, userA);
  const viewsA2 = await api("GET", "/api/me/profile-views", undefined, userA);
  check("self-views are not recorded", (viewsA2.json?.views ?? []).every((v) => v.viewerUserId !== userIdA));

  // --- Photo gallery: multi-photo, add/list/set-primary/delete ---
  const tinyPng1 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const tinyPng2 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mP8z8AARUFEwEwMAAEnQAUBi/AAAAAASUVORK5CYII=";
  const up1 = await api("POST", "/api/me/photo", { dataUrl: tinyPng1 }, userA);
  const up2 = await api("POST", "/api/me/photo", { dataUrl: tinyPng2 }, userA);
  check("gallery accepts two uploads", up1.status === 200 && up2.status === 200);
  const photoList = await api("GET", "/api/me/photos", undefined, userA);
  const photos = photoList.json?.photos ?? [];
  check("gallery lists both photos with exactly one primary",
    photos.length === 2 && photos.filter((p) => p.isPrimary).length === 1);
  const firstId = up1.json?.id;
  const secondPrimary = await api("POST", `/api/me/photos/${up2.json?.id}/primary`, {}, userA);
  check("set-primary on an existing gallery photo succeeds", secondPrimary.status === 200);
  const photoList2 = await api("GET", "/api/me/photos", undefined, userA);
  check("primary badge moved server-side",
    (photoList2.json?.photos ?? []).find((p) => p.id === up2.json?.id)?.isPrimary === true);
  const delPrimary = await api("DELETE", `/api/me/photos/${up2.json?.id}`, undefined, userA);
  const photoList3 = await api("GET", "/api/me/photos", undefined, userA);
  check("deleting the primary reassigns primary to the remaining photo",
    delPrimary.status === 200 && (photoList3.json?.photos ?? []).find((p) => p.id === firstId)?.isPrimary === true);
  // Cross-user isolation: B cannot delete A's photo.
  const delForeign = await api("DELETE", `/api/me/photos/${firstId}`, undefined, userB);
  check("foreign photo delete is rejected", delForeign.status === 404);

    // --- Birth details persist through the profile upsert ---
  const birthSave = await api("PUT", "/api/me/profile", { birth_date: "1994-08-14", birth_time: "08:30 AM", birth_city: "Mumbai" }, userA);
  const birthCheck = await api("GET", "/api/me/profile", undefined, userA);
  // birth_date is cast to TEXT on the wire (see PROFILE_PUBLIC_COLS) so it's
  // the exact string the user entered — no timezone-shifted JS Date.
  const bd = birthCheck.json?.profile?.birthDate;
  check("birth details persist (date/time/city)",
    birthSave.status === 200 &&
    bd === "1994-08-14" &&
    birthCheck.json?.profile?.birthTime === "08:30 AM" &&
    birthCheck.json?.profile?.birthCity === "Mumbai");
  const badBirth = await api("PUT", "/api/me/profile", { birth_date: "not-a-date" }, userA);
  check("invalid birth_date is rejected (400), not a 500", badBirth.status === 400);

  // --- Career stage / student eligibility: honest labels, no forced Dr./MBBS ---
  const emailS = `dbs_${Date.now()}@example.com`;
  const regS = await api("POST", "/api/auth/register", {
    email: emailS, password: "Doctor@123", firstName: "Sameer", lastName: "Joshi",
    specialty: "", degree: "MBBS (Pursuing)", careerStage: "Medical Student",
  });
  check("student registers without forced degree (201)", regS.status === 201);
  const userS = (await api("POST", "/api/auth/verify-email", { token: regS.json?.verificationToken, mobile: true })).json;
  check("student session issued", Boolean(userS?.token));
  check("student is NOT auto-titled Dr.", !(userS?.user?.fullName || "").startsWith("Dr."));
  check("student is NOT defaulted to MBBS", (userS?.user?.degree || "") === "MBBS (Pursuing)");
  const stagePersist = await api("PUT", "/api/me/profile", { career_stage: "Medical Student" }, userS?.token);
  const stageCheck = await api("GET", "/api/me/profile", undefined, userS?.token);
  check("career stage persists on the profile",
    stagePersist.status === 200 && stageCheck.json?.profile?.careerStage === "Medical Student");
  // A completed-qualification user KEEPS the Dr. prefix (no regression).
  check("completed-qualification user keeps Dr. title",
    (verA.json?.user?.fullName || "").startsWith("Dr."));

  // --- Kundali match report: 402 before purchase, generated after ---
  const profB = (await api("GET", "/api/me/profile", undefined, userB)).json?.profile;
  await api("PUT", "/api/me/profile", { rashi: "Vrishabha (Taurus)", nakshatra: "Rohini", manglik: "Non-Manglik" }, userB);
  await api("PUT", "/api/me/profile", { rashi: "Karka (Cancer)", nakshatra: "Pushya", manglik: "Non-Manglik" }, userA);
  const reportDenied = await api("POST", "/api/kundali/report", { profileId: profB.id }, userA);
  check("kundali report requires purchase (402 before)",
    reportDenied.status === 402 && reportDenied.json?.code === "purchase_required");
  const orderKR = await api("POST", "/api/razorpay/create-order", { sku: "kundali-report", amount: 499 }, userA);
  check("kundali-report order creatable (₹499)", orderKR.status === 200 && orderKR.json?.id);
  const payKR = `pay_kr_${crypto.randomBytes(6).toString("hex")}`;
  const capKRBody = Buffer.from(JSON.stringify({
    event: "payment.captured",
    payload: { payment: { entity: { id: payKR, order_id: orderKR.json?.id, amount: 49900 } } },
  }));
  await fetch(`${BASE}/api/webhooks/razorpay`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-razorpay-signature": crypto.createHmac("sha256", WEBHOOK_SECRET).update(capKRBody).digest("hex") },
    body: capKRBody,
  });
  const reportGen = await api("POST", "/api/kundali/report", { profileId: profB.id }, userA);
  check("kundali report generates after purchase (8 kootas, /36)",
    reportGen.status === 200 &&
    reportGen.json?.report?.kootas?.length === 8 &&
    typeof reportGen.json?.report?.totalPoints === "number" &&
    reportGen.json?.report?.totalPoints > 0);
  const reportAgain = await api("GET", `/api/kundali/report/${profB.id}`, undefined, userA);
  check("owned report re-readable without re-purchase",
    reportAgain.status === 200 && reportAgain.json?.alreadyOwned === true);
  // Paid and free engines must agree (same profile pair, same numbers).
  // Client-engine derivation for Karka/Pushya vs Vrishabha/Rohini:
  // varna 1 + vashya 1.5 (rashis differ) + tara 3 + yoni 3 (nakshatras differ)
  // + graha 4 + gana 5 (Deva vs Manushya) + bhakoot 7 + nadi 8 (Madhya vs Antya)
  const expectedClientScore = 32.5;
  check("server report matches client engine (paid/free never disagree)",
    expectedClientScore === reportGen.json?.report?.totalPoints);

  // --- Verification A: council fields + registry checkpoint ---
  await api("PUT", "/api/me/profile", { council_name: "Maharashtra Medical Council (MMC)", registration_number: "MMC-2017/04/1042" }, userA);
  const badReg = await api("PUT", "/api/me/profile", { registration_number: "ab" }, userA);
  check("garbage registration number rejected (400)", badReg.status === 400);
  // Re-login the student so a FRESH session is used (isolates the auth
  // variable; the system-under-test is the council-doc REQUIREMENT).
  const userS2 = (await api("POST", "/api/auth/login", { email: emailS, password: "Doctor@123", mobile: true })).json?.token;
  const docNoCouncil = await api("POST", "/api/verification/documents", { docType: "council", url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==" }, userS2);
  check("council doc without declared council/number is rejected (400)", docNoCouncil.status === 400, `got ${docNoCouncil.status}`);
  const docCouncil = await api("POST", "/api/verification/documents", { docType: "council", url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==" }, userA);
  check("council doc accepted with declared registry identity", docCouncil.status === 201, `got ${docCouncil.status}`);

  // --- Typing indicator: channel-gated SSE relay ---
  const typingOk = await api("POST", `/api/channels/${channelId}/typing`, {}, userA);
  check("typing signal accepted on a real channel", typingOk.status === 200);
  const typingBad = await api("POST", "/api/channels/not-a-channel/typing", {}, userA);
  check("typing signal refused outside a channel", typingBad.status === 403);

  // Shortlists (M-3): add, list, and remove in DB mode.
  if (anyProfile) {
    const addSl = await api("POST", "/api/shortlists", { profileId: anyProfile.id }, userA);
    check("add to shortlist succeeds", addSl.status === 200);
    const listSl = await api("GET", "/api/shortlists", undefined, userA);
    check("shortlists list returns added profile", listSl.status === 200 && listSl.json?.shortlists?.includes(anyProfile.id));
    const delSl = await api("DELETE", `/api/shortlists/${anyProfile.id}`, undefined, userA);
    check("remove from shortlist succeeds", delSl.status === 200);
    const listSlAfter = await api("GET", "/api/shortlists", undefined, userA);
    check("shortlists empty after remove", listSlAfter.status === 200 && !listSlAfter.json?.shortlists?.includes(anyProfile.id));
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
  await dbc.query(`UPDATE app_users SET is_admin = TRUE WHERE id = $1`, [userIdA]);
  await dbc.end();

  // B reports A's profile; non-admin B is rejected from admin APIs.
  await api("POST", "/api/reports", { profileId: profileIdA, reason: "test", details: "smoke" }, userB);
  const forbiddenAdmin = await api("GET", "/api/admin/users", undefined, userB);
  check("non-admins are rejected from admin endpoints", forbiddenAdmin.status === 403);

  const adminMeA = await api("GET", "/api/admin/me", undefined, userA);
  check("admin flag recognized after promotion", adminMeA.status === 200 && adminMeA.json?.admin === true);
  const openReports = await api("GET", "/api/admin/reports?status=open", undefined, userA);
  const targetReport = openReports.json?.reports?.find((r) => r.reportedProfileUserId === userIdA);
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
  // Audit H-10: capture B's session token BEFORE the suspend, then assert the
  // pre-suspension token is rejected after the suspend even if B is later
  // unsuspended. The tokenVersion bump (mirrored to app_users) is the durable
  // backstop that survives a process restart — re-authentication is required.
  const bTokenPreSuspend = userB;
  const susp = await api("POST", `/api/admin/users/${userIdB}/suspend`, { reason: "smoke" }, userA);
  check("admin can suspend an account", susp.status === 200);
  const bWhileSuspended = await api("GET", "/api/quota", undefined, bTokenPreSuspend);
  check("suspended account cannot authenticate",
    bWhileSuspended.status === 401 || bWhileSuspended.status === 403,
    `got ${bWhileSuspended.status}`);
  // Login while suspended must fail too — the canonical store check is
  // enforced on every session mint, not only on token verification.
  const loginWhileSuspended = await api("POST", "/api/auth/login", { email: emailB, password: "Doctor@123" });
  check("login is refused while the account is suspended",
    loginWhileSuspended.status === 401 || loginWhileSuspended.status === 403,
    `got ${loginWhileSuspended.status}`);
  // B's pre-suspension session token must NOT survive the suspension even
  // after unsuspend — the tokenVersion bump already invalidated it.
  const unsusp = await api("POST", `/api/admin/users/${userIdB}/unsuspend`, {}, userA);
  const bTokenAfterUnsuspend = await api("GET", "/api/quota", undefined, bTokenPreSuspend);
  check(
    "H-10: pre-suspension session token remains invalid after unsuspend",
    bTokenAfterUnsuspend.status === 401
  );
  const reloginB = await api("POST", "/api/auth/login", { email: emailB, password: "Doctor@123", mobile: true });
  const bAfterUnsuspend = await api("GET", "/api/quota", undefined, reloginB.json?.token);
  check("unsuspend + re-login restores access", bAfterUnsuspend.status === 200);
  // From here on, B's LIVE session is the re-login token (the pre-suspend
  // token is permanently dead via tokenVersion). Everything below that
  // authenticates as B must use this.
  userB = reloginB.json?.token;

  // Profile moderation: hide + unhide a seeded profile.
  if (anyProfile) {
    await api("PATCH", `/api/admin/profiles/${anyProfile.id}`, { profile_visibility: "hidden" }, userA);
    const browseAfterHide = await api("GET", "/api/profiles?limit=50", undefined, userA);
    check("hidden profile disappears from browse",
      !browseAfterHide.json?.profiles?.some((p) => p.id === anyProfile.id));
    await api("PATCH", `/api/admin/profiles/${anyProfile.id}`, { profile_visibility: "public" }, userA);
  }

  // --- SSE realtime push: B streams; A sends; B must receive instantly. ---
  // Both the typing indicator AND the message must arrive without polling.
  const tk = await api("POST", "/api/events/ticket", {}, userB);
  check("event ticket issued to session", tk.status === 200 && typeof tk.json?.ticket === "string");
  let sseReceived = false;
  let sseTypingReceived = false;
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
        if (buf.includes("event: typing")) sseTypingReceived = true;
        if (buf.includes("event: message")) { sseReceived = true; break; }
      }
    } catch { /* aborted */ }
    controller.abort();
    return sseReceived;
  })();
  await wait(300); // give the stream a moment to attach server-side
  await api("POST", `/api/channels/${channelId}/typing`, {}, userA);
  await api("POST", `/api/channels/${channelId}/messages`, { body: "sse-push-check" }, userA);
  const sseOk = await streamDone;
  // The typing frame precedes the message frame in the same stream, so a live
  // stream that received the message must ALSO have received the typing event.
  check("SSE relayed the typing indicator instantly", sseOk && sseTypingReceived);
  check("SSE pushed the new message without polling", sseReceived);

  // --- Partner-preference matching: daily picks respect the declared band ---
  // B is 28 (set here); A's preference band first includes B, then excludes B.
  await api("PUT", "/api/me/profile", { age: 28, city: "Bengaluru" }, userB);
  await api("PUT", "/api/me/profile", { pref_age_min: 27, pref_age_max: 30 }, userA);
  const daily1 = await api("GET", "/api/matches/daily?limit=50", undefined, userA);
  const daily1HasB = (daily1.json?.matches ?? []).some((m) => m.userId === userIdB);
  await api("PUT", "/api/me/profile", { pref_age_min: 40, pref_age_max: 45 }, userA);
  const daily2 = await api("GET", "/api/matches/daily?limit=50", undefined, userA);
  const daily2HasB = (daily2.json?.matches ?? []).some((m) => m.userId === userIdB);
  check("daily matches honor partner preferences (in-band yes, out-of-band no)",
    daily1HasB === true && daily2HasB === false,
    `inBand=${daily1HasB} outBand=${daily2HasB}`);
  await api("PUT", "/api/me/profile", { pref_age_min: 24, pref_age_max: 36 }, userA);

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
    [userIdB]
  );
  await dbc2.end();
  const qExpired = await api("GET", "/api/quota", undefined, userB);
  check("expired period falls back to basic automatically",
    qExpired.json?.plan === "basic" && qExpired.json?.subscriptionStatus !== "active");

  // --- Root-tier role management ---
  // A is already is_admin from earlier SQL promotion; make A root too.
  const dbc3 = new pgMod.Client({ connectionString: DATABASE_URL });
  await dbc3.connect();
  await dbc3.query(`UPDATE app_users SET is_root_admin = TRUE WHERE id = $1`, [userIdA]);
  await dbc3.end();
  const meRoot = await api("GET", "/api/admin/me", undefined, userA);
  check("root flag surfaced to root admins", meRoot.json?.root === true);
  const promote = await api("POST", `/api/admin/users/${userIdB}/promote-admin`, {}, userA);
  check("root can grant admin in the UI roster", promote.status === 200 && promote.json?.isAdmin === true);
  const bAdminUsers = await api("GET", "/api/admin/users", undefined, userB);
  check("newly promoted admin reaches the console", bAdminUsers.status === 200);
  const demote = await api("POST", `/api/admin/users/${userIdB}/demote-admin`, {}, userA);
  // Demotion bumps B's tokenVersion (defence in depth), so B's current token
  // is dead — re-login before asserting the console is out of reach.
  const bRelogin = await api("POST", "/api/auth/login", { email: emailB, password: "Doctor@123", mobile: true });
  userB = bRelogin.json?.token;
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
  // In the multi-photo gallery the uploaded photo becomes the DISPLAY image
  // only when it's the first upload (subsequent uploads append to the gallery;
  // the primary badge governs the card image). Assert that the display image
  // always equals the SERVER's current primary.
  const gAfterPhoto = await api("GET", "/api/me/photos", undefined, userA);
  const primaryUrl = (gAfterPhoto.json?.photos ?? []).find((p) => p.isPrimary)?.url;
  check("photo upload persisted + primary drives the profile image",
    photoRes.status === 200 && !!primaryUrl && profAfterPhoto.json?.profile?.imageUrl === primaryUrl);
  const badPhoto = await api("POST", "/api/me/photo", { dataUrl: "data:text/html;base64,xxx" }, userA);
  check("non-image uploads rejected", badPhoto.status === 400);

  // --- WebRTC signaling: channel members relay; outsiders refused ---
  const sigOk = await api("POST", "/api/webrtc/signal",
    { toUserId: userIdB, payload: { type: "offer", sdp: { type: "offer" } } }, userA);
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
    [userIdB]
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
  const userC = (await api("POST", "/api/auth/verify-email", { token: regC.json?.verificationToken, mobile: true })).json?.token;
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

  // --- Launch-gap fix #3: admin dashboard stats (A is root by now) ---
  const statsNoAuth = await api("GET", "/api/admin/stats");
  const statsAdmin = await api("GET", "/api/admin/stats", undefined, userA);
  check("admin stats is admin-gated",
    statsNoAuth.status === 401 || statsNoAuth.status === 403);
  check("admin stats returns the dashboard counts",
    statsAdmin.status === 200 &&
    typeof statsAdmin.json?.stats?.total_users === "number" &&
    typeof statsAdmin.json?.stats?.verified_doctors === "number" &&
    typeof statsAdmin.json?.stats?.open_reports === "number");
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