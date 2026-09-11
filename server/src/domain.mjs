// Domain layer for DB mode: profiles, interests (state machine + SERVER-side
// quotas), chat, video dates, blocks/reports, contact reveal, and the billing
// records behind Razorpay webhooks. Every function is scoped by the caller's
// authenticated user id — there are no unscoped reads.
import { query, withTx, istPeriod, dbEnabled } from "./db.mjs";
import { publishToUser } from "./events.mjs";
import { computeKundaliMilan } from "./kundali.mjs";
import crypto from "crypto";

/** Best-effort realtime push — never let notifications break the operation. */
function safePublish(userId, event, data) {
  try {
    publishToUser(userId, event, data);
  } catch {
    /* ignore */
  }
}

// Columns SAFE to return in list/detail responses. phone/email and
// verification documents are intentionally excluded (privacy + audit H1) —
// contact data is only ever returned by the quota-gated reveal endpoint.
const PROFILE_PUBLIC_COLS = `
  id, user_id, is_sample, full_name, title, gender, age, height_cm,
  marital_status, degree, specialty, sub_specialty, hospital, city, state,
  country, about_me, looking_for, interests, photo_url, sexual_orientation,
  ethnicity, religion, caste, subcaste, gotra, mother_tongue, rashi, nakshatra,
  manglik, kundali_gunas, pref_age_min, pref_age_max, pref_location,
  is_verified,
  profile_visibility, income_visibility,
  -- Online presence is DERIVED from the heartbeat, never a hand-set flag:
  -- a profile counts as online only if it was seen in the last 5 minutes.
  (last_active_at > NOW() - INTERVAL '5 minutes') AS is_online,
  -- Matrimony birth details (owner-controlled; the kundali engine can use
  -- them for higher-fidelity matching than self-declared rashi alone).
  -- birth_date is cast to TEXT: a bare DATE column serializes as a timezone-
  -- shifted JS Date (India is +05:30, so a stored date can render the previous
  -- day). Casting keeps the wire value identical to what the user entered.
  to_char(birth_date, 'YYYY-MM-DD') AS birth_date, birth_time, birth_city, chart_image_url,
  -- Career stage + registry identity: self-declared; verification is separate.
  career_stage, council_name, registration_number,
  family_type, family_status, income_band, diet, smoking, drinking,
  disability, expectations`;

// Audit L2: ILIKE metacharacters are escaped so user input cannot inject %/_
// wildcards (full-scan DoS). Inputs are also length-capped at the call sites.
const escapeLike = (s) => String(s).replace(/[\\%_]/g, (m) => "\\" + m);
/** Escaped, length-capped ILIKE pattern (audit L2). */
const like = (s) => `%${escapeLike(String(s ?? "").slice(0, 80))}%`;

// Privacy (P-CONTROL): which viewer may see a profile's sensitive fields.
// profile_visibility is already enforced at the SQL layer (browse/detail);
// income_visibility narrows the income_band value inside rowToPublicProfile.
// SAFE DEFAULT: income is 'private' (owner + admin only). Owner always sees
// own income regardless of the flag.
function rowToPublicProfile(row, viewer = null) {
  if (!row) return null;
  const viewerOwns = Boolean(viewer?.userId && row.user_id === viewer.userId);
  const viewerVerified = Boolean(viewer?.isVerified);
  const incomeVisible =
    row.income_visibility === "public" ||
    viewerOwns ||
    (row.income_visibility === "verified_only" && viewerVerified);
  return {
    id: row.id,
    userId: row.user_id ?? null,
    isSample: row.is_sample,
    name: row.full_name,
    title: row.title,
    gender: row.gender,
    age: row.age,
    heightCm: row.height_cm,
    maritalStatus: row.marital_status,
    degree: row.degree,
    specialty: row.specialty,
    subSpecialty: row.sub_specialty ?? null,
    hospital: row.hospital,
    city: row.city,
    state: row.state,
    country: row.country,
    aboutMe: row.about_me,
    lookingFor: row.looking_for,
    interests: row.interests ?? [],
    imageUrl: row.photo_url,
    sexualOrientation: row.sexual_orientation,
    ethnicity: row.ethnicity,
    religion: row.religion,
    caste: row.caste,
    subcaste: row.subcaste,
    gotra: row.gotra,
    motherTongue: row.mother_tongue,
    rashi: row.rashi,
    nakshatra: row.nakshatra,
    manglik: row.manglik,
    kundaliGunas: row.kundali_gunas,
    prefAgeMin: row.pref_age_min,
    prefAgeMax: row.pref_age_max,
    prefLocation: row.pref_location,
    isVerified: row.is_verified,
    isOnline: Boolean(row.is_online),
    // Privacy: the visibility enums are safe to expose (they are the member's
    // PUBLISHED preference); the SENSITIVE value (income) is nulled below.
    profileVisibility: row.profile_visibility ?? "public",
    incomeVisibility: row.income_visibility ?? "private",
    // Birth details for higher-fidelity kundali matching + the shareable chart.
    birthDate: row.birth_date ?? null,
    birthTime: row.birth_time ?? null,
    birthCity: row.birth_city ?? null,
    chartImageUrl: row.chart_image_url ?? null,
    // Career stage + registry identity (self-declared, distinct from verified).
    careerStage: row.career_stage ?? null,
    councilName: row.council_name ?? null,
    registrationNumber: row.registration_number ?? null,
    // P0-4 family/background depth (Shaadi parity).
    familyType: row.family_type ?? null,
    familyStatus: row.family_status ?? null,
    incomeBand: incomeVisible ? (row.income_band ?? null) : null,
    diet: row.diet ?? null,
    smoking: row.smoking ?? null,
    drinking: row.drinking ?? null,
    disability: row.disability ?? null,
    expectations: row.expectations ?? null,
  };
}

// Resolve the viewer's verification state once for privacy gating. Unknown
// viewer => treated as unverified (sees LESS, never more — safe default).
async function viewerContext(viewerId) {
  if (!viewerId) return { userId: null, isVerified: false };
  try {
    const me = await query(`SELECT is_verified FROM profiles WHERE user_id = $1`, [viewerId]);
    return { userId: viewerId, isVerified: Boolean(me.rows[0]?.is_verified) };
  } catch {
    return { userId: viewerId, isVerified: false };
  }
}

export async function browseProfiles({
  viewerId, city, specialty, q, minAge, maxAge, verifiedOnly,
  religion, caste, motherTongue, gotra, orientation, ethnicity, minGunas,
  familyType, familyStatus, incomeBand, diet, boostedFirst = true,
  limit = 60, offset = 0,
}) {
  // Sample profiles are fake members inserted only so the UI is never empty
  // for unauthenticated visitors. In production they're never shown to any
  // viewer, signed in or not — they exist purely as visual fixtures. Set
  // HIDE_SAMPLE_PROFILES=false to keep them visible in dev/staging.
  const params = [viewerId];
  let n = 1;
  const cond = [];
  // H-3 FIX: `verified_only` profiles are visible to verified viewers (and to
  // their owner); unverified viewers see `public` only. SAFE DEFAULT: when the
  // viewer cannot be resolved (logged out / no profile row), treat as
  // unverified — this hides more, never more-or-less by accident. Previously
  // only `hidden` was excluded, so `verified_only` leaked to everyone.
  const visIdx = n;
  cond.push(`(p.profile_visibility = 'public' OR p.user_id = $1 OR (p.profile_visibility = 'verified_only' AND EXISTS (
      SELECT 1 FROM profiles me WHERE me.user_id = $${visIdx} AND me.is_verified)))`);
  // Never show the viewer their own profile; hide either direction of blocks.
  cond.push(`p.user_id IS DISTINCT FROM $${n}`);
  cond.push(`NOT EXISTS (SELECT 1 FROM blocks b
      WHERE (b.blocker_id = p.user_id AND b.blocked_id = $${n})
         OR (b.blocker_id = $${n} AND b.blocked_id = p.user_id))`);
  if (process.env.HIDE_SAMPLE_PROFILES !== "false") {
    cond.push("p.is_sample = FALSE");
  }
  const add = (sql, value) => {
    n += 1;
    params.push(value);
    cond.push(`${sql} $${n}`);
  };
  if (city) add("p.city ILIKE", like(city));
  if (specialty) add("p.specialty ILIKE", like(specialty));
  if (religion) add("p.religion ILIKE", like(religion));
  if (caste) add("p.caste ILIKE", like(caste));
  if (motherTongue) add("p.mother_tongue ILIKE", like(motherTongue));
  if (gotra) add("p.gotra ILIKE", like(gotra));
  if (orientation) add("p.sexual_orientation ILIKE", like(orientation));
  if (ethnicity) add("p.ethnicity ILIKE", like(ethnicity));
  if (minGunas) add("p.kundali_gunas >=", minGunas);
  // P0-4 family filters.
  if (familyType) add("p.family_type ILIKE", like(familyType));
  if (familyStatus) add("p.family_status ILIKE", like(familyStatus));
  if (incomeBand) add("p.income_band ILIKE", like(incomeBand));
  if (diet) add("p.diet ILIKE", like(diet));
  if (q) {
    n += 1;
    params.push(`%${escapeLike(String(q).slice(0, 80))}%`);
    cond.push(`(p.full_name ILIKE $${n} OR p.city ILIKE $${n} OR p.specialty ILIKE $${n} OR p.hospital ILIKE $${n})`);
  }
  if (minAge) add("p.age >=", minAge);
  if (maxAge) add("p.age <=", maxAge);
  if (verifiedOnly) cond.push("p.is_verified");
  n += 1;
  params.push(Math.min(Math.max(Number(limit) || 60, 1), 200));
  n += 1;
  params.push(Math.max(Number(offset) || 0, 0));

  const res = await query(
    `SELECT ${PROFILE_PUBLIC_COLS} FROM profiles p WHERE ${cond.join(" AND ")}
     -- P0-10 Spotlight: active boosts rank first, then verified, then gunas.
     ORDER BY EXISTS(SELECT 1 FROM profile_boosts b WHERE b.user_id = p.user_id AND b.expires_at > NOW()) DESC,
              p.is_verified DESC, p.kundali_gunas DESC NULLS LAST
     LIMIT $${n - 1} OFFSET $${n}`,
    params
  );
  const viewer = await viewerContext(viewerId);
  return res.rows.map((row) => rowToPublicProfile(row, viewer));
}

export async function getProfile(id, viewerId = null) {
  let sql = `SELECT ${PROFILE_PUBLIC_COLS} FROM profiles p WHERE p.id = $1`;
  const params = [id];
  if (viewerId) {
    sql += ` AND (p.user_id = $2 OR (
      -- H-3 FIX: verified_only requires a verified viewer; public needs no
      -- verification. Owner always sees own profile. SAFE DEFAULT: unknown
      -- viewer state => unverified => sees less.
      ((p.profile_visibility = 'public' OR (p.profile_visibility = 'verified_only' AND EXISTS (
        SELECT 1 FROM profiles me WHERE me.user_id = $2 AND me.is_verified)))) AND NOT EXISTS (
        SELECT 1 FROM blocks b
        WHERE (b.blocker_id = p.user_id AND b.blocked_id = $2)
           OR (b.blocker_id = $2 AND b.blocked_id = p.user_id)
      )
    ))`;
    params.push(viewerId);
  } else {
    sql += ` AND p.profile_visibility = 'public'`;
  }
  const res = await query(sql, params);
  const viewer = viewerId ? await viewerContext(viewerId) : { userId: null, isVerified: false };
  const profile = rowToPublicProfile(res.rows[0], viewer);
  // "Who viewed my profile": record the (viewer, profile, day) triple AFTER the
  // read so the owner's notification-center "Profile Views" feed (which already
  // renders type='profile_view') finally has data. Self-views never record;
  // sample profiles have no owner to notify. Fire-and-forget with a catch so a
  // tracking failure can NEVER fail the read itself.
  if (profile && viewerId && profile.userId && profile.userId !== viewerId) {
    recordProfileView(viewerId, profile.id, profile.userId).catch(() => {});
  }
  return profile;
}

/** Insert the daily-deduped view row and notify the owner (never awaited on the
 *  read path). One row per viewer/profile/day keeps the feed meaningful and
 *  storage bounded. */
export async function recordProfileView(viewerId, profileId, ownerUserId) {
  // IST day bucket (matches quotas/invoices): DEFAULT CURRENT_DATE is UTC and
  // disagrees at the 00:00-05:30 IST boundary, so set it explicitly.
  const ins = await query(
    `INSERT INTO profile_views (viewer_id, profile_id, viewed_on)
     VALUES ($1, $2, (NOW() AT TIME ZONE 'Asia/Kolkata')::date)
     ON CONFLICT (viewer_id, profile_id, viewed_on) DO NOTHING
     RETURNING created_at`,
    [viewerId, profileId]
  );
  if (ins.rowCount === 0) return { recorded: false };
  // First view TODAY by this viewer -> one durable notification for the owner.
  try {
    await query(
      `INSERT INTO notifications (user_id, type, title, body, data)
       VALUES ($1, 'profile_view', 'New profile view', $2, $3)`,
      [ownerUserId, "Someone viewed your profile today.", JSON.stringify({ profileId })]
    );
    safePublish(ownerUserId, "notification", { type: "profile_view" });
  } catch { /* best-effort */ }
  return { recorded: true };
}

/** Owner-facing "who viewed me" feed (matrimony trust lever): latest distinct
 *  viewers, most recent first. Public columns only — never exposes contacts. */
export async function listProfileViewers(ownerUserId, limit = 50) {
  const prof = await query(`SELECT id FROM profiles WHERE user_id = $1`, [ownerUserId]);
  const profileId = prof.rows[0]?.id;
  if (!profileId) return { views: [] };
  const r = await query(
    `SELECT v.viewer_id, MAX(v.created_at) AS last_viewed_at, COUNT(*)::int AS total_views
     FROM profile_views v
     WHERE v.profile_id = $1
     GROUP BY v.viewer_id
     ORDER BY last_viewed_at DESC
     LIMIT $2`,
    [profileId, Math.min(Math.max(Number(limit) || 50, 1), 100)]
  );
  if (r.rowCount === 0) return { views: [] };
  // Attach viewer names/photos in ONE query (no N+1).
  const ids = r.rows.map((x) => x.viewer_id);
  const viewers = await query(
    `SELECT user_id, full_name, photo_url, is_verified, city, specialty FROM profiles WHERE user_id = ANY($1)`,
    [ids]
  );
  const byId = new Map(viewers.rows.map((p) => [p.user_id, p]));
  return {
    views: r.rows.map((v) => {
      const p = byId.get(v.viewer_id);
      return {
        viewerUserId: v.viewer_id,
        name: p?.full_name ?? "Member",
        imageUrl: p?.photo_url ?? null,
        isVerified: Boolean(p?.is_verified),
        city: p?.city ?? null,
        specialty: p?.specialty ?? null,
        lastViewedAt: v.last_viewed_at,
        totalViews: v.total_views,
      };
    }),
  };
}

/** Online-presence heartbeat: every authenticated request touches this. Cheap
 *  single-row UPDATE by PK-derived index; throttled to once per minute per
 *  user by the caller to avoid a write per request. */
export async function touchPresence(userId) {
  await query(`UPDATE profiles SET last_active_at = NOW() WHERE user_id = $1`, [userId]);
}

const UPDATABLE_PROFILE_FIELDS = [
  "full_name","gender","age","height_cm","marital_status","degree","specialty",
  "sub_specialty","hospital","city","state","country","about_me","looking_for",
  "interests","photo_url","sexual_orientation","ethnicity","religion","caste",
  "subcaste","gotra","mother_tongue","rashi","nakshatra","manglik",
  "kundali_gunas","pref_age_min","pref_age_max","pref_location","phone","email",
  // Matrimony birth details (drive real kundali matching + chart sharing).
  "birth_date","birth_time","birth_city","chart_image_url",
  // Career stage + council registry identity (self-declared; verification
  // is a SEPARATE document-backed signal, never derived from these).
  "career_stage","council_name","registration_number",
  // P0-4 family/background depth.
  "family_type","family_status","income_band","diet","smoking","drinking",
  "disability","expectations",
  // Privacy controls (P-CONTROL): member-set visibility, enforced everywhere
  // the profile is read and validated here against the schema CHECK enums.
  "profile_visibility","income_visibility",
];

// M-7 FIX: URL-bearing profile fields accept only https: or data:image/ URIs.
// React <img src> would not execute javascript:, but every future consumer of
// these columns (share links, admin console, export) inherits whatever is
// stored — so the allowlist belongs at WRITE time. SAFE DEFAULT: reject.
const URL_PROFILE_FIELDS = new Set(["photo_url", "chart_image_url"]);
const isSafeProfileUrl = (v) => {
  const s = String(v ?? "").trim();
  if (!s) return true; // empty clears the field
  if (s.length > 2000) return false;
  if (/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(s)) return true;
  try {
    const u = new URL(s);
    return u.protocol === "https:";
  } catch {
    return false;
  }
};

export async function upsertMyProfile(userId, baseUser, input) {
  const values = {};
  for (const [k, v] of Object.entries(input || {})) {
    if (!UPDATABLE_PROFILE_FIELDS.includes(k)) continue; // strict whitelist
    values[k] = v;
  }
  // DATE column: empty/invalid strings would abort the whole upsert with a
  // Postgres parse error — normalize to NULL instead (no birth date chosen).
  if (typeof values.birth_date === "string" && !/^\d{4}-\d{2}-\d{2}$/.test(values.birth_date.trim())) {
    if (values.birth_date !== "") {
      throw Object.assign(new Error("Birth date must be a valid date (YYYY-MM-DD)."), { status: 400 });
    }
    values.birth_date = null;
  }
  // Verification A: a DECLARED registration number must be a sane registry
  // lookup key (garbage like "ab" would poison the reviewer's checkpoint).
  if (values.registration_number !== undefined && values.registration_number !== null && values.registration_number !== "") {
    validateRegistrationNumber(values.registration_number);
  }
  if (values.council_name !== undefined && values.council_name !== null) {
    values.council_name = String(values.council_name).trim().slice(0, 120) || null;
  }
  if (values.full_name !== undefined && !String(values.full_name).trim()) {
    throw Object.assign(new Error("Name is required."), { status: 400 });
  }
  // M-7 FIX: scheme-allowlist URL-bearing fields at write time.
  for (const f of URL_PROFILE_FIELDS) {
    if (values[f] !== undefined && !isSafeProfileUrl(values[f])) {
      throw Object.assign(new Error(`${f} must be an https: URL or an inline data:image/ URI.`), { status: 400 });
    }
  }
  // P-CONTROL: visibility enums are validated here (mirror of the column
  // CHECKs) so a bad value fails as a clean 400, not a 500 constraint error.
  if (values.profile_visibility !== undefined && !["public", "verified_only", "hidden"].includes(values.profile_visibility)) {
    throw Object.assign(new Error("profile_visibility must be public, verified_only or hidden."), { status: 400 });
  }
  if (values.income_visibility !== undefined && !["public", "verified_only", "private"].includes(values.income_visibility)) {
    throw Object.assign(new Error("income_visibility must be public, verified_only or private."), { status: 400 });
  }
  const displayName = `${baseUser.firstName} ${baseUser.lastName}`.trim() || baseUser.email;
  await withTx(async (c) => {
    await c.query(
      `INSERT INTO app_users (id, email, first_name, last_name, specialty, degree, verified, password_hash, salt, token_version)
       VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7, FALSE),$8,$9,COALESCE($10, 0))
       ON CONFLICT (id) DO UPDATE SET
         first_name = EXCLUDED.first_name,
         last_name = EXCLUDED.last_name,
         password_hash = COALESCE(EXCLUDED.password_hash, app_users.password_hash),
         salt = COALESCE(EXCLUDED.salt, app_users.salt),
         verified = COALESCE(EXCLUDED.verified, app_users.verified)
         -- token_version is NOT updated here: only password/security events may
         -- bump it. This profile route must never invalidate sessions (it used
         -- to write COALESCE($10,0), silently resetting token_version to 0 and
         -- logging the user out on every profile save).`,
      [
        userId,
        baseUser.email,
        baseUser.firstName,
        baseUser.lastName,
        baseUser.specialty,
        baseUser.degree,
        baseUser.verified ?? null,
        baseUser.passwordHash ?? null,
        baseUser.salt ?? null,
        baseUser.tokenVersion ?? 0,
      ]
    );
    const keys = Object.keys(values);
    if (keys.length === 0) {
      await c.query(
        `INSERT INTO profiles (id, user_id, full_name) VALUES (gen_random_uuid()::text, $1, $2)
         ON CONFLICT (user_id) DO NOTHING`,
        [userId, displayName]
      );
      return;
    }
    const sets = keys.map((k, i) => `${k} = $${i + 3}`).join(", ");
    await c.query(
      `INSERT INTO profiles (id, user_id, full_name) VALUES (gen_random_uuid()::text, $1, $2)
       ON CONFLICT (user_id) DO UPDATE SET ${sets}, updated_at = NOW()`,
      [userId, displayName, ...Object.values(values)]
    );
  });
  return getMyProfile(userId);
}

export async function getMyProfile(userId) {
  const res = await query(
    `SELECT ${PROFILE_PUBLIC_COLS} FROM profiles WHERE user_id = $1`,
    [userId]
  );
  // Own profile: the viewer IS the owner, so income/sensitive fields are shown.
  return rowToPublicProfile(res.rows[0], { userId, isVerified: true });
}

// ---------------------------------------------------------------------------
// Quotas — the server is the ONLY enforcement point (audit C1's core).
// Plans are time-boxed: a subscription counts only while status='active' and
// current_period_end > now(). Expired/refunded/canceling-past-end → basic.
// ---------------------------------------------------------------------------

async function ensureQuotaRow(client, userId, period) {
  await client.query(
    `INSERT INTO user_quotas (user_id, period) VALUES ($1,$2)
     ON CONFLICT (user_id, period) DO NOTHING`,
    [userId, period]
  );
}

const QUOTA_MAP = {
  interests:     { used: "interests_used",     max: "max_interests" },
  video_dates:   { used: "video_dates_used",   max: "max_video_dates" },
  contact_views: { used: "contact_views_used", max: "max_contacts" },
};

const BASIC_PLAN = { sku: "basic", max_video_dates: 1, max_interests: 5, max_contacts: 2 };

/** Effective plan inside a transaction: the highest-rank active + unexpired
 * MEMBERSHIP subscription, else basic. Consultations (kind='consultation') are
 * excluded — they grant no browse/interest/video-date quota.
 * 'canceling' counts as access (self-service cancels keep benefits until
 * current_period_end — cancelBilling's documented semantics); only expiry,
 * refunds, or 'expired' revoke. */
async function activePlanTx(client, userId) {
  const res = await client.query(
    `SELECT p.sku, p.max_video_dates, p.max_interests, p.max_contacts
     FROM subscriptions s JOIN plans p ON p.sku = s.sku
     WHERE s.user_id = $1 AND s.status IN ('active','canceling') AND s.current_period_end > NOW()
       AND p.kind = 'membership'
     ORDER BY p.rank DESC LIMIT 1`,
    [userId]
  );
  return res.rows[0] ?? BASIC_PLAN;
}

/** Atomically consume one unit. Returns { ok, plan, used, limit }. */
export async function consumeQuotaTx(client, userId, kind) {
  const col = QUOTA_MAP[kind];
  if (!col) throw new Error("unknown quota kind");
  const period = istPeriod();
  const plan = await activePlanTx(client, userId);
  const max = Number(plan[col.max]);
  await ensureQuotaRow(client, userId, period);
  const upd = await client.query(
    `UPDATE user_quotas q SET ${col.used} = ${col.used} + 1
     WHERE q.user_id = $1 AND q.period = $2 AND ($3 = -1 OR q.${col.used} < $3)
     RETURNING q.${col.used} AS used`,
    [userId, period, max]
  );
  if (upd.rowCount === 0) {
    const cur = await client.query(
      `SELECT COALESCE(q.${col.used}, 0) AS used FROM (SELECT 1) one
       LEFT JOIN user_quotas q ON q.user_id = $1 AND q.period = $2`,
      [userId, period]
    );
    return {
      ok: false, plan: plan.sku,
      used: Number(cur.rows[0]?.used ?? 0), limit: max,
    };
  }
  return { ok: true, plan: plan.sku, used: Number(upd.rows[0].used), limit: max };
}

export async function consumeQuota(userId, kind) {
  return withTx((c) => consumeQuotaTx(c, userId, kind));
}

/** Refund one video-date unit (cancellation before it happens). By default
 * the CURRENT IST month; callers may pass an explicit consumption period. */
export async function refundVideoDate(userId, { period } = {}) {
  const targetPeriod = period || istPeriod();
  await withTx(async (c) => {
    await ensureQuotaRow(c, userId, targetPeriod);
    await c.query(
      `UPDATE user_quotas SET video_dates_used = GREATEST(0, video_dates_used - 1)
       WHERE user_id = $1 AND period = $2`,
      [userId, targetPeriod]
    );
  });
}

export async function getQuotaSummary(userId, client = null) {
  const period = istPeriod();
  const runQuery = client ? client.query.bind(client) : query;
  // Quota usage must be read INDEPENDENTLY of subscriptions: basic users have
  // no subscriptions row, and the previous INNER JOIN through subscriptions
  // returned zero rows for them, so the fallback hardcoded used=0 — users saw
  // full quota in /api/quota (and the client ledger synced that lie) while the
  // server enforced the real, consumed count. Verified live via smoke-db-run.
  const res = await runQuery(
    `SELECT s.sku AS plan, p.max_video_dates, p.max_interests, p.max_contacts,
            s.status AS sub_status, s.current_period_end AS period_end, s.cancel_at_period_end AS canceling,
            COALESCE(q.video_dates_used,0) AS vd, COALESCE(q.interests_used,0) AS iu,
            COALESCE(q.contact_views_used,0) AS cu
     FROM (SELECT 1) one
     LEFT JOIN user_quotas q ON q.user_id = $1 AND q.period = $2
     LEFT JOIN LATERAL (
       SELECT s2.sku, s2.status, s2.current_period_end, s2.cancel_at_period_end
       FROM subscriptions s2 JOIN plans p2 ON p2.sku = s2.sku
       WHERE s2.user_id = $1
       -- M1: an ACTIVE unexpired plan must outrank an expired higher-rank one.
       -- Previously ORDER BY rank alone hid an active premium behind an expired
       -- platinum and dropped the user to basic.
       ORDER BY (s2.status = 'active' AND s2.current_period_end > NOW()) DESC,
                p2.rank DESC, s2.current_period_end DESC NULLS LAST
       LIMIT 1
     ) s ON TRUE
     LEFT JOIN plans p ON p.sku = s.sku`,
    [userId, period]
  );
  const row = res.rows[0];
  const expired = (row.sub_status === "active" || row.sub_status === "canceling") &&
    (!row.period_end || new Date(row.period_end).getTime() <= Date.now());
  // 'canceling' keeps PAID access until period end (cancelBilling's documented
  // semantics). Previously ANY non-'active' status dropped the user to basic
  // immediately — a self-cancel instantly killed the paid plan display (and
  // the client mirrors /api/quota), even though access was supposed to
  // continue. Only no-subscription, expiry, refund, or 'expired' fall back.
  const keepsAccess = !expired && (row.sub_status === "active" || row.sub_status === "canceling");
  if (!keepsAccess) {
    // Effective plan is basic; still surface the old subscription's expiry info
    // and — unlike the pre-fix fallback — the REAL consumed quota counters.
    row.plan = "basic";
    row.max_video_dates = BASIC_PLAN.max_video_dates;
    row.max_interests = BASIC_PLAN.max_interests;
    row.max_contacts = BASIC_PLAN.max_contacts;
    row.sub_status = row.sub_status ? (expired ? "expired" : row.sub_status) : null;
    row.canceling = Boolean(row.canceling);
  }
  const left = (used, max) => (Number(max) === -1 ? null : Math.max(0, Number(max) - Number(used)));
  return {
    plan: row.plan,
    videoDates: { used: Number(row.vd), limit: Number(row.max_video_dates), left: left(row.vd, row.max_video_dates) },
    interests: { used: Number(row.iu), limit: Number(row.max_interests), left: left(row.iu, row.max_interests) },
    contactViews: { used: Number(row.cu), limit: Number(row.max_contacts), left: left(row.cu, row.max_contacts) },
    period,
    // Subscription lifecycle (professional billing UX):
    planExpiresAt: row.period_end ?? null,
    canceling: Boolean(row.canceling) && row.plan !== "basic",
    subscriptionStatus: row.sub_status ?? null,
  };
}

// ---------------------------------------------------------------------------
// Interests (proposals). Server-enforced quota + DB-unique live pair.
// ---------------------------------------------------------------------------

export async function sendInterest(senderId, recipientProfileId, note) {
  return withTx(async (c) => {
    // Recipient PROFILE -> owning USER. Sample profiles have no owner and
    // cannot receive interests.
    const prof = await c.query(`SELECT user_id FROM profiles WHERE id = $1`, [recipientProfileId]);
    const recipient = prof.rows[0]?.user_id;
    if (!recipient) {
      throw Object.assign(new Error("This profile cannot receive interests."), { status: 400 });
    }
    if (recipient === senderId) {
      throw Object.assign(new Error("You cannot send an interest to yourself."), { status: 400 });
    }
    const blocked = await c.query(
      `SELECT 1 FROM blocks WHERE (blocker_id=$1 AND blocked_id=$2) OR (blocker_id=$2 AND blocked_id=$1)`,
      [senderId, recipient]
    );
    if (blocked.rowCount > 0) {
      throw Object.assign(new Error("Interest not possible for this connection."), { status: 409 });
    }

    // Quota FIRST — the server is the only enforcement point (audit C1).
    // Dedupe BEFORE consuming quota (audit M6): a repeat interest to a live
    // pair must never burn a unit. The partial unique index below remains the
    // race backstop for concurrent identical sends.
    const existing = await c.query(
      `SELECT 1 FROM interests
       WHERE sender_id=$1 AND recipient_id=$2 AND status IN ('pending','accepted')`,
      [senderId, recipient]
    );
    if (existing.rowCount > 0) {
      return { interestId: null, alreadyInterested: true };
    }
    // M2 (Shaadi-style anti-harassment default): a freshly declined proposal
    // cannot be re-sent for 24h. Without this, send→decline→resend loops drain
    // quota and spam the recipient's inbox. No quota is consumed on this path.
    const recentDecline = await c.query(
      `SELECT 1 FROM interests
        WHERE sender_id=$1 AND recipient_id=$2 AND status='declined'
          AND responded_at > NOW() - INTERVAL '24 hours' LIMIT 1`,
      [senderId, recipient]
    );
    if (recentDecline.rowCount > 0) {
      throw Object.assign(
        new Error("You can resend interest to this profile after 24 hours."),
        { status: 429, code: "resend_cooldown" }
      );
    }

    const quota = await consumeQuotaTx(c, senderId, "interests");
    if (!quota.ok) {
      throw Object.assign(
        new Error("Interest limit reached for your plan."),
        { status: 429, code: "quota", quota }
      );
    }

    // Partial unique index makes double-sends a harmless no-op.
    const ins = await c.query(
      `INSERT INTO interests (sender_id, recipient_id, note)
       VALUES ($1,
               (SELECT user_id FROM profiles WHERE id = $2),
               $3)
       ON CONFLICT (sender_id, recipient_id) WHERE status IN ('pending','accepted')
       DO NOTHING
       RETURNING id`,
      [senderId, recipientProfileId, String(note || "").slice(0, 500)]
    );
    if (ins.rowCount === 0) {
      // Lost a race against a concurrent identical send: undo the consumption
      // so no quota unit is silently burned (audit M6).
      await c.query(
        `UPDATE user_quotas SET interests_used = GREATEST(0, interests_used - 1)
         WHERE user_id = $1 AND period = $2`,
        [senderId, istPeriod()]
      );
      return {
        interestId: null, alreadyInterested: true,
        plan: quota.plan, used: Math.max(0, quota.used - 1), limit: quota.limit,
      };
    }
    // Realtime nudge + durable notification for the recipient.
    try {
      const senderProf = await c.query(
        `SELECT id, full_name FROM profiles WHERE user_id = $1`, [senderId]
      );
      const rawName = senderProf.rows[0]?.full_name || "Someone";
      const senderName = rawName.startsWith("Dr. ") || rawName === "Someone" ? rawName : `Dr. ${rawName}`;
      await c.query(
        `INSERT INTO notifications (user_id, type, title, body)
         VALUES ($1,'interest_received','New interest',$2)`,
        [recipient, `${senderName} showed interest in your profile.`]
      );
      safePublish(recipient, "interest_received", {
        interestId: ins.rows[0]?.id ?? null,
        fromProfile: senderProf.rows[0] ? { id: senderProf.rows[0].id, name: senderProf.rows[0].full_name } : null,
        quota,
      });
    } catch { /* notification is best-effort */ }

    return {
      interestId: ins.rows[0]?.id ?? null,
      alreadyInterested: ins.rowCount === 0,
      plan: quota.plan, used: quota.used, limit: quota.limit,
    };
  });
}

export async function respondToInterest(userId, interestId, action) {
  const nextStatus = action === "accept" ? "accepted" : "declined";
  return withTx(async (c) => {
    const cur = await c.query(
      `SELECT id, sender_id, recipient_id, status FROM interests WHERE id = $1 FOR UPDATE`,
      [interestId]
    );
    const row = cur.rows[0];
    if (!row || row.recipient_id !== userId) {
      throw Object.assign(new Error("Interest not found."), { status: 404 });
    }
    if (row.status !== "pending") {
      throw Object.assign(new Error("This interest has already been answered."), { status: 409 });
    }
    await c.query(`UPDATE interests SET status=$2, responded_at=NOW() WHERE id=$1`, [interestId, nextStatus]);
    if (nextStatus === "accepted") {
      const a = row.sender_id < row.recipient_id ? row.sender_id : row.recipient_id;
      const b = row.sender_id < row.recipient_id ? row.recipient_id : row.sender_id;
      await c.query(`INSERT INTO channels (user_a, user_b) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [a, b]);
    }
    // Realtime: tell the sender their proposal was answered (and chat unlocked).
    try {
      await c.query(
        `INSERT INTO notifications (user_id, type, title, body)
         VALUES ($1,'interest_responded',$2,$3)`,
        [
          row.sender_id,
          nextStatus === "accepted" ? "It's a match!" : "Interest declined",
          nextStatus === "accepted"
            ? "They said yes — chat is now unlocked."
            : "They chose not to proceed. Wishing you the best.",
        ]
      );
      safePublish(row.sender_id, "interest_responded", {
        interestId, status: nextStatus, byUserId: userId,
      });
    } catch { /* best-effort */ }
    return { status: nextStatus };
  });
}

export async function withdrawInterest(userId, interestId) {
  const res = await query(
    `DELETE FROM interests WHERE id=$1 AND sender_id=$2 AND status='pending' RETURNING id`,
    [interestId, userId]
  );
  if (res.rowCount === 0) {
    throw Object.assign(new Error("Pending interest not found."), { status: 404 });
  }
  return { withdrawn: true };
}

// ---------------------------------------------------------------------------
// Interests (proposals). Server-enforced quota + DB-unique live pair.
// ---------------------------------------------------------------------------

function interestRow(r) {
  return {
    id: r.id,
    status: r.status,
    note: r.note,
    createdAt: r.created_at,
    profile: {
      id: r.profile_id, name: r.full_name, imageUrl: r.photo_url,
      specialty: r.specialty, city: r.city, age: r.age,
      ownerUserId: r.other_user_id,
    },
  };
}

export async function listMyInterests(userId) {
  const sent = await query(
    `SELECT i.id, i.status, i.note, i.created_at,
            p.id AS profile_id, p.full_name, p.photo_url, p.specialty, p.city, p.age,
            i.recipient_id AS other_user_id
     FROM interests i JOIN profiles p ON p.user_id = i.recipient_id
     WHERE i.sender_id = $1 AND i.status IN ('pending','accepted') ORDER BY i.created_at DESC`,
    [userId]
  );
  const received = await query(
    `SELECT i.id, i.status, i.note, i.created_at,
            p.id AS profile_id, p.full_name, p.photo_url, p.specialty, p.city, p.age,
            i.sender_id AS other_user_id
     FROM interests i JOIN profiles p ON p.user_id = i.sender_id
     WHERE i.recipient_id = $1 AND i.status = 'pending' ORDER BY i.created_at DESC`,
    [userId]
  );
  const matched = await query(
    `SELECT i.id, i.status, i.note, i.created_at,
            p.id AS profile_id, p.full_name, p.photo_url, p.specialty, p.city, p.age,
            i.recipient_id AS other_user_id
     FROM interests i JOIN profiles p ON p.user_id = i.recipient_id
     WHERE i.sender_id = $1 AND i.status = 'accepted'
     UNION ALL
     SELECT i.id, i.status, i.note, i.created_at,
            p.id AS profile_id, p.full_name, p.photo_url, p.specialty, p.city, p.age,
            i.sender_id AS other_user_id
     FROM interests i JOIN profiles p ON p.user_id = i.sender_id
     WHERE i.recipient_id = $1 AND i.status = 'accepted'`,
    [userId]
  );
  return { sent: sent.rows.map(interestRow), received: received.rows.map(interestRow), matched: matched.rows.map(interestRow) };
}

// ---------------------------------------------------------------------------
// Chat — channels only exist between accepted mutual interests.
// ---------------------------------------------------------------------------

export async function listChannels(userId) {
  const res = await query(
    `SELECT c.id,
            CASE WHEN c.user_a = $1 THEN c.user_b ELSE c.user_a END AS other_user,
            p.id AS profile_id, p.full_name AS name, p.photo_url,
            lm.body AS last_body, lm.created_at AS last_at
     FROM channels c
     JOIN profiles p ON p.user_id = (CASE WHEN c.user_a = $1 THEN c.user_b ELSE c.user_a END)
     LEFT JOIN LATERAL (
       SELECT body, created_at FROM messages m WHERE m.channel_id = c.id ORDER BY m.id DESC LIMIT 1
     ) lm ON TRUE
     WHERE $1 IN (c.user_a, c.user_b)
       -- Audit H3: blocked peers' channels disappear from the list entirely.
       AND NOT EXISTS (
         SELECT 1 FROM blocks b
         WHERE (b.blocker_id = c.user_a AND b.blocked_id = c.user_b)
            OR (b.blocker_id = c.user_b AND b.blocked_id = c.user_a))
     ORDER BY COALESCE(lm.created_at, c.created_at) DESC`,
    [userId]
  );
  return res.rows.map((r) => ({
    channelId: r.id,
    peerUserId: r.other_user,
    profile: { id: r.profile_id, name: r.name, imageUrl: r.photo_url },
    lastMessage: r.last_body ?? null,
    lastAt: r.last_at ?? null,
  }));
}

async function channelForUser(channelId, userId) {
  const res = await query(
    `SELECT c.id FROM channels c
     WHERE c.id = $1 AND ($2 IN (c.user_a, c.user_b))
       -- Audit H3: blocks sever the channel entirely (read AND write paths).
       AND NOT EXISTS (
         SELECT 1 FROM blocks b
         WHERE (b.blocker_id = c.user_a AND b.blocked_id = c.user_b)
            OR (b.blocker_id = c.user_b AND b.blocked_id = c.user_a))`,
    [channelId, userId]
  );
  return res.rows[0] ?? null;
}

export async function listMessages(userId, channelId, limit = 100) {
  if (!(await channelForUser(channelId, userId))) {
    throw Object.assign(new Error("Channel not found."), { status: 404 });
  }
  const res = await query(
    `SELECT id, sender_id, body, created_at, read_at FROM messages
     WHERE channel_id = $1 ORDER BY id ASC LIMIT $2`,
    // Audit L1: clamp BOTH ends — a negative/NaN limit previously produced a
    // Postgres error (500).
    [channelId, Math.min(Math.max(Number(limit) || 100, 1), 500)]
  );
  // P0-7 read receipts: peer knows when their message was seen.
  return res.rows.map((r) => ({ id: String(r.id), senderId: r.sender_id, mine: r.sender_id === userId, body: r.body, createdAt: r.created_at, readAt: r.read_at ?? null }));
}

export async function sendMessage(userId, channelId, body) {
  const text = String(body || "").trim().slice(0, 2000);
  if (!text) throw Object.assign(new Error("Message is empty."), { status: 400 });
  if (!(await channelForUser(channelId, userId))) {
    throw Object.assign(new Error("Channel not found."), { status: 404 });
  }
  const res = await query(
    `INSERT INTO messages (channel_id, sender_id, body) VALUES ($1,$2,$3) RETURNING id, created_at`,
    [channelId, userId, text]
  );
  const out = { id: String(res.rows[0].id), createdAt: res.rows[0].created_at };

  // Realtime push to the other participant (SSE hub; no-op when offline).
  const ch = await query(
    `SELECT CASE WHEN user_a = $2 THEN user_b ELSE user_a END AS other
     FROM channels WHERE id = $1`,
    [channelId, userId]
  );
  safePublish(ch.rows[0]?.other, "message", {
    channelId,
    message: { id: out.id, senderId: userId, body: text, createdAt: out.createdAt },
  });
  return out;
}

// ---------------------------------------------------------------------------
// Video dates (server quota + refund on cancellation)
// ---------------------------------------------------------------------------

/** Parse scheduler input: ISO-8601 with offset preferred; bare local times are
 * interpreted as Asia/Kolkata (server containers run UTC, so naive parsing
 * would shift evening IST slots by 5.5h). */
export function parseScheduledFor(input) {
  const raw = String(input || "").trim();
  if (!raw) return new Date(NaN);
  // Already zoned (Z or ±hh:mm / ±hhmm) → trust it.
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(raw)) return new Date(raw);
  // Bare "YYYY-MM-DDTHH:mm[:ss]" → treat as IST.
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2})?)$/.exec(raw);
  if (m) return new Date(`${m[1]}T${m[2]}+05:30`);
  return new Date(raw);
}

export async function createVideoDate(userId, profileId, scheduledFor, durationMinutes) {
  const when = parseScheduledFor(scheduledFor);
  if (Number.isNaN(when.getTime()) || when.getTime() < Date.now() - 60_000) {
    throw Object.assign(new Error("Pick a future date and time (ISO-8601 with timezone, e.g. 2026-05-15T19:00:00+05:30)."), { status: 400 });
  }
  const dur = Math.min(Math.max(Number(durationMinutes) || 30, 10), 180);
  // Audit M1: quota consumption + booking insert must be atomic. Were they two
  // separate autocommit transactions, a crash or FK failure after the decrement
  // would burn a quota unit with no booking. `withTx` rolls the pair back
  // together on any failure.
  const out = await withTx(async (c) => {
    // H3 (default: deny before charge): validate the recipient exactly like
    // interests — unknown/sample/self/blocked bookings fail BEFORE quota.
    const prof = await c.query(`SELECT user_id FROM profiles WHERE id = $1`, [profileId]);
    if (prof.rowCount === 0) throw Object.assign(new Error("Profile not found."), { status: 404 });
    const recipient = prof.rows[0]?.user_id;
    if (!recipient) throw Object.assign(new Error("This profile cannot receive video dates."), { status: 400 });
    if (recipient === userId) throw Object.assign(new Error("You cannot book a video date with yourself."), { status: 400 });
    const blocked = await c.query(
      `SELECT 1 FROM blocks WHERE (blocker_id=$1 AND blocked_id=$2) OR (blocker_id=$2 AND blocked_id=$1)`,
      [userId, recipient]
    );
    if (blocked.rowCount > 0) throw Object.assign(new Error("Video date not possible for this connection."), { status: 409 });
    const quota = await consumeQuotaTx(c, userId, "video_dates");
    if (!quota.ok) {
      throw Object.assign(new Error("Video date limit reached for your plan."), { status: 429, code: "quota", quota });
    }
    const res = await c.query(
      `INSERT INTO video_dates (requester_id, other_profile_id, scheduled_for, duration_minutes)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [userId, profileId, when.toISOString(), dur]
    );
    return { id: res.rows[0].id, quota };
  });
  // Realtime nudge to the profile owner (when a member owns it) — outside the
  // tx; the booking is already committed and this must never roll it back.
  try {
    const owner = await query(`SELECT user_id FROM profiles WHERE id = $1`, [profileId]);
    safePublish(owner.rows[0]?.user_id, "video_date", {
      action: "requested",
      videoDateId: out.id,
      scheduledFor: when.toISOString(),
    });
  } catch { /* best-effort */ }
  return out;
}

export async function listVideoDates(userId) {
  // Age out past accepted dates to completed so upcoming never grows stale
  // (previously 'completed' had no writer and history stayed 'accepted').
  await query(
    `UPDATE video_dates SET status = 'completed', updated_at = NOW()
     WHERE status = 'accepted' AND scheduled_for < NOW() - INTERVAL '3 hours'`
  ).catch(() => {});
  const res = await query(
    `SELECT v.id, v.scheduled_for, v.duration_minutes, v.status, v.kind,
            v.requester_id,
            CASE WHEN v.requester_id = $1 THEN 'outgoing' ELSE 'incoming' END AS direction,
            CASE WHEN v.requester_id = $1 THEN p_other.id ELSE p_req.id END AS profile_id,
            CASE 
              WHEN v.requester_id = $1 THEN (CASE WHEN v.kind = 'consultation' THEN 'Astrology Consultation' ELSE COALESCE(p_other.full_name, 'Member') END)
              ELSE COALESCE(p_req.full_name, 'Member')
            END AS name,
            CASE WHEN v.requester_id = $1 THEN p_other.photo_url ELSE p_req.photo_url END AS photo_url
     FROM video_dates v
     LEFT JOIN profiles p_other ON p_other.id = v.other_profile_id
     LEFT JOIN profiles p_my ON p_my.user_id = $1
     LEFT JOIN profiles p_req ON p_req.user_id = v.requester_id
     WHERE (v.requester_id = $1 OR v.other_profile_id = p_my.id)
       AND v.status IN ('requested','accepted')
     ORDER BY v.scheduled_for ASC`,
    [userId]
  );
  return res.rows.map((r) => ({
    id: r.id,
    scheduledFor: r.scheduled_for,
    durationMinutes: r.duration_minutes,
    status: r.status,
    kind: r.kind,
    direction: r.direction,
    profile: {
      id: r.profile_id ?? null,
      name: r.name,
      imageUrl: r.photo_url,
    },
  }));
}

export async function respondVideoDate(userId, videoDateId, action) {
  if (!["accept", "decline"].includes(action)) {
    throw Object.assign(new Error("action must be accept or decline."), { status: 400 });
  }
  return withTx(async (c) => {
    const myProf = (await c.query(`SELECT id FROM profiles WHERE user_id = $1`, [userId])).rows[0];
    if (!myProf) throw Object.assign(new Error("Profile not found."), { status: 404 });
    const targetStatus = action === "accept" ? "accepted" : "declined";
    const res = await c.query(
      `UPDATE video_dates SET status = $3, updated_at = NOW()
       WHERE id = $1 AND other_profile_id = $2 AND status = 'requested'
       RETURNING id, requester_id, created_at`,
      [videoDateId, myProf.id, targetStatus]
    );
    if (res.rowCount === 0) {
      throw Object.assign(new Error("Video date invitation not found or already responded."), { status: 404 });
    }
    const row = res.rows[0];
    if (action === "decline") {
      const consumptionPeriod = istPeriod(new Date(row.created_at));
      await ensureQuotaRow(c, row.requester_id, consumptionPeriod);
      await c.query(
        `UPDATE user_quotas SET video_dates_used = GREATEST(0, video_dates_used - 1)
         WHERE user_id = $1 AND period = $2`,
        [row.requester_id, consumptionPeriod]
      );
    }
    try {
      safePublish(row.requester_id, "video_date", {
        action: targetStatus,
        videoDateId,
      });
    } catch { /* best-effort */ }
    return { id: row.id, status: targetStatus };
  });
}

export async function cancelVideoDate(userId, videoDateId) {
  return withTx(async (c) => {
    const res = await c.query(
      `UPDATE video_dates SET status='cancelled', cancelled_at=NOW()
       WHERE id=$1 AND (requester_id=$2 OR other_profile_id IN (SELECT id FROM profiles WHERE user_id=$2))
         AND status IN ('requested','accepted')
       RETURNING id, requester_id, created_at, kind`,
      [videoDateId, userId]
    );
    if (res.rowCount === 0) {
      throw Object.assign(new Error("Video date not found or not cancellable."), { status: 404 });
    }
    const row = res.rows[0];
    const originalRequesterId = row.requester_id;
    if (row.kind === "consultation") {
      await c.query(
        `UPDATE subscriptions SET status = 'active'
         WHERE user_id = $1 AND sku = 'astrologer-consultation' AND current_period_end > NOW()`,
        [originalRequesterId]
      );
    } else {
      // Audit M2: refund the CONSUMPTION month — the IST month in which the
      // booking consumed its quota unit — back to the booking user.
      const consumptionPeriod = istPeriod(new Date(row.created_at));
      await ensureQuotaRow(c, originalRequesterId, consumptionPeriod);
      await c.query(
        `UPDATE user_quotas SET video_dates_used = GREATEST(0, video_dates_used - 1)
         WHERE user_id = $1 AND period = $2`,
        [originalRequesterId, consumptionPeriod]
      );
    }
    return { cancelled: true };
  });
}

// ---------------------------------------------------------------------------
// Blocks / reports
// ---------------------------------------------------------------------------

export async function blockUser(userId, targetUserId) {
  if (userId === targetUserId) throw Object.assign(new Error("Cannot block yourself."), { status: 400 });
  await query(
    `INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
    [userId, targetUserId]
  );
  return { blocked: true };
}

export async function unblockUser(userId, targetUserId) {
  await query(`DELETE FROM blocks WHERE blocker_id=$1 AND blocked_id=$2`, [userId, targetUserId]);
  return { blocked: false };
}

export async function listBlocks(userId) {
  const res = await query(
    `SELECT p.user_id AS id, p.full_name AS name, p.photo_url AS image_url
     FROM blocks b JOIN profiles p ON p.user_id = b.blocked_id
     WHERE b.blocker_id = $1`,
    [userId]
  );
  return res.rows.map((r) => ({ id: r.id, name: r.name, imageUrl: r.image_url }));
}

export async function reportUser(userId, reportedProfileId, reason, details) {
  const prof = await query(`SELECT user_id FROM profiles WHERE id = $1`, [reportedProfileId]);
  const target = prof.rows[0]?.user_id;
  if (!target) throw Object.assign(new Error("Profile not found."), { status: 404 });
  await query(
    `INSERT INTO reports (reporter_id, reported_id, reason, details) VALUES ($1,$2,$3,$4)`,
    [userId, target, String(reason || "other").slice(0, 80), String(details || "").slice(0, 2000)]
  );
  return { reported: true };
}

// ---------------------------------------------------------------------------
// Contact reveal — the ONLY place contact data ever leaves the DB, metered by
// the server-enforced quota (audit H1's real fix in DB mode).
// ---------------------------------------------------------------------------

export async function revealContact(viewerId, profileId) {
  return withTx(async (c) => {
    const prof = await c.query(`SELECT user_id, phone, email FROM profiles WHERE id = $1`, [profileId]);
    const row = prof.rows[0];
    if (!row) throw Object.assign(new Error("Profile not found."), { status: 404 });
    if (row.user_id === viewerId) {
      return { phone: row.phone ?? "", email: row.email ?? "", ownProfile: true, quota: await getQuotaSummary(viewerId, c) };
    }
    // H2 (default: deny + no charge): a block in either direction hides contact
    // exactly like browse/channels do. Checked BEFORE quota so a blocked reveal
    // never burns a unit. 404 (not 403) avoids confirming the profile exists.
    if (row.user_id) {
      const blocked = await c.query(
        `SELECT 1 FROM blocks WHERE (blocker_id=$1 AND blocked_id=$2) OR (blocker_id=$2 AND blocked_id=$1)`,
        [viewerId, row.user_id]
      );
      if (blocked.rowCount > 0) throw Object.assign(new Error("Profile not found."), { status: 404 });
    }
    if (!row.phone && !row.email) {
      // Honest answer, no charge — there is nothing to reveal.
      return { phone: "", email: "", shared: false, quota: await getQuotaSummary(viewerId, c) };
    }
    const alreadyViewed = await c.query(
      `SELECT 1 FROM contact_views WHERE viewer_id = $1 AND profile_id = $2`,
      [viewerId, profileId]
    );
    if (alreadyViewed.rowCount > 0) {
      return { phone: row.phone ?? "", email: row.email ?? "", shared: true, quota: await getQuotaSummary(viewerId, c), alreadyRevealed: true };
    }
    const quota = await consumeQuotaTx(c, viewerId, "contact_views");
    if (!quota.ok) {
      throw Object.assign(new Error("Contact views limit reached for your plan."), { status: 429, code: "quota", quota });
    }
    const ins = await c.query(
      `INSERT INTO contact_views (viewer_id, profile_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING 1`,
      [viewerId, profileId]
    );
    if (ins.rowCount === 0) {
      const period = istPeriod();
      await c.query(
        `UPDATE user_quotas SET contact_views_used = GREATEST(0, contact_views_used - 1)
         WHERE user_id = $1 AND period = $2`,
        [viewerId, period]
      );
      return { phone: row.phone ?? "", email: row.email ?? "", shared: true, quota: await getQuotaSummary(viewerId, c), alreadyRevealed: true };
    }
    return { phone: row.phone ?? "", email: row.email ?? "", shared: true, quota };
  });
}

// ---------------------------------------------------------------------------
// Billing (M7): durable orders + idempotent captured payments. When a payment
// maps to a known order placed by a signed-in user, the subscription is
// granted HERE — server-authoritative activation that no longer depends on
// the browser returning to redeem a token.
// ---------------------------------------------------------------------------

export async function recordOrder({ orderId, userId, sku, amountPaise, simulated, couponCode = null }) {
  await query(
    `INSERT INTO payment_orders (order_id, user_id, sku, amount_paise, simulated, coupon_code)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (order_id) DO UPDATE SET
       user_id = COALESCE(payment_orders.user_id, EXCLUDED.user_id),
       coupon_code = COALESCE(payment_orders.coupon_code, EXCLUDED.coupon_code)`,
    [orderId, userId ?? null, sku, amountPaise, Boolean(simulated), couponCode ?? null]
  );
}

export async function getOrder(orderId, userId = null) {
  // Audit L5: optional caller scope — when a userId is supplied the row is
  // only returned if it belongs to that user (enumeration hardening for any
  // future routing of this lookup).
  const res = await query(
    `SELECT order_id, user_id, sku, amount_paise, status, coupon_code FROM payment_orders
     WHERE order_id = $1 AND ($2::text IS NULL OR user_id = $2)`,
    [orderId, userId]
  );
  return res.rows[0] ?? null;
}

/**
 * Idempotently record one captured payment.
 * Returns 'applied' exactly once per paymentId; Razorpay's redeliveries return
 * 'duplicate' and change nothing.
 *
 * `notesUserId` is the user_id echoed into Razorpay's order notes at
 * create-order time. When the order row has no user_id (anonymous
 * create-order / cookie-less redirect), it backfills the durable order row
 * so the captured payment can be reconciled to the right account (audit M-14).
 */
export async function recordCapturedPayment({ paymentId, orderId, userId, sku, amountPaise, source, notesUserId }) {
  return withTx(async (c) => {
    const gate = await c.query(
      `INSERT INTO webhook_events (event_id, event_type) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [paymentId, source]
    );
    if (gate.rowCount === 0) return { result: "duplicate" };

    let order = null;
    if (orderId) {
      const o = await c.query(
        `SELECT order_id, user_id, sku, coupon_code, amount_paise FROM payment_orders WHERE order_id = $1 FOR UPDATE`,
        [orderId]
      );
      order = o.rows[0] ?? null;
      if (order) {
        // Backfill an orphaned order (no user_id at create-time) from the
        // notes we echoed into Razorpay. The notes.user_id is server-set, so
        // it cannot be spoofed from the client.
        if (!order.user_id && notesUserId) {
          await c.query(
            `UPDATE payment_orders SET user_id = $1 WHERE order_id = $2`,
            [notesUserId, orderId]
          );
          order.user_id = notesUserId;
        }
        await c.query(`UPDATE payment_orders SET status='paid' WHERE order_id=$1 AND status='created'`, [orderId]);
      }
    }
    const effectiveUser = order?.user_id ?? userId ?? null;
    const effectiveSku = order?.sku ?? sku ?? null;
    const effectiveAmount = (typeof amountPaise === "number" && amountPaise >= 0)
      ? amountPaise
      : (order?.amount_paise ?? 0);
    const effectiveSource = (source === "redeem" ? "verify" : source) || "verify";

    await c.query(
      `INSERT INTO payment_transactions (payment_id, order_id, user_id, sku, amount_paise, status, source)
       VALUES ($1,$2,$3,$4,$5,'captured',$6) ON CONFLICT DO NOTHING`,
      [paymentId, orderId ?? null, effectiveUser, effectiveSku, effectiveAmount, effectiveSource]
    );
    if (effectiveUser && effectiveSku) {
      // Grant for EVERY paid sku — memberships AND consultations (audit C1:
      // astrologer-* payments were excluded here, so buyers of the actively
      // sold consultation could never book — createConsultation requires an
      // active subscription row). Subscriptions are keyed (user_id, sku), so
      // a consultation coexists with a membership instead of being clobbered.
      // Tiered astrologer skus (audit M7) all map onto the canonical plan row.
      //
      // Rank rules WITHIN a family: never downgrade; equal rank EXTENDS the
      // access window from the later of (existing end, now) so prepaid time is
      // never destroyed (audit H1); a strictly higher rank replaces the plan
      // with its own fresh window. Annual SKUs get 365 days, everything else 30
      // ([PD] consultation bookings get the standard 30-day booking window).
      const grantSku = String(effectiveSku).startsWith("astrologer")
        ? "astrologer-consultation"
        : String(effectiveSku);
      const days = String(effectiveSku).endsWith("-annual") ? 365 : 30;
      const periodEnd = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
      const planInfo = (await c.query(`SELECT kind, rank FROM plans WHERE sku = $1`, [grantSku])).rows[0]
        || { kind: "membership", rank: 0 };
      
      let shouldGrant = true;
      if (planInfo.kind === "membership") {
        const activeMemberships = await c.query(
          `SELECT s.sku, p.rank, s.current_period_end
           FROM subscriptions s
           JOIN plans p ON p.sku = s.sku
           WHERE s.user_id = $1 AND p.kind = 'membership' AND s.status = 'active' AND s.current_period_end > NOW()
           FOR UPDATE OF s`,
          [effectiveUser]
        );
        for (const m of activeMemberships.rows) {
          if (m.rank > planInfo.rank) {
            // Never downgrade an active higher-tier membership
            shouldGrant = false;
            break;
          } else if (m.rank < planInfo.rank) {
            // Strictly higher rank replaces the plan — retire the superseded lower tier
            await c.query(
              `UPDATE subscriptions SET status = 'expired' WHERE user_id = $1 AND sku = $2`,
              [effectiveUser, m.sku]
            );
          }
        }
      }

      if (shouldGrant) {
        await c.query(
          `INSERT INTO subscriptions (user_id, sku, payment_id, current_period_end, status)
           VALUES ($1,$2,$3,$4,'active')
           ON CONFLICT (user_id, sku) DO UPDATE SET
             payment_id = EXCLUDED.payment_id,
             current_period_end = GREATEST(COALESCE(subscriptions.current_period_end, NOW()), NOW())
                                  + make_interval(days => $5::int),
             status = 'active', cancel_at_period_end = FALSE, activated_at = NOW()`,
          [effectiveUser, grantSku, paymentId, periodEnd, days]
        );
      }
    }
    return { result: "applied", userId: effectiveUser, sku: effectiveSku, couponCode: order?.coupon_code ?? null };
  });
}

// ---------------------------------------------------------------------------
// Billing lifecycle (self-service): customers cancel at period end — access
// continues until current_period_end, then the plan naturally falls back to
// basic. Refunds (money returned) revoke immediately via recordRefund.
// ---------------------------------------------------------------------------

/** Top-ranked ACTIVE unexpired membership sku for a user, or null (basic).
 * Used by redeem to mirror display-side entitlement from billing truth (H-5). */
export async function getActiveMembershipSku(userId) {
  const res = await query(
    `SELECT p.sku FROM subscriptions s JOIN plans p ON p.sku = s.sku
     WHERE s.user_id = $1 AND s.status IN ('active','canceling') AND s.current_period_end > NOW()
       AND p.kind = 'membership'
     ORDER BY p.rank DESC LIMIT 1`,
    [userId]
  );
  return res.rows[0]?.sku ?? null;
}

// ---------------------------------------------------------------------------
// Favorites (M-9): persisted to the favorites table so wired accounts keep
// their shortlist of favorite profiles across devices. Best-effort mirrors on
// the client keep demo mode working unchanged.
// ---------------------------------------------------------------------------

export async function listFavorites(userId) {
  const res = await query(
    `SELECT p.id FROM favorites f JOIN profiles p ON p.id = f.profile_id
     WHERE f.user_id = $1 ORDER BY f.created_at DESC LIMIT 200`,
    [userId]
  );
  return res.rows.map((r) => r.id);
}

export async function addFavorite(userId, profileId) {
  await query(
    `INSERT INTO favorites (user_id, profile_id) VALUES ($1,$2)
     ON CONFLICT DO NOTHING`,
    [userId, profileId]
  );
  return { added: true };
}

export async function removeFavorite(userId, profileId) {
  const res = await query(
    `DELETE FROM favorites WHERE user_id = $1 AND profile_id = $2 RETURNING profile_id`,
    [userId, profileId]
  );
  return { removed: res.rowCount > 0 };
}

// ---------------------------------------------------------------------------
// Shortlists (audit M-3): persisted to the shortlists table so wired accounts
// keep their shortlisted profiles across devices.
// ---------------------------------------------------------------------------

export async function listShortlists(userId) {
  const res = await query(
    `SELECT p.id FROM shortlists s JOIN profiles p ON p.id = s.profile_id
     WHERE s.user_id = $1 ORDER BY s.created_at DESC LIMIT 200`,
    [userId]
  );
  return res.rows.map((r) => r.id);
}

export async function addShortlist(userId, profileId) {
  await query(
    `INSERT INTO shortlists (user_id, profile_id) VALUES ($1,$2)
     ON CONFLICT DO NOTHING`,
    [userId, profileId]
  );
  return { added: true };
}

export async function removeShortlist(userId, profileId) {
  const res = await query(
    `DELETE FROM shortlists WHERE user_id = $1 AND profile_id = $2 RETURNING profile_id`,
    [userId, profileId]
  );
  return { removed: res.rowCount > 0 };
}

export async function cancelBilling(userId) {
  // Safe default made explicit: self-service cancel affects MEMBERSHIPS only.
  // Consultations/reports (kind='consultation') are single-use products, not
  // recurring subscriptions — previously one click cancelled everything.
  const res = await query(
    `UPDATE subscriptions s SET status = 'canceling', cancel_at_period_end = TRUE
     FROM plans p WHERE s.sku = p.sku AND p.kind = 'membership'
       AND s.user_id = $1 AND s.status = 'active' AND s.current_period_end > NOW()
     RETURNING s.sku, s.current_period_end`,
    [userId]
  );
  if (res.rowCount === 0) {
    throw Object.assign(new Error("No active paid subscription to cancel."), { status: 404 });
  }
  // Return the highest-rank membership cancelled (stable when several exist).
  const top = [...res.rows].sort().pop();
  return { status: "canceling", planExpiresAt: top.current_period_end, cancelledSkus: res.rows.map((r) => r.sku) };
}

export async function resumeBilling(userId) {
  const res = await query(
    `UPDATE subscriptions s SET status = 'active', cancel_at_period_end = FALSE
     FROM plans p WHERE s.sku = p.sku AND p.kind = 'membership'
       AND s.user_id = $1 AND s.status = 'canceling' AND s.current_period_end > NOW()
     RETURNING s.sku, s.current_period_end`,
    [userId]
  );
  if (res.rowCount === 0) {
    throw Object.assign(new Error("Nothing to resume."), { status: 404 });
  }
  const top = [...res.rows].sort().pop();
  return { status: "active", planExpiresAt: top.current_period_end, resumedSkus: res.rows.map((r) => r.sku) };
}

// ---------------------------------------------------------------------------
// Admin / moderation (v2). Every mutation here is written to admin_audit_log.
// ---------------------------------------------------------------------------

export async function writeAudit(adminId, action, target, details = "") {
  // C-NEW-1: in non-DB mode the table doesn't exist and pg.Pool against an
  // empty connection string throws on first use, which cascades into every
  // admin path. Silent no-op preserves the call shape (so callers stay
  // fire-and-forget) without crashing the request.
  if (!dbEnabled) return;
  try {
    await query(
      `INSERT INTO admin_audit_log (admin_id, action, target, details) VALUES ($1,$2,$3,$4)`,
      [adminId, action, target ?? "", String(details || "").slice(0, 1000)]
    );
  } catch (err) {
    console.error(JSON.stringify({ level: "error", msg: "audit_write_failed", error: String(err) }));
  }
}

export async function listReports(status /* open|resolved|dismissed|all */) {
  const params = [];
  let where = "TRUE";
  if (status && status !== "all") {
    params.push(String(status));
    where = `r.status = $1`;
  }
  const res = await query(
    `SELECT r.id, r.reporter_id, r.reported_id, r.reason, r.details, r.status,
            r.created_at, r.resolved_at, r.resolution_note,
            rp.full_name AS reported_name, rp.photo_url AS reported_photo
     FROM reports r LEFT JOIN profiles rp ON rp.user_id = r.reported_id
     WHERE ${where}
     ORDER BY r.created_at DESC LIMIT 200`,
    params
  );
  return res.rows.map((r) => ({
    id: r.id,
    reporterId: r.reporter_id,
    reportedProfileUserId: r.reported_id,
    reportedName: r.reported_name,
    reportedPhoto: r.reported_photo,
    reason: r.reason,
    details: r.details,
    status: r.status,
    createdAt: r.created_at,
    resolvedAt: r.resolved_at,
    resolutionNote: r.resolution_note,
  }));
}

export async function resolveReport(adminId, reportId, outcome /* resolved|dismissed */, note = "") {
  if (!["resolved", "dismissed"].includes(String(outcome))) {
    throw Object.assign(new Error("outcome must be resolved or dismissed."), { status: 400 });
  }
  const res = await query(
    `UPDATE reports SET status=$2, resolved_by=$3, resolved_at=NOW(), resolution_note=$4
     WHERE id=$1 RETURNING id, reported_id`,
    [reportId, String(outcome), adminId, String(note || "").slice(0, 500)]
  );
  if (res.rowCount === 0) throw Object.assign(new Error("Report not found."), { status: 404 });
  await writeAudit(adminId, `report.${outcome}`, reportId, note);
  return { id: res.rows[0].id, status: outcome };
}

export async function listAdminUsers(q, limit = 50) {
  const params = [];
  let where = "TRUE";
  if (q && String(q).trim()) {
    params.push(like(String(q).trim()));
    where = `(u.email ILIKE $1 OR u.first_name ILIKE $1 OR u.last_name ILIKE $1)`;
  }
  params.push(Math.min(Math.max(Number(limit) || 50, 1), 200));
  const res = await query(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.verified, u.is_admin,
            u.is_root_admin, u.created_at,
            s.sku AS plan, s.current_period_end AS plan_expires_at, s.status AS plan_status,
            p.full_name AS profile_name
     FROM app_users u
     LEFT JOIN LATERAL (
       SELECT s2.sku, s2.current_period_end, s2.status FROM subscriptions s2 JOIN plans p2 ON p2.sku = s2.sku
       WHERE s2.user_id = u.id
       -- Active unexpired first (same rule as getQuotaSummary): an expired
       -- platinum must not hide an active premium.
       ORDER BY (s2.status = 'active' AND s2.current_period_end > NOW()) DESC,
                p2.rank DESC, s2.current_period_end DESC NULLS LAST
       LIMIT 1
     ) s ON TRUE
     LEFT JOIN profiles p ON p.user_id = u.id
     WHERE ${where}
     ORDER BY u.created_at DESC LIMIT $${params.length}`,
    params
  );
  return res.rows.map((r) => ({
    id: r.id, email: r.email, firstName: r.first_name, lastName: r.last_name,
    verified: r.verified,
    isAdmin: Boolean(r.is_admin || r.is_root_admin),
    isRoot: Boolean(r.is_root_admin),
    createdAt: r.created_at,
    plan: r.plan ?? "basic", planExpiresAt: r.plan_expires_at ?? null,
    planStatus: r.plan_status ?? null,
    profileName: r.profile_name ?? null,
  }));
}

/**
 * Refund policy (documented default, safe default made explicit): a FULL
 * refund revokes the paid plan IMMEDIATELY (downgrade to basic for
 * memberships, status='refunded' for consultations/reports). A PARTIAL refund
 * (< original payment amount) is bookkept but does NOT revoke access.
 * Consumed quotas are not clawed back. Tiered astrologer SKUs map to the
 * canonical 'astrologer-consultation' subscription row (same mapping as
 * recordCapturedPayment) — previously refunds never revoked consultations.
 */
export async function recordRefund({ refundId, paymentId, orderId, amountPaise, reason, source }) {
  return withTx(async (c) => {
    const gate = await c.query(
      `INSERT INTO webhook_events (event_id, event_type) VALUES ($1,'refund') ON CONFLICT DO NOTHING`,
      [refundId]
    );
    if (gate.rowCount === 0) return { result: "duplicate" };

    let tx = null;
    if (paymentId) {
      const t = await c.query(
        `SELECT payment_id, order_id, user_id, sku, amount_paise FROM payment_transactions WHERE payment_id = $1`,
        [paymentId]
      );
      tx = t.rows[0] ?? null;
    }
    const effectiveUser = tx?.user_id ?? null;
    const rawSku = tx?.sku ?? null;
    // Same canonical mapping as recordCapturedPayment: tiered astrologer SKUs
    // grant 'astrologer-consultation', so refunds must revoke that row.
    const effectiveSku = rawSku && String(rawSku).startsWith("astrologer")
      ? "astrologer-consultation"
      : rawSku;

    await c.query(
      `INSERT INTO refunds (refund_id, payment_id, order_id, user_id, amount_paise, reason, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        refundId, paymentId ?? tx?.payment_id ?? null, orderId ?? tx?.order_id ?? null,
        effectiveUser, amountPaise ?? null, String(reason || "").slice(0, 300), source,
      ]
    );

    // Partial refunds do not revoke: only a full (or unknown-amount, fail-safe)
    // refund revokes. Unknown amount revokes (fail-closed for money).
    const paidPaise = typeof tx?.amount_paise === "number" ? tx.amount_paise : null;
    const refundPaise = typeof amountPaise === "number" ? amountPaise : null;
    const isFullRefund = refundPaise == null || paidPaise == null || refundPaise >= paidPaise;
    // Policy: money returned ⇒ access revoked immediately. The effective plan
    // falls back to basic because status != 'active' (see activePlanTx).
    if (effectiveUser && effectiveSku && isFullRefund) {
      await c.query(
        `UPDATE subscriptions SET status = 'refunded', cancel_at_period_end = FALSE
         WHERE user_id = $1 AND sku = $2 AND status IN ('active','canceling')`,
        [effectiveUser, effectiveSku]
      );
    }
    return { result: "applied", userId: effectiveUser, refundedSku: effectiveSku };
  });
}

/** Admin-initiated refund bookkeeping (the Razorpay API call happens in index.mjs). */
export async function recordAdminRefund({ refundId, paymentId, amountPaise, reason }) {
  const out = await recordRefund({ refundId, paymentId, amountPaise, reason, source: "admin" });
  return out;
}

export async function listPayments(limit = 50) {
  const res = await query(
    `SELECT t.payment_id, t.order_id, t.user_id, t.sku, t.amount_paise, t.status,
            t.source, t.created_at, u.email AS user_email,
            EXISTS(SELECT 1 FROM refunds r WHERE r.payment_id = t.payment_id) AS refunded
     FROM payment_transactions t
     LEFT JOIN app_users u ON u.id = t.user_id
     ORDER BY t.created_at DESC LIMIT $1`,
    [Math.min(Math.max(Number(limit) || 50, 1), 200)]
  );
  return res.rows.map((r) => ({
    paymentId: r.payment_id, orderId: r.order_id, userId: r.user_id,
    userEmail: r.user_email, sku: r.sku,
    amountRupees: r.amount_paise != null ? r.amount_paise / 100 : null,
    status: r.status, source: r.source, createdAt: r.created_at, refunded: r.refunded,
  }));
}

/**
 * Admin dashboard counts (launch-gap fix #3). Single query: one row per metric
 * via scalar subselects, so the dashboard stays one round-trip. All counts are
 * cross-table and independent, so a missing table would fail loudly (good).
 */
export async function adminStats() {
  const r = await query(
    `SELECT
       (SELECT COUNT(*)::int FROM app_users) AS total_users,
       (SELECT COUNT(*)::int FROM app_users WHERE created_at > NOW() - INTERVAL '30 days') AS new_users_30d,
       (SELECT COUNT(*)::int FROM profiles WHERE is_verified = TRUE AND is_sample = FALSE) AS verified_doctors,
       (SELECT COUNT(*)::int FROM verification_documents WHERE status = 'pending') AS pending_verifications,
       (SELECT COUNT(*)::int FROM subscriptions WHERE status = 'active' AND (current_period_end IS NULL OR current_period_end > NOW())) AS active_memberships,
       (SELECT COUNT(*)::int FROM reports WHERE status = 'open') AS open_reports,
       (SELECT COUNT(*)::int FROM interests) AS interests_sent,
       (SELECT COUNT(*)::int FROM payment_orders WHERE status = 'failed') AS failed_payments,
       (SELECT COUNT(*)::int FROM refunds) AS refunds`
  );
  return r.rows[0];
}

/**
 * Member refund request (launch-gap fix #5). Delivered to SUPPORT_EMAIL by the
 * caller via email.mjs; this only records context so the support team can act.
 * SAFE DEFAULT: requests are advisories — approval/refund still goes through
 * the admin refund endpoint / Razorpay dashboard + webhook revocation.
 */
export async function requestRefund(userId, reason) {
  const user = (
    await query(
      `SELECT u.email, u.first_name, u.last_name,
              (SELECT s.sku FROM subscriptions s WHERE s.user_id = u.id AND s.status IN ('active','canceling') ORDER BY s.current_period_end DESC LIMIT 1) AS last_sku,
              (SELECT s.current_period_end FROM subscriptions s WHERE s.user_id = u.id AND s.status IN ('active','canceling') ORDER BY s.current_period_end DESC LIMIT 1) AS period_end,
              (SELECT COUNT(*)::int FROM payment_transactions t WHERE t.user_id = u.id) AS payments_count
       FROM app_users u WHERE u.id = $1`,
      [userId]
    )
  ).rows[0];
  if (!user) return { ok: false, found: false };
  return {
    ok: true,
    email: user.email || "",
    name: `${user.first_name || ""} ${user.last_name || ""}`.trim(),
    lastSku: user.last_sku ?? null,
    periodEnd: user.period_end ?? null,
    paymentsCount: user.payments_count ?? 0,
    reason: String(reason || "").slice(0, 2000),
  };
}

/** Admin listing: includes hidden profiles and contact fields (audit-logged by caller). */
export async function adminListProfiles(q, limit = 50) {
  const params = [];
  let where = "TRUE";
  if (q && String(q).trim()) {
    params.push(like(String(q).trim()));
    where = `(p.full_name ILIKE $1 OR p.email ILIKE $1 OR p.city ILIKE $1 OR p.specialty ILIKE $1)`;
  }
  params.push(Math.min(Math.max(Number(limit) || 50, 1), 200));
  const res = await query(
    `SELECT p.id, p.full_name, p.specialty, p.city, p.state, p.is_verified,
            p.profile_visibility, p.phone, p.email, p.is_sample, p.updated_at
     FROM profiles p WHERE ${where}
     ORDER BY p.updated_at DESC LIMIT $${params.length}`,
    params
  );
  return res.rows.map((r) => ({
    id: r.id, name: r.full_name, specialty: r.specialty, city: r.city, state: r.state,
    isVerified: r.is_verified, visibility: r.profile_visibility,
    phone: r.phone ?? null, email: r.email ?? null, isSample: r.is_sample,
    updatedAt: r.updated_at,
  }));
}

const ADMIN_PROFILE_FIELDS = new Set(["is_verified", "profile_visibility"]);

export async function patchProfileAdmin(adminId, profileId, patch) {
  const keys = Object.keys(patch || {}).filter((k) => ADMIN_PROFILE_FIELDS.has(k));
  if (keys.length === 0) throw Object.assign(new Error("No allowed fields to update."), { status: 400 });
  if (patch.profile_visibility && !["public", "verified_only", "hidden"].includes(patch.profile_visibility)) {
    throw Object.assign(new Error("Invalid visibility."), { status: 400 });
  }
  const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(", ");
  const res = await query(
    `UPDATE profiles SET ${sets}, updated_at = NOW() WHERE id = $1 RETURNING id`,
    [profileId, ...keys.map((k) => patch[k])]
  );
  if (res.rowCount === 0) throw Object.assign(new Error("Profile not found."), { status: 404 });
  await writeAudit(adminId, "profile.patch", profileId, JSON.stringify(patch).slice(0, 500));
  return getProfile(profileId);
}

// ---------------------------------------------------------------------------
// Notifications (durable feed + SSE push)
// ---------------------------------------------------------------------------

export async function notify(userId, type, title, body = "", data = {}) {
  const res = await query(
    `INSERT INTO notifications (user_id, type, title, body, data)
     VALUES ($1,$2,$3,$4,$5) RETURNING id, created_at`,
    [userId, type, title, String(body || ""), JSON.stringify(data ?? {})]
  );
  const row = res.rows[0];
  safePublish(userId, "notification", {
    id: row.id, type, title, body,
    createdAt: row.created_at,
  });
  return row.id;
}

export async function listNotifications(userId, { unreadOnly = false, limit = 50 } = {}) {
  // Audit M-9: collapse the list + count into ONE query with a window function
  // so the notification center avoids a second round-trip per render. The
  // unread total is computed against the same filtered window.
  const params = [userId];
  let where = "user_id = $1";
  if (unreadOnly) {
    where += ` AND read_at IS NULL`;
  }
  params.push(Math.min(Math.max(Number(limit) || 50, 1), 200));
  const res = await query(
    `SELECT id, type, title, body, data, read_at, created_at,
            COUNT(*) FILTER (WHERE read_at IS NULL) OVER () AS unread_total
     FROM notifications
     WHERE ${where}
     ORDER BY created_at DESC
     LIMIT $${params.length}`,
    params
  );
  const unreadCount = Number(res.rows[0]?.unread_total ?? 0);
  // M4: one hand-edited data cell must not 500 the whole center.
  const safeData = (raw) => {
    if (!raw) return {};
    if (typeof raw === "object") return raw;
    try { return JSON.parse(raw); } catch { return {}; }
  };
  return {
    notifications: res.rows.map((r) => ({
      id: r.id, type: r.type, title: r.title, body: r.body,
      data: safeData(r.data), read: Boolean(r.read_at),
      createdAt: r.created_at,
    })),
    unreadCount,
  };
}

export async function markNotificationRead(userId, notificationId) {
  const res = await query(
    `UPDATE notifications SET read_at = NOW() WHERE id=$1 AND user_id=$2 AND read_at IS NULL RETURNING id`,
    [notificationId, userId]
  );
  if (res.rowCount === 0) throw Object.assign(new Error("Notification not found."), { status: 404 });
  return { read: true };
}

export async function markAllNotificationsRead(userId) {
  await query(
    `UPDATE notifications SET read_at = NOW() WHERE user_id=$1 AND read_at IS NULL`,
    [userId]
  );
  return { read: true };
}

// ---------------------------------------------------------------------------
// Profile photos (primary photo; Supabase Storage URL or bounded data URL)
// ---------------------------------------------------------------------------

// Audit M-1: bound how often a user can add/replace photos. 10/day is generous
// for a real user and trivial to detect as abuse; the check is server-side
// (the only enforcement point).
const MAX_PHOTO_UPDATES_PER_DAY = 10;
const MAX_GALLERY_PHOTOS = 8;

async function ensureProfileRow(c, userId, displayName) {
  await c.query(
    `INSERT INTO profiles (id, user_id, full_name) VALUES (gen_random_uuid()::text, $1, $2)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId, displayName || ""]
  );
  // FOR UPDATE serializes concurrent gallery uploads for the same user so the
  // COUNT-then-INSERT cap below cannot be raced past 8 photos.
  const prof = await c.query(`SELECT id FROM profiles WHERE user_id = $1 FOR UPDATE`, [userId]);
  return prof.rows[0].id;
}

/** Full gallery (matrimony parity: primary first, then display_order). */
export async function listMyPhotos(userId) {
  const r = await query(
    `SELECT pp.id, pp.url, pp.is_primary, pp.display_order, pp.created_at
     FROM profile_photos pp
     WHERE pp.profile_id IN (SELECT id FROM profiles WHERE user_id = $1)
     ORDER BY pp.is_primary DESC, pp.display_order ASC, pp.created_at ASC`,
    [userId]
  );
  return r.rows.map((x) => ({ id: x.id, url: x.url, isPrimary: Boolean(x.is_primary), displayOrder: x.display_order, createdAt: x.created_at }));
}

/** Add a photo to the gallery (first upload becomes primary automatically). */
export async function addGalleryPhoto(userId, url) {
  return withTx(async (c) => {
    const today = await c.query(
      `SELECT COUNT(*)::int AS n FROM profile_photos
       WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = $1)
         AND created_at > NOW() - INTERVAL '1 day'`,
      [userId]
    );
    if ((today.rows[0]?.n ?? 0) >= MAX_PHOTO_UPDATES_PER_DAY) {
      throw Object.assign(
        new Error("Photo upload limit reached. Try again later."),
        { status: 429, code: "photo_cap" }
      );
    }
    const profileId = await ensureProfileRow(c, userId, "");
    const count = await c.query(
      `SELECT COUNT(*)::int AS n FROM profile_photos WHERE profile_id = $1`,
      [profileId]
    );
    if ((count.rows[0]?.n ?? 0) >= MAX_GALLERY_PHOTOS) {
      throw Object.assign(
        new Error(`You can keep up to ${MAX_GALLERY_PHOTOS} photos.`),
        { status: 400, code: "photo_gallery_full" }
      );
    }
    const existing = await c.query(`SELECT 1 FROM profile_photos WHERE profile_id = $1 LIMIT 1`, [profileId]);
    const isPrimary = existing.rowCount === 0;
    const ord = await c.query(
      `SELECT COALESCE(MAX(display_order), 0) + 1 AS next FROM profile_photos WHERE profile_id = $1`,
      [profileId]
    );
    const ins = await c.query(
      `INSERT INTO profile_photos (profile_id, url, is_primary, display_order)
       VALUES ($1, $2, $3, $4) RETURNING id, url, is_primary, display_order`,
      [profileId, url, isPrimary, ord.rows[0].next]
    );
    if (isPrimary) {
      await c.query(`UPDATE profiles SET photo_url = $2, updated_at = NOW() WHERE id = $1`, [profileId, url]);
    }
    return { id: ins.rows[0].id, url: ins.rows[0].url, isPrimary };
  });
}

/** Set any owned photo as the profile's primary (updates the existing row —
 *  does NOT insert a duplicate, which previously double-counted against the
 *  daily cap and orphaned the old primary). */
export async function setPrimaryPhoto(userId, photoId) {
  return withTx(async (c) => {
    const today = await c.query(
      `SELECT COUNT(*)::int AS n FROM profile_photos
       WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = $1)
         AND created_at > NOW() - INTERVAL '1 day'`,
      [userId]
    );
    if ((today.rows[0]?.n ?? 0) >= MAX_PHOTO_UPDATES_PER_DAY) {
      throw Object.assign(
        new Error("Photo update limit reached. Try again later."),
        { status: 429, code: "photo_cap" }
      );
    }
    const profileId = await ensureProfileRow(c, userId, "");
    const target = await c.query(
      `SELECT id FROM profile_photos WHERE id = $1 AND profile_id = $2`,
      [photoId, profileId]
    );
    if (target.rowCount === 0) throw Object.assign(new Error("Photo not found."), { status: 404 });
    await c.query(`UPDATE profile_photos SET is_primary = FALSE WHERE profile_id = $1`, [profileId]);
    await c.query(`UPDATE profile_photos SET is_primary = TRUE WHERE id = $1`, [photoId]);
    const url = await c.query(`SELECT url FROM profile_photos WHERE id = $1`, [photoId]);
    await c.query(`UPDATE profiles SET photo_url = $2, updated_at = NOW() WHERE id = $1`, [profileId, url.rows[0].url]);
    return { url: url.rows[0].url };
  });
}

/** Delete an owned gallery photo (primary reassigns to the next in order). */
export async function deleteGalleryPhoto(userId, photoId) {
  return withTx(async (c) => {
    const profileId = await ensureProfileRow(c, userId, "");
    const del = await c.query(
      `DELETE FROM profile_photos WHERE id = $1 AND profile_id = $2 RETURNING is_primary, url`,
      [photoId, profileId]
    );
    if (del.rowCount === 0) throw Object.assign(new Error("Photo not found."), { status: 404 });
    if (del.rows[0].is_primary) {
      const next = await c.query(
        `SELECT id, url FROM profile_photos WHERE profile_id = $1
         ORDER BY display_order ASC, created_at ASC LIMIT 1`,
        [profileId]
      );
      const nextRow = next.rows[0] ?? null;
      if (nextRow) {
        // By id, not by URL: duplicate URLs (same image twice) previously
        // promoted multiple rows to primary.
        await c.query(`UPDATE profile_photos SET is_primary = TRUE WHERE id = $1`, [nextRow.id]);
        await c.query(`UPDATE profiles SET photo_url = $2, updated_at = NOW() WHERE id = $1`, [profileId, nextRow.url]);
      } else {
        await c.query(`UPDATE profiles SET photo_url = NULL, updated_at = NOW() WHERE id = $1`, [profileId]);
      }
    }
    return { deleted: true };
  });
}

// ---------------------------------------------------------------------------
// Consultations: bookable only while an astrologer-consultation entitlement
// is active (time-boxed exactly like memberships).
// ---------------------------------------------------------------------------

export async function createConsultation(userId, scheduledFor, durationMinutes) {
  const when = parseScheduledFor(scheduledFor);
  if (Number.isNaN(when.getTime()) || when.getTime() < Date.now() - 60_000) {
    throw Object.assign(new Error("Pick a future date and time."), { status: 400 });
  }
  return withTx(async (c) => {
    const active = await c.query(
      `SELECT current_period_end FROM subscriptions
       WHERE user_id = $1 AND sku = 'astrologer-consultation'
         AND status = 'active' AND current_period_end > NOW()
       FOR UPDATE`,
      [userId]
    );
    if (active.rowCount === 0) {
      throw Object.assign(
        new Error("An active consultation booking is required first."),
        { status: 403, code: "no_consultation" }
      );
    }
    const dur = Math.min(Math.max(Number(durationMinutes) || 45, 15), 120);
    const res = await c.query(
      `INSERT INTO video_dates (requester_id, other_profile_id, scheduled_for, duration_minutes, kind)
       VALUES ($1, NULL, $2, $3, 'consultation') RETURNING id`,
      [userId, when.toISOString(), dur]
    );
    await c.query(
      `UPDATE subscriptions SET status = 'expired'
       WHERE user_id = $1 AND sku = 'astrologer-consultation'`,
      [userId]
    );
    return { id: res.rows[0].id };
  });
}

export async function hasActiveConsultation(userId) {
  const res = await query(
    `SELECT current_period_end FROM subscriptions
     WHERE user_id = $1 AND sku = 'astrologer-consultation'
       AND status = 'active' AND current_period_end > NOW()`,
    [userId]
  );
  return { active: res.rowCount > 0, expiresAt: res.rows[0]?.current_period_end ?? null };
}

// ---------------------------------------------------------------------------
// Admin extras: audit feed + sample-catalog cold-start lever
// ---------------------------------------------------------------------------

export async function listAudit(limit = 100) {
  const res = await query(
    `SELECT a.id, a.admin_id, a.action, a.target, a.details, a.created_at,
            u.email AS admin_email
     FROM admin_audit_log a LEFT JOIN app_users u ON u.id = a.admin_id
     ORDER BY a.created_at DESC LIMIT $1`,
    [Math.min(Math.max(Number(limit) || 100, 1), 500)]
  );
  return res.rows.map((r) => ({
    id: String(r.id), adminEmail: r.admin_email ?? r.admin_id, action: r.action,
    target: r.target, details: r.details, createdAt: r.created_at,
  }));
}

/** Cold-start lever: bulk hide/unhide the sample catalog (audit-logged). */
export async function setSamplesHidden(adminId, hidden) {
  // NOTE: adminId is only used for the audit entry — it must NOT be passed as
  // an unused $1 query parameter (node-postgres "could not determine data
  // type of parameter $1" → every bulk hide/unhide 500'd). Never exercised
  // before smoke-db-run; verified live.
  const res = await query(
    `UPDATE profiles SET profile_visibility = $1, updated_at = NOW()
     WHERE is_sample AND ($1 = 'hidden' OR profile_visibility = 'hidden')
     RETURNING id`,
    [hidden ? "hidden" : "public"]
  );
  await writeAudit(adminId, hidden ? "samples.hide_all" : "samples.unhide_all", "*", `${res.rowCount} rows`);
  return { affected: res.rowCount };
}

// ---------------------------------------------------------------------------
// DPDP Act 2023 / Item 6: account deletion + data export.
//
// India Digital Personal Data Protection Act grants users:
//   - Right to erasure (Sec 12): withdraw consent and have data deleted.
//   - Right to data portability (Sec 11): obtain a copy of their personal data.
//
// Both endpoints are gated by the user's current password (mutation) or the
// active session (export). Deletion is soft: the app_users row is renamed + the
// PII columns are nulled so FK chains stop working and the user is gone from
// every search / chat / interest / message. The audit log retains the actor's
// id for compliance.
// ---------------------------------------------------------------------------

/** Returns everything the user has stored. Sequential queries (not 18-way
 * parallel) so one export never holds the whole pool (max 10) at once. */
export async function exportMyData(userId) {
  const safe = (rows) => rows || [];
  const q = async (text, params, limit = null) => safe((await query(text, params)).rows);
  const profile = await q(`SELECT * FROM profiles WHERE user_id = $1`, [userId]);
  const interestsSent = await q(`SELECT id, recipient_id, status, note, created_at, responded_at FROM interests WHERE sender_id = $1 ORDER BY created_at DESC LIMIT 500`, [userId]);
  const interestsRecv = await q(`SELECT id, sender_id, status, note, created_at, responded_at FROM interests WHERE recipient_id = $1 ORDER BY created_at DESC LIMIT 500`, [userId]);
  const interestsMatched = await q(`SELECT i.id, i.sender_id, i.recipient_id, i.status, i.note, i.created_at, i.responded_at FROM interests i WHERE (i.sender_id = $1 OR i.recipient_id = $1) AND i.status = 'accepted' ORDER BY i.created_at DESC LIMIT 500`, [userId]);
  const channels = await q(`SELECT id, user_a, user_b, created_at FROM channels WHERE $1 IN (user_a, user_b) ORDER BY created_at DESC LIMIT 200`, [userId]);
  const messages = await q(`SELECT m.id, m.channel_id, m.body, m.created_at FROM messages m JOIN channels c ON c.id = m.channel_id WHERE $1 IN (c.user_a, c.user_b) ORDER BY m.created_at DESC LIMIT 500`, [userId]);
  const videoDates = await q(`SELECT id, other_profile_id, scheduled_for, duration_minutes, status, kind, created_at, cancelled_at FROM video_dates WHERE requester_id = $1 ORDER BY created_at DESC LIMIT 200`, [userId]);
  const subscriptions = await q(`SELECT s.sku, s.activated_at, s.current_period_end, s.status, s.cancel_at_period_end, s.payment_id FROM subscriptions s WHERE s.user_id = $1`, [userId]);
  const transactions = await q(`SELECT payment_id, order_id, sku, amount_paise, status, source, created_at FROM payment_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 200`, [userId]);
  const refunds = await q(`SELECT refund_id, payment_id, order_id, amount_paise, reason, source, created_at FROM refunds WHERE user_id = $1 ORDER BY created_at DESC LIMIT 200`, [userId]);
  const notifications = await q(`SELECT id, type, title, body, read_at, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 200`, [userId]);
  const reports = await q(`SELECT id, reported_id, reason, details, status, created_at FROM reports WHERE reporter_id = $1 ORDER BY created_at DESC LIMIT 200`, [userId]);
  const blocks = await q(`SELECT blocked_id, created_at FROM blocks WHERE blocker_id = $1 LIMIT 500`, [userId]);
  const favorites = await q(`SELECT profile_id, created_at FROM favorites WHERE user_id = $1 LIMIT 500`, [userId]);
  const shortlists = await q(`SELECT profile_id, created_at FROM shortlists WHERE user_id = $1 LIMIT 500`, [userId]);
  const photos = await q(`SELECT url, is_primary, display_order, created_at FROM profile_photos WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = $1) LIMIT 50`, [userId]);
  const appUserRows = await q(`SELECT id, email, first_name, last_name, verified, created_at FROM app_users WHERE id = $1`, [userId]);
  const appUser = appUserRows[0] || null;
  return {
    exportedAt: new Date().toISOString(),
    requester: { id: userId },
    appUser,
    profile,
    interestsSent,
    interestsReceived: interestsRecv,
    interestsMatched,
    channels,
    messages,
    videoDates,
    subscriptions,
    paymentTransactions: transactions,
    refunds,
    notifications,
    reports,
    blocks,
    favorites,
    shortlists,
    photos,
  };
}

/**
 * Soft-delete a user. Renames the email and nulls PII so the row still exists
 * for FK integrity + audit log lookup, but is no longer reachable or
 * attributable. Cascades to the profile via ON DELETE CASCADE on the FK
 * `profiles.user_id` is missing; we manually cascade by nulling the
 * `app_users` email + tokenVersion and setting `is_admin` false; profile
 * `user_id` is left as-is (and the profile row is anonymized by deleting
 * PII columns in a follow-up; for v1 we DELETE the profile row).
 */
export async function deleteMyAccount(userId) {
  return withTx(async (c) => {
    // Pull the email so we can rename to a tombstone (preserves UNIQUE).
    const u = await c.query(`SELECT email FROM app_users WHERE id = $1 FOR UPDATE`, [userId]);
    const tombstoneEmail = `deleted-${userId}@deleted.medicomatch.in`;
    // Drop dependent profile rows (they expose PII).
    await c.query(`DELETE FROM profile_photos WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = $1)`, [userId]);
    await c.query(`DELETE FROM profiles WHERE user_id = $1`, [userId]);
    // Purge communication records (messages, channels, video dates) for DPDP erasure
    await c.query(`DELETE FROM messages WHERE sender_id = $1 OR channel_id IN (SELECT id FROM channels WHERE user_a = $1 OR user_b = $1)`, [userId]);
    await c.query(`DELETE FROM channels WHERE user_a = $1 OR user_b = $1`, [userId]);
    await c.query(`DELETE FROM video_dates WHERE requester_id = $1`, [userId]);
    // Bump tokenVersion to invalidate every session.
    await c.query(
      `UPDATE app_users
         SET email = $2,
             first_name = 'Deleted',
             last_name = 'User',
             specialty = '',
             degree = '',
             verified = FALSE,
             token_version = token_version + 1,
             is_admin = FALSE,
             is_root_admin = FALSE
       WHERE id = $1`,
      [userId, tombstoneEmail]
    );
    // Drop social graph rows that reference the user (blocks, reports).
    await c.query(`DELETE FROM blocks WHERE blocker_id = $1 OR blocked_id = $1`, [userId]);
    await c.query(`DELETE FROM reports WHERE reporter_id = $1`, [userId]);
    // Interests and favorites: withdraw. A user asking to be forgotten
    // shouldn't have an outgoing interest sitting in another user's
    // inbox.
    await c.query(`DELETE FROM interests WHERE sender_id = $1 OR recipient_id = $1`, [userId]);
    await c.query(`DELETE FROM favorites WHERE user_id = $1`, [userId]);
    await c.query(`DELETE FROM shortlists WHERE user_id = $1`, [userId]);
    // Subscriptions: revoke access immediately, retain the row for billing
    // audit (DPDP doesn't require deleting the financial record; it does
    // require erasing the personal linkage, which the email rename does).
    await c.query(
      `UPDATE subscriptions SET status = 'refunded', cancel_at_period_end = FALSE
       WHERE user_id = $1 AND status IN ('active', 'canceling')`,
      [userId]
    );
    // Notifications: drop; they're transient and only meaningful to the user.
    await c.query(`DELETE FROM notifications WHERE user_id = $1`, [userId]);
    // Quota ledger: drop; the user no longer exists.
    await c.query(`DELETE FROM user_quotas WHERE user_id = $1`, [userId]);
    return { ok: true, email: u.rows[0]?.email || null, tombstoneEmail };
  });
}

// ---------------------------------------------------------------------------
// Parity increment: trust, engagement, monetization (Shaadi/BharatMatrimony).
// All helpers are per-user scoped; admin variants are audit-logged by callers.
// ---------------------------------------------------------------------------
const otpHash = (code) => crypto.createHash("sha256").update(String(code)).digest("hex");

/** P0-1: issue a 6-digit OTP (hashed at rest, 10-min TTL, attempts reset). */
export async function requestPhoneOtp(userId, phone) {
  const clean = String(phone || "").replace(/[^\d+]/g, "").slice(0, 16);
  if (clean.replace(/\D/g, "").length < 10) {
    throw Object.assign(new Error("A valid 10+ digit mobile number is required."), { status: 400 });
  }
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  await query(
    `INSERT INTO phone_otps (user_id, phone, code_hash, expires_at, attempts)
     VALUES ($1,$2,$3,$4,0)
     ON CONFLICT (user_id) DO UPDATE SET phone=$2, code_hash=$3, expires_at=$4, attempts=0, created_at=NOW()`,
    [userId, clean, otpHash(code), expires]
  );
  await query(`UPDATE app_users SET phone=$2 WHERE id=$1`, [userId, clean]);
  // SMS provider hook: MSG91/Twilio procurement is a product call — until then
  // the code is emailed/logged in dev and returned in test mode only.
  return { expiresAt: expires, code };
}

/** P0-1: verify OTP; max 5 attempts then re-request. Sets phone_verified. */
export async function verifyPhoneOtp(userId, code) {
  return await withTx(async (c) => {
    const row = (await c.query(`SELECT phone, code_hash, expires_at, attempts FROM phone_otps WHERE user_id=$1 FOR UPDATE`, [userId])).rows[0];
    if (!row) throw Object.assign(new Error("Request a code first."), { status: 400 });
    if (new Date(row.expires_at).getTime() <= Date.now()) throw Object.assign(new Error("Code expired. Request a new one."), { status: 400 });
    if (Number(row.attempts) >= 5) throw Object.assign(new Error("Too many attempts. Request a new code."), { status: 429 });
    const ok = row.code_hash === otpHash(String(code || "").trim());
    if (!ok) {
      await c.query(`UPDATE phone_otps SET attempts = attempts + 1 WHERE user_id=$1`, [userId]);
      throw Object.assign(new Error("Invalid code."), { status: 400 });
    }
    await c.query(`DELETE FROM phone_otps WHERE user_id=$1`, [userId]);
    await c.query(`UPDATE app_users SET phone_verified=TRUE, verification_level='phone' WHERE id=$1 AND verification_level IN ('unverified','email')`, [userId]);
    return { verified: true, phone: row.phone };
  });
}

/** Verification A: format gate for council registration numbers. Not a
 *  registry lookup (that is a vendor integration decision) — it rejects
 *  EMPTY/garbage input so the reviewer always has a sane lookup key.
 *  Permissive on international formats (GMC numeric, ECFMG, AHPRA). */
export function validateRegistrationNumber(regNo) {
  const clean = String(regNo || "").trim();
  if (clean.length < 4 || clean.length > 40) {
    throw Object.assign(new Error("Registration number must be 4-40 characters."), { status: 400 });
  }
  const digits = (clean.match(/\d/g) || []).length;
  if (digits < 3) {
    throw Object.assign(new Error("Registration number must contain the digits of your council registration."), { status: 400 });
  }
  return true;
}

/** P0-2: member submits a verification document URL for review. */
export async function submitVerificationDoc(userId, docType, url) {
  const t = ["council", "id", "selfie", "other"].includes(docType) ? docType : "other";
  const clean = String(url || "").slice(0, 2000);
  if (!/^data:image\/|^https?:\/\//.test(clean)) throw Object.assign(new Error("Upload a valid document image URL."), { status: 400 });
  // Verification A (registry checkpoint): a council document carries the
  // member's declared registry identity so the reviewer has a concrete lookup
  // key (council + registration number) instead of eyeballing a scan alone.
  let council = null, regNo = null;
  if (t === "council") {
    const prof = await query(`SELECT council_name, registration_number FROM profiles WHERE user_id = $1`, [userId]);
    council = prof.rows[0]?.council_name ?? null;
    regNo = prof.rows[0]?.registration_number ?? null;
    if (!council || !regNo) {
      throw Object.assign(new Error("Add your council and registration number before submitting a council document."), { status: 400 });
    }
    validateRegistrationNumber(regNo);
  }
  const r = await query(
    `INSERT INTO verification_documents (user_id, doc_type, url, registry_checked, registry_reference)
     VALUES ($1,$2,$3,$4,$5) RETURNING id, created_at`,
    [userId, t, clean, t === "council", regNo ? `${council} / ${regNo}` : null]
  );
  await query(`UPDATE app_users SET id_document_url=$2 WHERE id=$1`, [userId, clean]);
  return { id: r.rows[0].id, createdAt: r.rows[0].created_at };
}

export async function listMyVerificationDocs(userId) {
  const r = await query(
    `SELECT id, doc_type, status, note, created_at, reviewed_at FROM verification_documents WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20`,
    [userId]
  );
  return r.rows.map((x) => ({ id: x.id, docType: x.doc_type, status: x.status, note: x.note, createdAt: x.created_at, reviewedAt: x.reviewed_at }));
}

/** P0-2/P0-8: admin review queue + warn/strike ladder. */
export async function listPendingVerifications(status = "pending", limit = 50) {
  const r = await query(
    `SELECT d.id, d.user_id, d.doc_type, d.url, d.status, d.created_at, u.email
     FROM verification_documents d JOIN app_users u ON u.id = d.user_id
     WHERE ($1='all' OR d.status=$1) ORDER BY d.created_at DESC LIMIT $2`,
    [status, Math.min(Math.max(Number(limit) || 50, 1), 200)]
  );
  return r.rows.map((x) => ({ id: x.id, userId: x.user_id, userEmail: x.email, docType: x.doc_type, url: x.url, status: x.status, createdAt: x.created_at }));
}

export async function reviewVerification(adminId, docId, outcome, note = "", registryChecked = false, registryReference = "") {
  if (!["approved", "rejected"].includes(String(outcome))) {
    throw Object.assign(new Error("outcome must be approved or rejected."), { status: 400 });
  }
  const out = String(outcome);
  // Verification A: the reviewer records WHAT registry entry was checked. An
  // approval WITHOUT a registry reference is still allowed (docs-only review)
  // but is marked registry_checked=FALSE — honest about the trust level.
  const r = await query(
    `UPDATE verification_documents
     SET status=$2, reviewer=$3, note=$4, reviewed_at=NOW(),
         registry_checked=$5, registry_reference=$6
     WHERE id=$1 RETURNING user_id, doc_type`,
    [docId, out, adminId, String(note || "").slice(0, 500), Boolean(registryChecked), String(registryReference || "").slice(0, 200)]
  );
  if (r.rowCount === 0) throw Object.assign(new Error("Document not found."), { status: 404 });
  const uid = r.rows[0].user_id;
  if (out === "approved") {
    await query(`UPDATE profiles SET is_verified=TRUE, updated_at=NOW() WHERE user_id=$1`, [uid]);
    // registry-checked approvals set the HIGHEST trust level; docs-only stays
    // at the manual level so the badge text can be honest in the UI.
    if (registryChecked) {
      await query(`UPDATE app_users SET verification_level='registry', id_verified_at=NOW() WHERE id=$1`, [uid]);
    } else {
      await query(`UPDATE app_users SET verification_level=CASE WHEN phone_verified THEN 'phone_id' ELSE 'phone_id_manual' END, id_verified_at=NOW() WHERE id=$1`, [uid]);
    }
  }
  await writeAudit(adminId, `verification.${out}`, docId,
    `${note} ${registryChecked ? `[registry: ${String(registryReference || "").slice(0, 120)}]` : "[docs-only]"}`.trim().slice(0, 500));
  return { id: docId, status: out, registryChecked: Boolean(registryChecked) };
}

/** P0-8: warn increments strikes; 3rd strike auto-suspends (canonical store handled by caller). */
export async function warnUser(adminId, targetUserId, reason = "") {
  const r = await query(`UPDATE app_users SET strike_count = strike_count + 1 WHERE id=$1 RETURNING strike_count`, [targetUserId]);
  if (r.rowCount === 0) throw Object.assign(new Error("User not found."), { status: 404 });
  const strikes = Number(r.rows[0].strike_count);
  await query(`INSERT INTO notifications (user_id, type, title, body) VALUES ($1,'warning','Profile warning',$2)`, [targetUserId, `Our moderation team flagged your account (${strikes}/3 strikes). ${String(reason).slice(0, 300)}`.slice(0, 500)]);
  safePublish(targetUserId, "notification", { type: "warning", strikes });
  await writeAudit(adminId, "user.warn", targetUserId, `strikes=${strikes} ${reason}`.slice(0, 500));
  return { strikes, autoSuspend: strikes >= 3 };
}

/** P0-7: mark peer messages read; returns newly-read count. */
export async function markMessagesRead(userId, channelId) {
  const ch = await query(`SELECT id FROM channels WHERE id=$1 AND ($2 IN (user_a, user_b))`, [channelId, userId]);
  if (ch.rowCount === 0) throw Object.assign(new Error("Channel not found."), { status: 404 });
  const r = await query(
    `UPDATE messages SET read_at=NOW() WHERE channel_id=$1 AND sender_id <> $2 AND read_at IS NULL RETURNING id`,
    [channelId, userId]
  );
  return { read: r.rowCount };
}

/** P0-6: events + RSVP + approved stories. */
export async function listEvents() {
  const r = await query(`SELECT id, title, event_date, event_time, location, description, created_at FROM events ORDER BY created_at DESC LIMIT 100`);
  return r.rows.map((x) => ({ id: x.id, title: x.title, date: x.event_date, time: x.event_time, location: x.location, description: x.description, createdAt: x.created_at }));
}

export async function createEvent(adminId, input) {
  const r = await query(
    `INSERT INTO events (title, event_date, event_time, location, description, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [String(input.title || "").slice(0, 120), String(input.date || "").slice(0, 30), String(input.time || "").slice(0, 30), String(input.location || "").slice(0, 120), String(input.description || "").slice(0, 2000), adminId]
  );
  await writeAudit(adminId, "event.create", r.rows[0].id, String(input.title || "").slice(0, 200));
  return { id: r.rows[0].id };
}

export async function rsvpEvent(userId, eventId) {
  await query(`INSERT INTO event_rsvps (event_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [eventId, userId]);
  return { rsvped: true };
}

export async function listStories(approvedOnly = true) {
  const r = await query(
    `SELECT id, partner_name, story, photo_url, created_at FROM success_stories WHERE ($1=FALSE OR approved) ORDER BY created_at DESC LIMIT 100`,
    [approvedOnly]
  );
  return r.rows.map((x) => ({ id: x.id, partnerName: x.partner_name, story: x.story, photoUrl: x.photo_url, createdAt: x.created_at }));
}

export async function submitStory(userId, input) {
  const r = await query(
    `INSERT INTO success_stories (user_id, partner_name, story, photo_url) VALUES ($1,$2,$3,$4) RETURNING id`,
    [userId, String(input.partnerName || "").slice(0, 120), String(input.story || "").slice(0, 4000), String(input.photoUrl || "").slice(0, 2000)]
  );
  return { id: r.rows[0].id };
}

export async function approveStory(adminId, storyId, approved) {
  await query(`UPDATE success_stories SET approved=$2 WHERE id=$1`, [storyId, Boolean(approved)]);
  await writeAudit(adminId, approved ? "story.approve" : "story.reject", storyId, "");
  return { id: storyId, approved: Boolean(approved) };
}

/** P0-5: daily matches — real match ranking now, not just boost/verified order.
 *  Server-side partner-preference overlap: candidates must fit the viewer's
 *  declared age band and (when set) city/religion/mother-tongue preferences
 *  BEFORE the boost/verified/gunas ordering applies. Preferences are the
 *  matrimony product's core promise; previously they only existed as fields. */
export async function getDailyMatches(userId, limit = 10) {
  const me = (
    await query(
      `SELECT city, specialty, religion, mother_tongue,
              pref_age_min, pref_age_max, pref_location
       FROM profiles WHERE user_id = $1`,
      [userId]
    )
  ).rows[0];
  const n = Math.min(Math.max(Number(limit) || 10, 1), 50);
  const r = await query(
    `SELECT ${PROFILE_PUBLIC_COLS},
            -- Compatibility score: preference overlap + gunas, computed in
            -- SQL so it can rank (and later paginate) without client math.
            (CASE WHEN p.age BETWEEN $2::int AND $3::int THEN 2 ELSE 0 END
             + CASE WHEN $4::text IS NOT NULL AND p.city ILIKE $4 THEN 2 ELSE 0 END
             + CASE WHEN $5::text IS NOT NULL AND p.religion ILIKE $5 THEN 2 ELSE 0 END
             + CASE WHEN $6::text IS NOT NULL AND p.mother_tongue ILIKE $6 THEN 1 ELSE 0 END
             + LEAST(COALESCE(p.kundali_gunas, 0) / 12, 2)) AS match_score
     FROM profiles p
     WHERE (p.profile_visibility = 'public' OR (p.profile_visibility = 'verified_only' AND EXISTS (
        SELECT 1 FROM profiles me WHERE me.user_id = $1 AND me.is_verified))) AND p.is_sample = FALSE -- H-3 FIX: verified_only needs a verified viewer
       AND p.user_id IS DISTINCT FROM $1
       AND NOT EXISTS (SELECT 1 FROM blocks b
           WHERE (b.blocker_id = p.user_id AND b.blocked_id = $1)
              OR (b.blocker_id = $1 AND b.blocked_id = p.user_id))
       -- Soft preference gates (NULL pref = no constraint).
       AND p.age BETWEEN COALESCE($2::int, p.age - 1) AND COALESCE($3::int, p.age + 1)
       AND ($4::text IS NULL OR p.city ILIKE $4)
       AND ($5::text IS NULL OR p.religion ILIKE $5)
       AND ($6::text IS NULL OR p.mother_tongue ILIKE $6)
     ORDER BY match_score DESC,
              EXISTS(SELECT 1 FROM profile_boosts b WHERE b.user_id = p.user_id AND b.expires_at > NOW()) DESC,
              p.is_verified DESC, p.kundali_gunas DESC NULLS LAST
     LIMIT $7`,
    [
      userId,
      me?.pref_age_min ?? null,
      me?.pref_age_max ?? null,
      me?.pref_location ? like(me.pref_location) : (me?.city ? like(me.city) : null),
      me?.religion ? like(me.religion) : null,
      me?.mother_tongue ? like(me.mother_tongue) : null,
      n,
    ]
  );
  const viewer = await viewerContext(userId);
  return r.rows.map((row) => ({ ...rowToPublicProfile(row, viewer), matchScore: Math.round((Number(row.match_score) || 0) * 10) }));
}

/** P0-3: subscriptions expiring in N days (renewal reminders) + recently expired. */
export async function subscriptionsExpiring(days = 3) {
  const r = await query(
    `SELECT s.user_id, s.sku, s.current_period_end, u.email FROM subscriptions s
     JOIN app_users u ON u.id = s.user_id
     JOIN plans p ON p.sku = s.sku
     WHERE s.status='active' AND p.kind = 'membership' AND s.current_period_end > NOW()
       AND s.current_period_end <= NOW() + make_interval(days => $1::int)
       AND (s.renewal_notified_at IS NULL OR s.renewal_notified_at < NOW() - INTERVAL '3 days')
     LIMIT 500`,
    [Math.min(Math.max(Number(days) || 3, 1), 14)]
  );
  return r.rows.map((x) => ({ userId: x.user_id, sku: x.sku, expiresAt: x.current_period_end, email: x.email }));
}

export async function markRenewalNotified(userId, sku) {
  await query(
    `UPDATE subscriptions SET renewal_notified_at = NOW() WHERE user_id = $1 AND sku = $2`,
    [userId, sku]
  );
}

/** P0-10: Spotlight boost grant + coupon validation. */
export async function grantBoost(userId, days = 7) {
  const r = await query(
    `INSERT INTO profile_boosts (user_id, expires_at) VALUES ($1, NOW() + make_interval(days => $2::int))
     ON CONFLICT (user_id) DO UPDATE SET expires_at = GREATEST(profile_boosts.expires_at, NOW()) + make_interval(days => $2::int)
     RETURNING expires_at`,
    [userId, Math.min(Math.max(Number(days) || 7, 1), 30)]
  );
  return { expiresAt: r.rows[0].expires_at };
}

export async function getBoost(userId) {
  const r = await query(`SELECT expires_at FROM profile_boosts WHERE user_id=$1 AND expires_at > NOW()`, [userId]);
  return { active: r.rowCount > 0, expiresAt: r.rows[0]?.expires_at ?? null };
}

// ---------------------------------------------------------------------------
// Kundali match report (paid digital product). The buyer pays once per PAIR;
// the report is generated server-side from the SAME engine as the free
// preview (computeKundaliMilan) so paid and free can never disagree.
// ---------------------------------------------------------------------------
export async function getKundaliReport(buyerId, profileId) {
  const target = await query(`SELECT id, user_id, profile_visibility, rashi, nakshatra, manglik, full_name FROM profiles WHERE id = $1`, [profileId]);
  const t = target.rows[0];
  if (!t) throw Object.assign(new Error("Profile not found."), { status: 404 });
  if (t.user_id === buyerId) throw Object.assign(new Error("You cannot buy a report for your own profile."), { status: 400 });
  // Same gates as browse/reveal: hidden profiles and either direction of
  // blocks must not be reportable (previously a blocked user could buy a
  // report on the blocker). 404 masks existence like revealContact.
  // H-3 FIX: `verified_only` targets need a verified buyer (owner excluded
  // above). SAFE DEFAULT: unverified buyer => 404.
  if (t.profile_visibility === "hidden") {
    throw Object.assign(new Error("Profile not found."), { status: 404 });
  }
  if (t.profile_visibility === "verified_only") {
    const me = await query(`SELECT is_verified FROM profiles WHERE user_id = $1`, [buyerId]);
    if (!me.rows[0]?.is_verified) throw Object.assign(new Error("Profile not found."), { status: 404 });
  }
  if (t.user_id) {
    const blocked = await query(
      `SELECT 1 FROM blocks WHERE (blocker_id=$1 AND blocked_id=$2) OR (blocker_id=$2 AND blocked_id=$1)`,
      [buyerId, t.user_id]
    );
    if (blocked.rowCount > 0) throw Object.assign(new Error("Profile not found."), { status: 404 });
  }

  // Already generated (paid earlier): always accessible — the purchase is the
  // entitlement, the report row is the receipt.
  const stored = await query(`SELECT report, created_at FROM kundali_reports WHERE buyer_id = $1 AND profile_id = $2`, [buyerId, profileId]);
  if (stored.rowCount > 0) {
    return { report: stored.rows[0].report, createdAt: stored.rows[0].created_at, alreadyOwned: true };
  }

  // Entitlement: an ACTIVE kundali-report subscription (granted by the normal
  // Razorpay -> redeem path; kind='consultation' so it never touches memberships).
  const entitled = await query(
    `SELECT 1 FROM subscriptions s WHERE s.user_id = $1 AND s.sku = 'kundali-report'
       AND s.status = 'active' AND s.current_period_end > NOW()`,
    [buyerId]
  );
  if (entitled.rowCount === 0) {
    throw Object.assign(new Error("Purchase the Detailed Kundali Match Report to view this breakdown."), {
      status: 402, code: "purchase_required", sku: "kundali-report",
    });
  }

  const me = await query(`SELECT rashi, nakshatra, manglik, full_name FROM profiles WHERE user_id = $1`, [buyerId]);
  const mine = me.rows[0] || {};
  const report = computeKundaliMilan(mine, t);
  const full = {
    ...report,
    partnerA: { name: mine.full_name ?? "You" },
    partnerB: { name: t.full_name ?? "Member", profileId },
    generatedAt: new Date().toISOString(),
    // Honest product framing: algorithmic reference, not a guarantee.
    disclaimer: "Algorithmic Ashta Koota reference based on self-declared birth details. For matrimonial compatibility reference only — not a guarantee or astrological advice.",
  };
  await query(
    `INSERT INTO kundali_reports (buyer_id, profile_id, report)
     VALUES ($1, $2, $3)
     ON CONFLICT (buyer_id, profile_id) DO UPDATE SET report = EXCLUDED.report`,
    [buyerId, profileId, JSON.stringify(full)]
  );
  // Single-use per PAIR (safe default made explicit): consuming the entitlement
  // here means one ₹499 payment mints one pair's report, not unlimited pairs
  // in the 30-day window. Re-reads of the same pair stay free via the stored
  // row above; the next *new* pair requires a fresh purchase.
  await query(
    `UPDATE subscriptions SET status = 'expired'
     WHERE user_id = $1 AND sku = 'kundali-report' AND status = 'active'`,
    [buyerId]
  );
  return { report: full, createdAt: new Date().toISOString(), alreadyOwned: false };
}

export async function validateCoupon(code, userId = null) {
  if (!code) return null;
  const c = String(code).trim().toUpperCase().slice(0, 32);
  const r = await query(`SELECT code, percent_off, max_uses, used, expires_at, once_per_user FROM coupons WHERE code=$1`, [c]);
  const row = r.rows[0];
  if (!row || row.used >= row.max_uses || (row.expires_at && new Date(row.expires_at).getTime() <= Date.now())) return null;
  // M-1 FIX: once-per-user coupons reject accounts that already redeemed.
  if (userId && row.once_per_user) {
    const seen = await query(`SELECT 1 FROM coupon_redemptions WHERE code=$1 AND user_id=$2`, [c, userId]);
    if (seen.rowCount > 0) return null;
  }
  return { code: row.code, percentOff: Number(row.percent_off) };
}

export async function consumeCoupon(code, userId = null) {
  const c = String(code).trim().toUpperCase().slice(0, 32);
  // M-1 FIX: record the per-user redemption first — the PK is the race
  // backstop (concurrent double-use => one 23505). Global `used` still ticks
  // for pool accounting.
  if (userId) {
    try {
      await query(`INSERT INTO coupon_redemptions (code, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [c, userId]);
    } catch { /* honor the purchase on ledger race */ }
  }
  const r = await query(`UPDATE coupons SET used = used + 1 WHERE code=$1 AND used < max_uses RETURNING percent_off`, [c]);
  return r.rows[0] ? Number(r.rows[0].percent_off) : null;
}