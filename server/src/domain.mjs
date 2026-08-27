// Domain layer for DB mode: profiles, interests (state machine + SERVER-side
// quotas), chat, video dates, blocks/reports, contact reveal, and the billing
// records behind Razorpay webhooks. Every function is scoped by the caller's
// authenticated user id — there are no unscoped reads.
import { query, withTx, istPeriod } from "./db.mjs";
import { publishToUser } from "./events.mjs";

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
  is_verified, is_online`;

// Audit L2: ILIKE metacharacters are escaped so user input cannot inject %/_
// wildcards (full-scan DoS). Inputs are also length-capped at the call sites.
const escapeLike = (s) => String(s).replace(/[\\%_]/g, (m) => "\\" + m);
/** Escaped, length-capped ILIKE pattern (audit L2). */
const like = (s) => `%${escapeLike(String(s ?? "").slice(0, 80))}%`;

function rowToPublicProfile(row) {
  if (!row) return null;
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
    isOnline: row.is_online,
  };
}

export async function browseProfiles({
  viewerId, city, specialty, q, minAge, maxAge, verifiedOnly,
  religion, caste, motherTongue, gotra, orientation, ethnicity, minGunas,
  limit = 60, offset = 0,
}) {
  const params = [viewerId];
  let n = 1;
  const cond = [];
  cond.push("p.profile_visibility = 'public'");
  // Never show the viewer their own profile; hide either direction of blocks.
  cond.push(`p.user_id IS DISTINCT FROM $${n}`);
  cond.push(`NOT EXISTS (SELECT 1 FROM blocks b
      WHERE (b.blocker_id = p.user_id AND b.blocked_id = $${n})
         OR (b.blocker_id = $${n} AND b.blocked_id = p.user_id))`);
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
     ORDER BY p.is_verified DESC, p.kundali_gunas DESC NULLS LAST
     LIMIT $${n - 1} OFFSET $${n}`,
    params
  );
  return res.rows.map(rowToPublicProfile);
}

export async function getProfile(id) {
  const res = await query(
    `SELECT ${PROFILE_PUBLIC_COLS} FROM profiles p WHERE p.id = $1`,
    [id]
  );
  return rowToPublicProfile(res.rows[0]);
}

const UPDATABLE_PROFILE_FIELDS = [
  "full_name","gender","age","height_cm","marital_status","degree","specialty",
  "sub_specialty","hospital","city","state","country","about_me","looking_for",
  "interests","photo_url","sexual_orientation","ethnicity","religion","caste",
  "subcaste","gotra","mother_tongue","rashi","nakshatra","manglik",
  "kundali_gunas","pref_age_min","pref_age_max","pref_location","phone","email",
];

export async function upsertMyProfile(userId, baseUser, input) {
  const values = {};
  for (const [k, v] of Object.entries(input || {})) {
    if (!UPDATABLE_PROFILE_FIELDS.includes(k)) continue; // strict whitelist
    values[k] = v;
  }
  if (values.full_name !== undefined && !String(values.full_name).trim()) {
    throw Object.assign(new Error("Name is required."), { status: 400 });
  }
  const displayName = `${baseUser.firstName} ${baseUser.lastName}`.trim() || baseUser.email;
  await withTx(async (c) => {
    await c.query(
      `INSERT INTO app_users (id, email, first_name, last_name, specialty, degree, verified)
       VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7, FALSE))
       ON CONFLICT (id) DO UPDATE SET
         first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name`,
      [userId, baseUser.email, baseUser.firstName, baseUser.lastName, baseUser.specialty, baseUser.degree, baseUser.verified ?? null]
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
  return rowToPublicProfile(res.rows[0]);
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
 * excluded — they grant no browse/interest/video-date quota. */
async function activePlanTx(client, userId) {
  const res = await client.query(
    `SELECT p.sku, p.max_video_dates, p.max_interests, p.max_contacts
     FROM subscriptions s JOIN plans p ON p.sku = s.sku
     WHERE s.user_id = $1 AND s.status = 'active' AND s.current_period_end > NOW()
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

export async function getQuotaSummary(userId) {
  const period = istPeriod();
  const res = await query(
    `SELECT p.sku AS plan, p.max_video_dates, p.max_interests, p.max_contacts,
            s.status AS sub_status, s.current_period_end AS period_end, s.cancel_at_period_end AS canceling,
            COALESCE(q.video_dates_used,0) AS vd, COALESCE(q.interests_used,0) AS iu,
            COALESCE(q.contact_views_used,0) AS cu
     FROM subscriptions s
     JOIN plans p ON p.sku = s.sku
     LEFT JOIN user_quotas q ON q.user_id = s.user_id AND q.period = $2
     WHERE s.user_id = $1
     ORDER BY p.rank DESC, s.current_period_end DESC NULLS LAST`,
    [userId, period]
  );
  let row = res.rows[0];
  const expired = row && row.sub_status === "active" &&
    (!row.period_end || new Date(row.period_end).getTime() <= Date.now());
  if (!row || row.sub_status !== "active" || expired) {
    // Effective plan is basic; still surface the old subscription's expiry info.
    row = {
      plan: "basic", max_video_dates: BASIC_PLAN.max_video_dates,
      max_interests: BASIC_PLAN.max_interests, max_contacts: BASIC_PLAN.max_contacts,
      sub_status: row ? (expired ? "expired" : row.sub_status) : null,
      period_end: row?.period_end ?? null,
      canceling: row ? row.canceling : false,
      vd: row?.vd ?? 0, iu: row?.iu ?? 0, cu: row?.cu ?? 0,
    };
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
      const senderName = senderProf.rows[0]?.full_name || "Someone";
      await c.query(
        `INSERT INTO notifications (user_id, type, title, body)
         VALUES ($1,'interest_received','New interest',$2)`,
        [recipient, `${senderName.replace(/^Dr\.\s*/i, "Dr. ")} showed interest in your profile.`]
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
    `SELECT id, sender_id, body, created_at FROM messages
     WHERE channel_id = $1 ORDER BY id ASC LIMIT $2`,
    // Audit L1: clamp BOTH ends — a negative/NaN limit previously produced a
    // Postgres error (500).
    [channelId, Math.min(Math.max(Number(limit) || 100, 1), 500)]
  );
  return res.rows.map((r) => ({ id: String(r.id), senderId: r.sender_id, mine: r.sender_id === userId, body: r.body, createdAt: r.created_at }));
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

export async function createVideoDate(userId, profileId, scheduledFor, durationMinutes) {
  const when = new Date(scheduledFor);
  if (Number.isNaN(when.getTime()) || when.getTime() < Date.now() - 60_000) {
    throw Object.assign(new Error("Pick a future date and time."), { status: 400 });
  }
  const dur = Math.min(Math.max(Number(durationMinutes) || 30, 10), 180);
  // Audit M1: quota consumption + booking insert must be atomic. Were they two
  // separate autocommit transactions, a crash or FK failure after the decrement
  // would burn a quota unit with no booking. `withTx` rolls the pair back
  // together on any failure.
  const out = await withTx(async (c) => {
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
  const res = await query(
    `SELECT v.id, v.scheduled_for, v.duration_minutes, v.status, v.kind,
            p.id AS profile_id, p.full_name AS name, p.photo_url
     FROM video_dates v LEFT JOIN profiles p ON p.id = v.other_profile_id
     WHERE v.requester_id = $1 AND v.status IN ('requested','accepted')
     ORDER BY v.scheduled_for ASC`,
    [userId]
  );
  return res.rows.map((r) => ({
    id: r.id,
    scheduledFor: r.scheduled_for,
    durationMinutes: r.duration_minutes,
    status: r.status,
    kind: r.kind,
    profile: {
      id: r.profile_id ?? null,
      name: r.kind === 'consultation' ? 'Astrology Consultation' : (r.name ?? 'Member'),
      imageUrl: r.photo_url,
    },
  }));
}

export async function cancelVideoDate(userId, videoDateId) {
  return withTx(async (c) => {
    const res = await c.query(
      `UPDATE video_dates SET status='cancelled', cancelled_at=NOW()
       WHERE id=$1 AND requester_id=$2 AND status IN ('requested','accepted')
       RETURNING id, created_at`,
      [videoDateId, userId]
    );
    if (res.rowCount === 0) {
      throw Object.assign(new Error("Video date not found or not cancellable."), { status: 404 });
    }
    // Audit M2: refund the CONSUMPTION month — the IST month in which the
    // booking consumed its quota unit — not the cancellation month.
    const consumptionPeriod = istPeriod(new Date(res.rows[0].created_at));
    await ensureQuotaRow(c, userId, consumptionPeriod);
    await c.query(
      `UPDATE user_quotas SET video_dates_used = GREATEST(0, video_dates_used - 1)
       WHERE user_id = $1 AND period = $2`,
      [userId, consumptionPeriod]
    );
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
  const prof = await query(`SELECT user_id, phone, email FROM profiles WHERE id = $1`, [profileId]);
  const row = prof.rows[0];
  if (!row) throw Object.assign(new Error("Profile not found."), { status: 404 });
  if (row.user_id === viewerId) {
    return { phone: row.phone ?? "", email: row.email ?? "", ownProfile: true, quota: await getQuotaSummary(viewerId) };
  }
  if (!row.phone && !row.email) {
    // Honest answer, no charge — there is nothing to reveal.
    return { phone: "", email: "", shared: false, quota: await getQuotaSummary(viewerId) };
  }
  const quota = await consumeQuota(viewerId, "contact_views");
  if (!quota.ok) {
    throw Object.assign(new Error("Contact views limit reached for your plan."), { status: 429, code: "quota", quota });
  }
  return { phone: row.phone ?? "", email: row.email ?? "", shared: true, quota };
}

// ---------------------------------------------------------------------------
// Billing (M7): durable orders + idempotent captured payments. When a payment
// maps to a known order placed by a signed-in user, the subscription is
// granted HERE — server-authoritative activation that no longer depends on
// the browser returning to redeem a token.
// ---------------------------------------------------------------------------

export async function recordOrder({ orderId, userId, sku, amountPaise, simulated }) {
  await query(
    `INSERT INTO payment_orders (order_id, user_id, sku, amount_paise, simulated)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (order_id) DO UPDATE SET
       user_id = COALESCE(payment_orders.user_id, EXCLUDED.user_id)`,
    [orderId, userId ?? null, sku, amountPaise, Boolean(simulated)]
  );
}

export async function getOrder(orderId, userId = null) {
  // Audit L5: optional caller scope — when a userId is supplied the row is
  // only returned if it belongs to that user (enumeration hardening for any
  // future routing of this lookup).
  const res = await query(
    `SELECT order_id, user_id, sku, amount_paise, status FROM payment_orders
     WHERE order_id = $1 AND ($2::text IS NULL OR user_id = $2)`,
    [orderId, userId]
  );
  return res.rows[0] ?? null;
}

/**
 * Idempotently record one captured payment.
 * Returns 'applied' exactly once per paymentId; Razorpay's redeliveries return
 * 'duplicate' and change nothing.
 */
export async function recordCapturedPayment({ paymentId, orderId, userId, sku, amountPaise, source }) {
  return withTx(async (c) => {
    const gate = await c.query(
      `INSERT INTO webhook_events (event_id, event_type) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [paymentId, source]
    );
    if (gate.rowCount === 0) return { result: "duplicate" };

    let order = null;
    if (orderId) {
      const o = await c.query(
        `SELECT order_id, user_id, sku FROM payment_orders WHERE order_id = $1 FOR UPDATE`,
        [orderId]
      );
      order = o.rows[0] ?? null;
      if (order) {
        await c.query(`UPDATE payment_orders SET status='paid' WHERE order_id=$1 AND status='created'`, [orderId]);
      }
    }
    const effectiveUser = order?.user_id ?? userId ?? null;
    const effectiveSku = order?.sku ?? sku ?? null;

    await c.query(
      `INSERT INTO payment_transactions (payment_id, order_id, user_id, sku, amount_paise, status, source)
       VALUES ($1,$2,$3,$4,$5,'captured',$6) ON CONFLICT DO NOTHING`,
      [paymentId, orderId ?? null, effectiveUser, effectiveSku, amountPaise ?? null, source]
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
      await c.query(
        `INSERT INTO subscriptions (user_id, sku, payment_id, current_period_end, status)
         VALUES ($1,$2,$3,$4,'active')
         ON CONFLICT (user_id, sku) DO UPDATE SET
           payment_id = EXCLUDED.payment_id,
           current_period_end = CASE
             WHEN (SELECT rank FROM plans WHERE sku = subscriptions.sku)
                  < (SELECT rank FROM plans WHERE sku = EXCLUDED.sku)
               THEN EXCLUDED.current_period_end
             ELSE GREATEST(COALESCE(subscriptions.current_period_end, NOW()), NOW())
                  + make_interval(days => $5::int)
           END,
           status = 'active', cancel_at_period_end = FALSE, activated_at = NOW()
         WHERE (SELECT rank FROM plans WHERE sku = subscriptions.sku)
               <= (SELECT rank FROM plans WHERE sku = EXCLUDED.sku)`,
        [effectiveUser, grantSku, paymentId, periodEnd, days]
      );
    }
    return { result: "applied", userId: effectiveUser, sku: effectiveSku };
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
     WHERE s.user_id = $1 AND s.status = 'active' AND s.current_period_end > NOW()
       AND p.kind = 'membership'
     ORDER BY p.rank DESC LIMIT 1`,
    [userId]
  );
  return res.rows[0]?.sku ?? null;
}

export async function cancelBilling(userId) {
  const res = await query(
    `UPDATE subscriptions SET status = 'canceling', cancel_at_period_end = TRUE
     WHERE user_id = $1 AND status = 'active' AND current_period_end > NOW()
     RETURNING sku, current_period_end`,
    [userId]
  );
  if (res.rowCount === 0) {
    throw Object.assign(new Error("No active paid subscription to cancel."), { status: 404 });
  }
  return { status: "canceling", planExpiresAt: res.rows[0].current_period_end };
}

export async function resumeBilling(userId) {
  const res = await query(
    `UPDATE subscriptions SET status = 'active', cancel_at_period_end = FALSE
     WHERE user_id = $1 AND status = 'canceling' AND current_period_end > NOW()
     RETURNING sku, current_period_end`,
    [userId]
  );
  if (res.rowCount === 0) {
    throw Object.assign(new Error("Nothing to resume."), { status: 404 });
  }
  return { status: "active", planExpiresAt: res.rows[0].current_period_end };
}

// ---------------------------------------------------------------------------
// Admin / moderation (v2). Every mutation here is written to admin_audit_log.
// ---------------------------------------------------------------------------

export async function writeAudit(adminId, action, target, details = "") {
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
  const res = await query(
    `UPDATE reports SET status=$2, resolved_by=$3, resolved_at=NOW(), resolution_note=$4
     WHERE id=$1 RETURNING id, reported_id`,
    [reportId, outcome === "dismissed" ? "dismissed" : "resolved", adminId, String(note || "").slice(0, 500)]
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
            s.sku AS plan,
            p.full_name AS profile_name
     FROM app_users u
     LEFT JOIN LATERAL (
       SELECT s2.sku FROM subscriptions s2 JOIN plans p2 ON p2.sku = s2.sku
       WHERE s2.user_id = u.id
       ORDER BY p2.rank DESC, s2.current_period_end DESC NULLS LAST
       LIMIT 1
     ) s ON TRUE
     LEFT JOIN profiles p ON p.user_id = u.id
     WHERE ${where}
     ORDER BY u.created_at DESC LIMIT ${params.length}`,
    params
  );
  return res.rows.map((r) => ({
    id: r.id, email: r.email, firstName: r.first_name, lastName: r.last_name,
    verified: r.verified,
    isAdmin: Boolean(r.is_admin || r.is_root_admin),
    isRoot: Boolean(r.is_root_admin),
    createdAt: r.created_at,
    plan: r.plan ?? "basic", profileName: r.profile_name ?? null,
  }));
}

/**
 * Refund policy (documented default): a refunded membership payment revokes
 * the paid plan IMMEDIATELY (downgrade to basic). Consumed quotas are not
 * clawed back. Consultation skus have no subscription side-effects.
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
        `SELECT payment_id, order_id, user_id, sku FROM payment_transactions WHERE payment_id = $1`,
        [paymentId]
      );
      tx = t.rows[0] ?? null;
    }
    const effectiveUser = tx?.user_id ?? null;
    const effectiveSku = tx?.sku ?? null;

    await c.query(
      `INSERT INTO refunds (refund_id, payment_id, order_id, user_id, amount_paise, reason, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        refundId, paymentId ?? tx?.payment_id ?? null, orderId ?? tx?.order_id ?? null,
        effectiveUser, amountPaise ?? null, String(reason || "").slice(0, 300), source,
      ]
    );

    // Policy: money returned ⇒ access revoked immediately. The effective plan
    // falls back to basic because status != 'active' (see activePlanTx).
    if (effectiveUser && effectiveSku && !effectiveSku.startsWith("astrologer")) {
      await c.query(
        `UPDATE subscriptions SET status = 'refunded', cancel_at_period_end = FALSE
         WHERE user_id = $1 AND status IN ('active','canceling')`,
        [effectiveUser]
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
  const params = [userId];
  let where = "user_id = $1";
  if (unreadOnly) {
    params.push(true);
    where += ` AND read_at IS NULL`;
  }
  params.push(Math.min(Math.max(Number(limit) || 50, 1), 200));
  const res = await query(
    `SELECT id, type, title, body, data, read_at, created_at FROM notifications
     WHERE ${where} ORDER BY created_at DESC LIMIT $${params.length}`,
    params
  );
  const unread = await query(
    `SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL`,
    [userId]
  );
  return {
    notifications: res.rows.map((r) => ({
      id: r.id, type: r.type, title: r.title, body: r.body,
      data: r.data ? JSON.parse(r.data) : {}, read: Boolean(r.read_at),
      createdAt: r.created_at,
    })),
    unreadCount: unread.rows[0]?.n ?? 0,
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

export async function setPrimaryPhoto(userId, url) {
  return withTx(async (c) => {
    await c.query(
      `INSERT INTO profiles (id, user_id, full_name) VALUES (gen_random_uuid()::text, $1, '')
       ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );
    const prof = await c.query(`SELECT id FROM profiles WHERE user_id = $1`, [userId]);
    const profileId = prof.rows[0].id;
    // Replace-all model for v1: one primary photo per profile.
    await c.query(`DELETE FROM profile_photos WHERE profile_id = $1`, [profileId]);
    await c.query(
      `INSERT INTO profile_photos (profile_id, url, is_primary, display_order) VALUES ($1,$2,TRUE,0)`,
      [profileId, url]
    );
    await c.query(`UPDATE profiles SET photo_url = $2, updated_at = NOW() WHERE id = $1`, [profileId, url]);
    return { url };
  });
}

// ---------------------------------------------------------------------------
// Consultations: bookable only while an astrologer-consultation entitlement
// is active (time-boxed exactly like memberships).
// ---------------------------------------------------------------------------

export async function createConsultation(userId, scheduledFor, durationMinutes) {
  const when = new Date(scheduledFor);
  if (Number.isNaN(when.getTime()) || when.getTime() < Date.now() - 60_000) {
    throw Object.assign(new Error("Pick a future date and time."), { status: 400 });
  }
  const active = await query(
    `SELECT current_period_end FROM subscriptions
     WHERE user_id = $1 AND sku = 'astrologer-consultation'
       AND status = 'active' AND current_period_end > NOW()`,
    [userId]
  );
  if (active.rowCount === 0) {
    throw Object.assign(
      new Error("An active consultation booking is required first."),
      { status: 403, code: "no_consultation" }
    );
  }
  const dur = Math.min(Math.max(Number(durationMinutes) || 45, 15), 120);
  const res = await query(
    `INSERT INTO video_dates (requester_id, other_profile_id, scheduled_for, duration_minutes, kind)
     VALUES ($1, NULL, $2, $3, 'consultation') RETURNING id`,
    [userId, when.toISOString(), dur]
  );
  return { id: res.rows[0].id };
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
  const res = await query(
    `UPDATE profiles SET profile_visibility = $2, updated_at = NOW()
     WHERE is_sample AND ($2 = 'hidden' OR profile_visibility = 'hidden')
     RETURNING id`,
    [adminId, hidden ? "hidden" : "public"]
  );
  await writeAudit(adminId, hidden ? "samples.hide_all" : "samples.unhide_all", "*", `${res.rowCount} rows`);
  return { affected: res.rowCount };
}