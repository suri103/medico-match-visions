// Typed client for the wired (DB-backed) product APIs. Every call degrades to
// `null` on failure so callers can fall back to demo behaviour when the
// backend has no database (dev) or is unreachable (offline).
//
// SECURITY: contact data (phone/email) is NEVER present in list/detail
// responses — the server strips it. It is only ever obtained through
// revealContact(), which is metered by the server-side quota.

import { getApiBaseUrl } from "@/services/checkout";
import type { Doctor } from "@/features/matches/types";
import { localAvatar } from "@/lib/avatar";

export interface ServerProfile {
  id: string;
  userId: string | null;
  isSample: boolean;
  name: string;
  gender?: string | null;
  age?: number | null;
  heightCm?: number | null;
  maritalStatus?: string | null;
  degree?: string | null;
  specialty?: string | null;
  hospital?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  aboutMe?: string | null;
  lookingFor?: string | null;
  interests: string[];
  imageUrl?: string | null;
  sexualOrientation?: string | null;
  ethnicity?: string | null;
  religion?: string | null;
  caste?: string | null;
  subcaste?: string | null;
  gotra?: string | null;
  motherTongue?: string | null;
  rashi?: string | null;
  nakshatra?: string | null;
  manglik?: string | null;
  kundaliGunas?: number | null;
  prefAgeMin?: number | null;
  prefAgeMax?: number | null;
  prefLocation?: string | null;
  isVerified: boolean;
  isOnline: boolean;
  // P-CONTROL: member-set privacy. incomeBand is nulled server-side unless the
  // viewer may see it (owner, public, or verified-only + verified viewer).
  profileVisibility?: string | null;
  incomeVisibility?: string | null;
  // Birth details (matrimony kundali fidelity + shareable chart).
  birthDate?: string | null;
  birthTime?: string | null;
  birthCity?: string | null;
  chartImageUrl?: string | null;
  // P0-4 family/background depth.
  familyType?: string | null;
  familyStatus?: string | null;
  incomeBand?: string | null;
  diet?: string | null;
  smoking?: string | null;
  drinking?: string | null;
  disability?: string | null;
  expectations?: string | null;
}

export interface QuotaSummary {
  plan: string;
  videoDates: { used: number; limit: number; left: number | null };
  interests: { used: number; limit: number; left: number | null };
  contactViews: { used: number; limit: number; left: number | null };
  period: string;
  /** Subscription lifecycle (DB mode): ISO expiry of the paid window. */
  planExpiresAt?: string | null;
  canceling?: boolean;
  subscriptionStatus?: string | null;
}

export interface InterestRecord {
  id: string;
  status: string;
  note: string;
  createdAt: string;
  profile: {
    id: string; name: string; imageUrl?: string | null;
    specialty?: string | null; city?: string | null; age?: number | null;
  };
}

const base = () => getApiBaseUrl();

// Audit M-12 / item 1: every wired API call must include credentials so the
// httpOnly session cookie is attached, and must echo the CSRF token on every
// mutating request (the server rejects 403 without it).
const credentials = "include";

// CSRF token: shared cache in src/lib/csrf.ts. On a split-origin deploy the
// SPA cannot read the API domain's mm_csrf cookie via document.cookie, so the
// cache (populated from the login/verify JSON body and GET /api/csrf) is the
// only reliable source. The cookie fallback covers same-origin dev.
import { getCsrfToken as sharedGetCsrfToken } from "@/lib/csrf";

function csrfHeader(): Record<string, string> {
  const t = sharedGetCsrfToken();
  return t ? { "X-CSRF-Token": t } : {};
}

function authHeaders(): Record<string, string> {
  try {
    const raw = localStorage.getItem("mm:authSession");
    const session = raw ? JSON.parse(raw) : null;
    const bearer: Record<string, string> = session?.token
      ? { Authorization: `Bearer ${session.token}` }
      : {};
    return {
      ...bearer,
      "Content-Type": "application/json",
      ...csrfHeader(),
    };
  } catch {
    return { "Content-Type": "application/json", ...csrfHeader() };
  }
}

/** True when a real server session exists AND an API base URL is configured.
 * Audit M-12 / item 1: also true when the httpOnly session cookie is present
 * even if the legacy `mm:authSession` Bearer token isn't (e.g. fresh login
 * where the SPA picked up the cookie but the local persisted state is still
 * hydrating).
 * SPLIT-ORIGIN ADDITION: on a Vercel-SPA + Railway-API deploy the cookies live
 * on the API's domain and are invisible to document.cookie on the SPA origin,
 * so the cookie probes below always miss. A session that the SERVER just
 * issued (login / verify-email mint it and signIn() persists it) is therefore
 * also trusted here, within its 7-day TTL. This only gates which UI the SPA
 * renders — the server remains the authority and 401s genuinely dead
 * sessions, at which point signOut()/session-clear runs. */
export function hasServerSession(): boolean {
  if (!base()) return false;
  const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
  try {
    const raw = localStorage.getItem("mm:authSession");
    const session = raw ? JSON.parse(raw) : null;
    if (session?.token) return true;
    // Cookie-first sessions (token absent) — trust a recently-issued one.
    if (session?.user && session?.signedInAt) {
      const age = Date.now() - Date.parse(session.signedInAt);
      if (Number.isFinite(age) && age >= 0 && age < SESSION_TTL_MS) return true;
    }
  } catch {
    /* fall through to cookie check */
  }
  return Boolean(sharedGetCsrfToken() || (typeof document !== "undefined" && /mm_session=/.test(document.cookie || "")));
}

async function call<T>(path: string, init?: RequestInit): Promise<T | null> {
  if (!base()) return null;
  try {
    const res = await fetch(`${base()}${path}`, {
      ...init,
      credentials,
      headers: { ...authHeaders(), ...(init?.headers as Record<string, string> | undefined) },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Like call() but surfaces the server's error message for quota/409 UX. */
async function callOrError<T>(
  path: string,
  init?: RequestInit
): Promise<{ data: T | null; error: string | null; status: number }> {
  if (!base()) return { data: null, error: "no-server", status: 0 };
  try {
    const res = await fetch(`${base()}${path}`, {
      ...init,
      credentials,
      headers: { ...authHeaders(), ...(init?.headers as Record<string, string> | undefined) },
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const message =
        typeof body?.error === "string" ? body.error : `Request failed (${res.status})`;
      return { data: null, error: message, status: res.status };
    }
    return { data: body as T, error: null, status: res.status };
  } catch {
    return { data: null, error: "network", status: 0 };
  }
}

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

export async function browseProfiles(
  params: {
    city?: string; specialty?: string; q?: string;
    minAge?: number; maxAge?: number; verifiedOnly?: boolean; limit?: number; offset?: number;
    religion?: string; caste?: string; motherTongue?: string; gotra?: string;
    orientation?: string; ethnicity?: string; minGunas?: number;
    familyType?: string; familyStatus?: string; incomeBand?: string; diet?: string;
  } = {}
): Promise<ServerProfile[] | null> {
  const qs = new URLSearchParams();
  if (params.city) qs.set("city", params.city);
  if (params.specialty) qs.set("specialty", params.specialty);
  if (params.q) qs.set("q", params.q);
  if (params.minAge) qs.set("min", String(params.minAge));
  if (params.maxAge) qs.set("max", String(params.maxAge));
  if (params.verifiedOnly) qs.set("verified", "1");
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.offset) qs.set("offset", String(params.offset));
  // H1: forward Shaadi-style advanced filters to SQL (backend /api/profiles
  // now honors them). Client-side applyFilters remains as the second pass for
  // multi-select/derived rules the SQL layer does not model.
  if (params.religion) qs.set("religion", params.religion);
  if (params.caste) qs.set("caste", params.caste);
  if (params.motherTongue) qs.set("motherTongue", params.motherTongue);
  if (params.gotra) qs.set("gotra", params.gotra);
  if (params.orientation) qs.set("orientation", params.orientation);
  if (params.ethnicity) qs.set("ethnicity", params.ethnicity);
  if (params.minGunas) qs.set("minGunas", String(params.minGunas));
  // P0-4 family depth filters.
  if (params.familyType) qs.set("familyType", params.familyType);
  if (params.familyStatus) qs.set("familyStatus", params.familyStatus);
  if (params.incomeBand) qs.set("incomeBand", params.incomeBand);
  if (params.diet) qs.set("diet", params.diet);
  const out = await call<{ profiles: ServerProfile[] }>(`/api/profiles?${qs.toString()}`);
  return out?.profiles ?? null;
}

export async function getMyServerProfile(): Promise<ServerProfile | null> {
  const out = await call<{ profile: ServerProfile | null }>("/api/me/profile");
  return out?.profile ?? null;
}

export async function saveMyServerProfile(
  patch: Record<string, unknown>
): Promise<ServerProfile | null> {
  const out = await call<{ profile: ServerProfile }>("/api/me/profile", {
    method: "PUT",
    body: JSON.stringify(patch),
  });
  return out?.profile ?? null;
}

export async function fetchProfile(id: string): Promise<ServerProfile | null> {
  const out = await call<{ profile: ServerProfile }>(`/api/profiles/${encodeURIComponent(id)}`);
  return out?.profile ?? null;
}

export function serverProfileToDoctor(p: ServerProfile): Doctor {
  // Never fabricate credentials: missing degree/specialty must render empty,
  // not MBBS/Physician (a null degree must never appear credentialed).
  return {
    id: p.id,
    name: p.name.replace(/^Dr\.\s*/i, ""),
    age: p.age ?? 30,
    specialty: p.specialty || "",
    degree: p.degree || "",
    hospital: p.hospital || "",
    city: p.city || "",
    state: p.state || "",
    country: p.country || "India",
    imageUrl: p.imageUrl || localAvatar(p.name),
    matchPercentage: p.kundaliGunas ?? 0,
    interests: p.interests || [],
    isOnline: p.isOnline,
    sexualOrientation: p.sexualOrientation || undefined,
    ethnicity: p.ethnicity || undefined,
    religion: p.religion || undefined,
    caste: p.caste || undefined,
    cast: p.caste || undefined,
    subcaste: p.subcaste || undefined,
    gotra: p.gotra || undefined,
    motherTongue: p.motherTongue || undefined,
    rashi: p.rashi || undefined,
    nakshatra: p.nakshatra || undefined,
    manglik: p.manglik || undefined,
    kundaliGunas: p.kundaliGunas ?? undefined,
    isVerified: p.isVerified,
    familyType: (p as unknown as Record<string, string>).familyType,
    familyStatus: (p as unknown as Record<string, string>).familyStatus,
    incomeBand: (p as unknown as Record<string, string>).incomeBand,
    diet: (p as unknown as Record<string, string>).diet,
  } as Doctor;
}

export async function getQuota(): Promise<QuotaSummary | null> {
  const out = await call<QuotaSummary>("/api/quota");
  return out ?? null;
}

/**
 * M-2 recovery: when an activation token cannot be redeemed, the purchase is
 * usually ALREADY granted server-side (verify/webhook recordCapturedPayment).
 * Refreshing mm:activePlan from the authoritative quota answer gives the user
 * their plan back without support involvement.
 */
export function planNameFromQuotaSku(sku: string | null | undefined): string | null {
  if (!sku) return null;
  if (sku.startsWith("platinum")) return "platinum";
  if (sku.startsWith("premium")) return "premium";
  return null;
}

export async function refreshLocalPlanFromServer(): Promise<string | null> {
  const q = await getQuota();
  if (!q) return null;
  const plan = planNameFromQuotaSku(q.plan);
  if (!plan) return null;
  try {
    localStorage.setItem(
      "mm:activePlan",
      JSON.stringify({ name: plan, activatedAt: new Date().toISOString() })
    );
    window.dispatchEvent(
      new CustomEvent("mm:persisted-state-changed", { detail: { key: "mm:activePlan" } })
    );
  } catch { /* storage unavailable */ }
  return plan;
}

// ---------------------------------------------------------------------------
// Interests
// ---------------------------------------------------------------------------

export async function listInterests(): Promise<{
  sent: InterestRecord[]; received: InterestRecord[]; matched: InterestRecord[];
} | null> {
  return call("/api/interests");
}

export async function sendInterest(
  profileId: string,
  note = ""
): Promise<{ ok: boolean; error: string | null; alreadyInterested?: boolean }> {
  const out = await callOrError<{ alreadyInterested?: boolean }>("/api/interests", {
    method: "POST",
    body: JSON.stringify({ profileId, note }),
  });
  if (out.error) return { ok: false, error: out.error };
  return { ok: true, error: null, alreadyInterested: out.data?.alreadyInterested };
}

export async function respondInterest(interestId: string, action: "accept" | "decline"): Promise<boolean> {
  const out = await callOrError(`/api/interests/${encodeURIComponent(interestId)}/respond`, {
    method: "POST",
    body: JSON.stringify({ action }),
  });
  return out.error === null;
}

export async function withdrawInterest(interestId: string): Promise<boolean> {
  const out = await callOrError(`/api/interests/${encodeURIComponent(interestId)}`, { method: "DELETE" });
  return out.error === null;
}

// ---------------------------------------------------------------------------
// Blocks / reports
// ---------------------------------------------------------------------------

export async function listFavoriteIds(): Promise<string[] | null> {
  const out = await call<{ favorites: string[] }>("/api/favorites");
  return out?.favorites ?? null;
}

export async function addFavoriteRemote(profileId: string): Promise<boolean> {
  const out = await callOrError("/api/favorites", {
    method: "POST",
    body: JSON.stringify({ profileId }),
  });
  return out.error === null;
}

export async function removeFavoriteRemote(profileId: string): Promise<boolean> {
  const out = await callOrError(`/api/favorites/${encodeURIComponent(profileId)}`, {
    method: "DELETE",
  });
  return out.error === null;
}

export async function listShortlistIds(): Promise<string[] | null> {
  const out = await call<{ shortlists: string[] }>("/api/shortlists");
  return out?.shortlists ?? null;
}

export async function addShortlistRemote(profileId: string): Promise<boolean> {
  const out = await callOrError("/api/shortlists", {
    method: "POST",
    body: JSON.stringify({ profileId }),
  });
  return out.error === null;
}

export async function removeShortlistRemote(profileId: string): Promise<boolean> {
  const out = await callOrError(`/api/shortlists/${encodeURIComponent(profileId)}`, {
    method: "DELETE",
  });
  return out.error === null;
}
export async function listBlockedUsers(): Promise<{ id: string; name: string; imageUrl?: string | null }[] | null> {
  const out = await call<{ blocked: { id: string; name: string; imageUrl?: string | null }[] }>("/api/blocks");
  return out?.blocked ?? null;
}

export async function blockUser(userId: string): Promise<boolean> {
  const out = await callOrError("/api/blocks", { method: "POST", body: JSON.stringify({ userId }) });
  return out.error === null;
}

export async function unblockUser(userId: string): Promise<boolean> {
  const out = await callOrError("/api/blocks/unblock", { method: "POST", body: JSON.stringify({ userId }) });
  return out.error === null;
}

export async function reportProfile(profileId: string, reason: string, details = ""): Promise<boolean> {
  const out = await callOrError("/api/reports", {
    method: "POST",
    body: JSON.stringify({ profileId, reason, details }),
  });
  return out.error === null;
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

export interface ServerChannel {
  channelId: string;
  /** Auth user id of the peer — required for WebRTC signaling. */
  peerUserId: string;
  profile: { id: string; name: string; imageUrl?: string | null };
  lastMessage: string | null;
  lastAt: string | null;
}

export interface ServerMessage {
  id: string;
  senderId: string;
  mine: boolean;
  body: string;
  createdAt: string;
}

export async function listChannels(): Promise<ServerChannel[] | null> {
  const out = await call<{ channels: ServerChannel[] }>("/api/channels");
  return out?.channels ?? null;
}

export async function listMessages(channelId: string, limit?: number): Promise<ServerMessage[] | null> {
  const qs = limit ? `?limit=${encodeURIComponent(String(limit))}` : "";
  const out = await call<{ messages: ServerMessage[] }>(`/api/channels/${encodeURIComponent(channelId)}/messages${qs}`);
  return out?.messages ?? null;
}

export async function sendChatMessage(channelId: string, body: string): Promise<boolean> {
  const out = await callOrError(`/api/channels/${encodeURIComponent(channelId)}/messages`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
  return out.error === null;
}

// ---------------------------------------------------------------------------
// Video dates
// ---------------------------------------------------------------------------

export interface ServerVideoDate {
  id: string;
  scheduledFor: string;
  durationMinutes: number;
  status: string;
  profile: { id: string; name: string; imageUrl?: string | null };
}

export async function listVideoDates(): Promise<ServerVideoDate[] | null> {
  const out = await call<{ videoDates: ServerVideoDate[] }>("/api/video-dates");
  return out?.videoDates ?? null;
}

export async function createVideoDate(
  profileId: string,
  scheduledFor: string,
  durationMinutes = 30
): Promise<{ ok: boolean; error: string | null }> {
  const out = await callOrError("/api/video-dates", {
    method: "POST",
    body: JSON.stringify({ profileId, scheduledFor, durationMinutes }),
  });
  return { ok: out.error === null, error: out.error };
}

export async function cancelVideoDate(videoDateId: string): Promise<boolean> {
  const out = await callOrError(`/api/video-dates/${encodeURIComponent(videoDateId)}/cancel`, { method: "POST" });
  return out.error === null;
}

export async function respondVideoDate(
  videoDateId: string,
  action: "accept" | "decline"
): Promise<{ ok: boolean; error: string | null }> {
  const out = await callOrError(`/api/video-dates/${encodeURIComponent(videoDateId)}/respond`, {
    method: "POST",
    body: JSON.stringify({ action }),
  });
  return { ok: out.error === null, error: out.error };
}

// ---------------------------------------------------------------------------
// Contact reveal — the ONLY source of phone/email, metered server-side.
// ---------------------------------------------------------------------------

export interface ContactRevealResult {
  ok: boolean;
  phone: string;
  email: string;
  shared?: boolean;
  quotaLeft?: number | null;
  error: string | null;
}

export async function revealContact(profileId: string): Promise<ContactRevealResult> {
  const out = await callOrError<{
    phone: string; email: string; shared?: boolean; quota?: QuotaSummary;
  }>("/api/contact-reveal", { method: "POST", body: JSON.stringify({ profileId }) });
  if (out.error || !out.data) {
    return { ok: false, phone: "", email: "", error: out.error };
  }
  return {
    ok: true,
    phone: out.data.phone,
    email: out.data.email,
    shared: out.data.shared,
    quotaLeft: out.data.quota ? out.data.quota.contactViews.left : null,
    error: null,
  };
}

// ---------------------------------------------------------------------------
// Admin / moderation console
// ---------------------------------------------------------------------------

export interface AdminReport {
  id: string;
  reporterId: string;
  reportedProfileUserId: string;
  reportedName: string | null;
  reportedPhoto: string | null;
  reason: string;
  details: string;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
  resolutionNote: string;
}

export interface AdminUserRow {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  verified: boolean;
  isAdmin: boolean;
  isRoot?: boolean;
  createdAt: string;
  plan: string;
  profileName: string | null;
  suspended?: boolean;
}

export interface AdminPaymentRow {
  paymentId: string;
  orderId: string | null;
  userId: string | null;
  userEmail: string | null;
  sku: string | null;
  amountRupees: number | null;
  status: string;
  source: string;
  createdAt: string;
  refunded: boolean;
}

export interface AdminProfileRow {
  id: string;
  name: string;
  specialty: string | null;
  city: string | null;
  state: string | null;
  isVerified: boolean;
  visibility: string;
  phone: string | null;
  email: string | null;
  isSample: boolean;
  updatedAt: string;
}

export async function adminMe(): Promise<{ admin: boolean; email?: string } | null> {
  if (!hasServerSession()) return null;
  return call<{ admin: boolean; email?: string }>("/api/admin/me");
}

export async function listAdminReports(status: "open" | "resolved" | "dismissed" | "all" = "open"): Promise<AdminReport[] | null> {
  const out = await call<{ reports: AdminReport[] }>(`/api/admin/reports?status=${encodeURIComponent(status)}`);
  return out?.reports ?? null;
}

export async function resolveAdminReport(
  id: string,
  outcome: "resolved" | "dismissed",
  note = ""
): Promise<{ ok: boolean; error: string | null }> {
  const out = await callOrError(`/api/admin/reports/${encodeURIComponent(id)}/resolve`, {
    method: "POST",
    body: JSON.stringify({ outcome, note }),
  });
  return { ok: out.error === null, error: out.error };
}

export async function listAdminUsers(q = ""): Promise<AdminUserRow[] | null> {
  const out = await call<{ users: AdminUserRow[] }>(`/api/admin/users?q=${encodeURIComponent(q)}`);
  return out?.users ?? null;
}

export async function setUserSuspended(id: string, suspended: boolean, reason = ""): Promise<{ ok: boolean; error: string | null }> {
  const out = await callOrError(`/api/admin/users/${encodeURIComponent(id)}/${suspended ? "suspend" : "unsuspend"}`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
  return { ok: out.error === null, error: out.error };
}

export async function listAdminProfiles(q = ""): Promise<AdminProfileRow[] | null> {
  const out = await call<{ profiles: AdminProfileRow[] }>(`/api/admin/profiles?q=${encodeURIComponent(q)}`);
  return out?.profiles ?? null;
}

export async function patchAdminProfile(
  id: string,
  patch: { is_verified?: boolean; profile_visibility?: string }
): Promise<{ ok: boolean; error: string | null }> {
  const out = await callOrError(`/api/admin/profiles/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return { ok: out.error === null, error: out.error };
}

export async function listAdminPayments(): Promise<AdminPaymentRow[] | null> {
  const out = await call<{ payments: AdminPaymentRow[] }>("/api/admin/payments");
  return out?.payments ?? null;
}

export async function adminRefund(
  paymentId: string,
  amountPaise?: number,
  reason = ""
): Promise<{ ok: boolean; error: string | null }> {
  const out = await callOrError("/api/admin/refunds", {
    method: "POST",
    body: JSON.stringify({ paymentId, amountPaise, reason }),
  });
  return { ok: out.error === null, error: out.error };
}

// Root-tier role management (root admins only; audited server-side).
export async function promoteAdmin(id: string): Promise<{ ok: boolean; error: string | null }> {
  const out = await callOrError(`/api/admin/users/${encodeURIComponent(id)}/promote-admin`, { method: "POST" });
  return { ok: out.error === null, error: out.error };
}

export async function demoteAdmin(id: string): Promise<{ ok: boolean; error: string | null }> {
  const out = await callOrError(`/api/admin/users/${encodeURIComponent(id)}/demote-admin`, { method: "POST" });
  return { ok: out.error === null, error: out.error };
}

export async function listAuditLog(): Promise<{ id: string; adminEmail: string; action: string; target: string; details: string; createdAt: string }[] | null> {
  const out = await call<{ audit: { id: string; adminEmail: string; action: string; target: string; details: string; createdAt: string }[] }>("/api/admin/audit");
  return out?.audit ?? null;
}

// Launch-gap fix #3: admin dashboard counts (single round-trip).
export interface AdminStats {
  total_users: number;
  new_users_30d: number;
  verified_doctors: number;
  pending_verifications: number;
  active_memberships: number;
  open_reports: number;
  interests_sent: number;
  failed_payments: number;
  refunds: number;
}

export async function adminStats(): Promise<AdminStats | null> {
  const out = await call<{ stats: AdminStats }>("/api/admin/stats");
  return out?.stats ?? null;
}

// Launch-gap fix #5: member-facing refund request (advisory ticket; approval
// stays with the admin refund path + webhook revocation).
export async function requestRefund(reason: string): Promise<{ ok: boolean; message?: string | null; error: string | null }> {
  const out = await callOrError<{ ok?: boolean; message?: string }>("/api/refund-request", {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
  return { ok: out.error === null, message: out.data?.message ?? null, error: out.error };
}

export async function setSamplesHidden(hidden: boolean): Promise<{ ok: boolean; affected?: number; error: string | null }> {
  const out = await callOrError<{ affected: number }>("/api/admin/samples/hide-all", {
    method: "POST",
    body: JSON.stringify({ hidden }),
  });
  return { ok: out.error === null, affected: out.data?.affected, error: out.error };
}

// P0-2/P0-8 admin trust queue + warn ladder.
export interface VerificationDocRow { id: string; userId: string; userEmail: string; docType: string; url: string; status: string; createdAt: string }

export async function listVerifications(status = "pending"): Promise<VerificationDocRow[] | null> {
  const out = await call<{ documents: VerificationDocRow[] }>(`/api/admin/verifications?status=${encodeURIComponent(status)}`);
  return out?.documents ?? null;
}

export async function reviewVerification(
  id: string,
  outcome: "approved" | "rejected",
  note = "",
  registryChecked = false,
  registryReference = ""
): Promise<{ ok: boolean; error: string | null }> {
  const out = await callOrError(`/api/admin/verifications/${encodeURIComponent(id)}/review`, {
    method: "POST", body: JSON.stringify({ outcome, note, registryChecked, registryReference }),
  });
  return { ok: out.error === null, error: out.error };
}

export async function warnAdminUser(id: string, reason = ""): Promise<{ ok: boolean; strikes?: number; autoSuspend?: boolean; error: string | null }> {
  const out = await callOrError<{ strikes: number; autoSuspend: boolean }>(`/api/admin/users/${encodeURIComponent(id)}/warn`, {
    method: "POST", body: JSON.stringify({ reason }),
  });
  return { ok: out.error === null, strikes: out.data?.strikes, autoSuspend: out.data?.autoSuspend, error: out.error };
}

export async function createServerEvent(payload: { title: string; date: string; time: string; location: string; description: string }): Promise<{ ok: boolean; error: string | null }> {
  const out = await callOrError("/api/events", { method: "POST", body: JSON.stringify(payload) });
  return { ok: out.error === null, error: out.error };
}

export async function approveStory(id: string, approved: boolean): Promise<{ ok: boolean; error: string | null }> {
  const out = await callOrError(`/api/admin/stories/${encodeURIComponent(id)}/approve`, { method: "POST", body: JSON.stringify({ approved }) });
  return { ok: out.error === null, error: out.error };
}

export async function triggerRenewalReminders(): Promise<{ sent: number; total: number } | null> {
  const out = await call<{ sent: number; total: number }>("/api/admin/reminders/renewals", { method: "POST" });
  return out ?? null;
}

// ---------------------------------------------------------------------------
// Support inbox (M6): real server delivery with local fallback.
// ---------------------------------------------------------------------------

export async function sendSupportMessage(payload: {
  name: string; email: string; subject: string; message: string;
}): Promise<{ ok: boolean; error: string | null }> {
  const out = await callOrError<{ ok: boolean }>("/api/support", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  // No server configured (dev/offline): caller falls back to local save.
  if (out.status === 0 && out.error === "no-server") return { ok: false, error: "no-server" };
  return { ok: out.error === null, error: out.error };
}

// ---------------------------------------------------------------------------
// Parity increment: trust, engagement, monetization client.
// ---------------------------------------------------------------------------

export async function requestPhoneOtp(phone: string): Promise<{ ok: boolean; error: string | null; code?: string }> {
  const out = await callOrError<{ expiresAt: string; code?: string }>("/api/phone/request", {
    method: "POST", body: JSON.stringify({ phone }),
  });
  if (out.error) return { ok: false, error: out.error };
  return { ok: true, error: null, code: out.data?.code };
}

export async function verifyPhoneOtp(code: string): Promise<{ ok: boolean; error: string | null }> {
  const out = await callOrError("/api/phone/verify", { method: "POST", body: JSON.stringify({ code }) });
  return { ok: out.error === null, error: out.error };
}

export async function phoneStatus(): Promise<{ phone: string | null; verified: boolean } | null> {
  return call("/api/phone/status");
}

export async function submitVerificationDoc(docType: string, url: string): Promise<{ ok: boolean; error: string | null }> {
  const out = await callOrError("/api/verification/documents", { method: "POST", body: JSON.stringify({ docType, url }) });
  return { ok: out.error === null, error: out.error };
}

export async function myVerificationDocs(): Promise<{ id: string; docType: string; status: string; note: string; createdAt: string }[] | null> {
  const out = await call<{ documents: { id: string; docType: string; status: string; note: string; createdAt: string }[] }>("/api/verification/me");
  return out?.documents ?? null;
}

export async function dailyMatches(limit = 10): Promise<ServerProfile[] | null> {
  const out = await call<{ matches: ServerProfile[] }>(`/api/matches/daily?limit=${encodeURIComponent(String(limit))}`);
  return out?.matches ?? null;
}

export interface ServerEvent { id: string; title: string; date: string; time: string; location: string; description: string; createdAt: string }

export async function listServerEvents(): Promise<ServerEvent[] | null> {
  if (!getApiBaseUrl()) return null;
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/events`, { credentials });
    if (!res.ok) return null;
    const body = await res.json();
    return body?.events ?? null;
  } catch { return null; }
}

export async function rsvpEvent(eventId: string): Promise<boolean> {
  const out = await callOrError(`/api/events/${encodeURIComponent(eventId)}/rsvp`, { method: "POST" });
  return out.error === null;
}

export interface ServerStory { id: string; partnerName: string; story: string; photoUrl: string; createdAt: string }

export async function listServerStories(): Promise<ServerStory[] | null> {
  if (!getApiBaseUrl()) return null;
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/stories`, { credentials });
    if (!res.ok) return null;
    const body = await res.json();
    return body?.stories ?? null;
  } catch { return null; }
}

export async function submitStory(payload: { partnerName: string; story: string; photoUrl?: string }): Promise<{ ok: boolean; error: string | null }> {
  const out = await callOrError("/api/stories", { method: "POST", body: JSON.stringify(payload) });
  return { ok: out.error === null, error: out.error };
}

export async function getBoost(): Promise<{ active: boolean; expiresAt: string | null } | null> {
  return call("/api/boost");
}

export async function activateBoost(): Promise<{ ok: boolean; error: string | null }> {
  const out = await callOrError("/api/boost", { method: "POST" });
  return { ok: out.error === null, error: out.error };
}

export async function validateCoupon(code: string): Promise<{ code: string; percentOff: number } | null> {
  const out = await call<{ code: string; percentOff: number }>(`/api/coupons/validate?code=${encodeURIComponent(code)}`);
  return out ?? null;
}

export async function markMessagesRead(channelId: string): Promise<boolean> {
  const out = await callOrError(`/api/channels/${encodeURIComponent(channelId)}/read`, { method: "POST" });
  return out.error === null;
}

// ---------------------------------------------------------------------------
// Notification center
// ---------------------------------------------------------------------------

export interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}

export async function listNotifications(unreadOnly = false): Promise<{ notifications: NotificationRow[]; unreadCount: number } | null> {
  return call(`/api/notifications${unreadOnly ? "?unread=1" : ""}`);
}

export async function markNotificationRead(id: string): Promise<boolean> {
  const out = await callOrError(`/api/notifications/${encodeURIComponent(id)}/read`, { method: "POST" });
  return out.error === null;
}

export async function markAllNotificationsRead(): Promise<boolean> {
  const out = await callOrError("/api/notifications/read-all", { method: "POST" });
  return out.error === null;
}

// ---------------------------------------------------------------------------
// Profile photo
// ---------------------------------------------------------------------------

export async function uploadMyPhoto(dataUrl: string): Promise<{ ok: boolean; url?: string; error: string | null }> {
  const out = await callOrError<{ url: string }>("/api/me/photo", {
    method: "POST",
    body: JSON.stringify({ dataUrl }),
  });
  if (out.error) return { ok: false, error: out.error };
  return { ok: true, url: out.data?.url, error: null };
}

// ---------------------------------------------------------------------------
// Consultations
// ---------------------------------------------------------------------------

export async function hasActiveConsultation(): Promise<{ active: boolean; expiresAt: string | null } | null> {
  return call("/api/consultations/active");
}

export async function createConsultation(scheduledFor: string, durationMinutes = 45): Promise<{ ok: boolean; error: string | null }> {
  const out = await callOrError("/api/consultations", {
    method: "POST",
    body: JSON.stringify({ scheduledFor, durationMinutes }),
  });
  return { ok: out.error === null, error: out.error };
}

// ---------------------------------------------------------------------------
// Account deletion + data export (item 6 — DPDP Act 2023 rights).
// ---------------------------------------------------------------------------

export interface DataExportResponse {
  exportedAt: string;
  requester: { id: string };
  appUser: Record<string, unknown> | null;
  profile: unknown[];
  interestsSent: unknown[];
  interestsReceived: unknown[];
  interestsMatched: unknown[];
  channels: unknown[];
  messages: unknown[];
  videoDates: unknown[];
  subscriptions: unknown[];
  paymentTransactions: unknown[];
  refunds: unknown[];
  notifications: unknown[];
  reports: unknown[];
  blocks: unknown[];
  favorites: unknown[];
  shortlists: unknown[];
  photos: unknown[];
}

export async function exportMyData(): Promise<DataExportResponse | null> {
  const out = await call<DataExportResponse>("/api/me/export");
  return out ?? null;
}

export async function deleteMyAccount(currentPassword: string): Promise<{ ok: boolean; error: string | null; tombstoneEmail?: string }> {
  const out = await callOrError<{ tombstoneEmail: string }>("/api/me/delete", {
    method: "POST",
    body: JSON.stringify({ currentPassword }),
  });
  return { ok: out.error === null, error: out.error, tombstoneEmail: out.data?.tombstoneEmail };
}

export async function sendWebRtcSignal(
  toUserId: string,
  payload: Record<string, unknown>
): Promise<boolean> {
  const out = await callOrError("/api/webrtc/signal", {
    method: "POST",
    body: JSON.stringify({ toUserId, payload }),
  });
  return out.error === null;
}

// ---------------------------------------------------------------------------
// Billing lifecycle (self-service cancel at period end / resume)
// ---------------------------------------------------------------------------

export interface BillingState {
  status: string;
  planExpiresAt: string | null;
}

export async function cancelBilling(): Promise<{ ok: boolean; error: string | null; planExpiresAt?: string | null }> {
  const out = await callOrError<{ status: string; planExpiresAt: string | null }>("/api/billing/cancel", { method: "POST" });
  if (out.error) return { ok: false, error: out.error };
  return { ok: true, error: null, planExpiresAt: out.data?.planExpiresAt ?? null };
}

export async function resumeBilling(): Promise<{ ok: boolean; error: string | null; planExpiresAt?: string | null }> {
  const out = await callOrError<{ status: string; planExpiresAt: string | null }>("/api/billing/resume", { method: "POST" });
  if (out.error) return { ok: false, error: out.error };
  return { ok: true, error: null, planExpiresAt: out.data?.planExpiresAt ?? null };
}

// ---------------------------------------------------------------------------
// Photo gallery, "who viewed me", and typing indicator (matrimony parity).
// ---------------------------------------------------------------------------

export interface GalleryPhoto {
  id: string;
  url: string;
  isPrimary: boolean;
  displayOrder: number;
  createdAt: string;
}

export async function listMyPhotos(): Promise<GalleryPhoto[]> {
  const out = await call<{ photos: GalleryPhoto[] }>("/api/me/photos");
  return out?.photos ?? [];
}

/** Make an existing gallery photo the primary (also updates the profile card). */
export async function setPrimaryPhoto(photoId: string): Promise<{ ok: boolean; error: string | null }> {
  const out = await callOrError(`/api/me/photos/${encodeURIComponent(photoId)}/primary`, { method: "POST" });
  return { ok: out.error === null, error: out.error };
}

export async function deletePhoto(photoId: string): Promise<{ ok: boolean; error: string | null }> {
  const out = await callOrError(`/api/me/photos/${encodeURIComponent(photoId)}`, { method: "DELETE" });
  return { ok: out.error === null, error: out.error };
}

export interface ProfileViewRow {
  viewerUserId: string;
  name: string;
  imageUrl?: string | null;
  isVerified: boolean;
  city?: string | null;
  specialty?: string | null;
  lastViewedAt: string;
  totalViews: number;
}

/** "Who viewed my profile" — the owner's distinct-viewer feed. */
export async function listProfileViewers(limit = 50): Promise<ProfileViewRow[]> {
  const out = await call<{ views: ProfileViewRow[] }>(`/api/me/profile-views?limit=${encodeURIComponent(String(limit))}`);
  return out?.views ?? [];
}

/** Ephemeral typing signal for an open channel (SSE-relayed, never stored). */
export async function sendTyping(channelId: string): Promise<boolean> {
  const out = await callOrError(`/api/channels/${encodeURIComponent(channelId)}/typing`, { method: "POST" });
  return out.error === null;
}

// ---------------------------------------------------------------------------
// Kundali match report (paid digital product; REPORTS_ENABLED server-side).
// ---------------------------------------------------------------------------

export interface KootaRow {
  id: string;
  name: string;
  max: number;
  obtainedPoints: number;
  description: string;
  status: string;
}

export interface KundaliReport {
  totalPoints: number;
  maxPoints: number;
  isAuspicious: boolean;
  grade: string;
  manglikCompatibility: string;
  nadiDosha: boolean;
  bhakootDosha: boolean;
  kootas: KootaRow[];
  summary: string;
  partnerA: { name: string };
  partnerB: { name: string; profileId: string };
  generatedAt: string;
  disclaimer: string;
}

export type KundaliReportResult =
  | { ok: true; report: KundaliReport; alreadyOwned: boolean }
  | { ok: false; error: string; purchaseRequired: boolean };

/** Fetch (or first-generate) the detailed report for a profile pair. 402 means
 *  the buyer must purchase the `kundali-report` SKU first. */
export async function getKundaliReport(profileId: string): Promise<KundaliReportResult> {
  const out = await callOrError<{ report: KundaliReport; alreadyOwned: boolean }>(`/api/kundali/report/${encodeURIComponent(profileId)}`);
  if (out.error) {
    return { ok: false, error: out.error, purchaseRequired: out.status === 402 };
  }
  return { ok: true, report: out.data!.report, alreadyOwned: Boolean(out.data!.alreadyOwned) };
}

// ---------------------------------------------------------------------------
// Realtime event stream (SSE) — professional push with one-time tickets,
// auto-reconnect + backoff, and graceful degradation for callers.
// ---------------------------------------------------------------------------

export interface ChatPushPayload {
  channelId: string;
  message: { id: string; senderId: string; body: string; createdAt: string };
}

export interface EventStreamHandlers {
  onMessage?: (payload: ChatPushPayload) => void;
  onInterestReceived?: (payload: { fromProfile?: { id: string; name: string } | null }) => void;
  onInterestResponded?: (payload: { interestId: string; status: string }) => void;
  /** WebRTC signaling relay (offers/answers/ICE candidates). */
  onWebRtc?: (payload: { from: string; fromName?: string; payload: Record<string, unknown> }) => void;
  /** Chat typing indicator (ephemeral; never persisted server-side). */
  onTyping?: (payload: { channelId: string; from: string; fromName?: string }) => void;
  onOpen?: () => void;
  onError?: () => void;
}

/**
 * Opens /api/events with a single-use ticket, auto-reconnects with a fresh
 * ticket on error (3s backoff), and dispatches typed events. Returns a
 * disposer. Falls back silently when no server is configured.
 */
export function openEventStream(handlers: EventStreamHandlers): () => void {
  if (!getApiBaseUrl()) return () => {};
  let closed = false;
  let es: EventSource | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  // Audit M10: exponential retry with jitter and a cap, instead of a fixed 3s.
  let attempt = 0;
  const scheduleRetry = () => {
    attempt += 1;
    const base = Math.min(1000 * 2 ** Math.min(attempt - 1, 6), 30_000); // 1..30s
    const delay = base + Math.floor(Math.random() * base * 0.5); // + up to 50% jitter
    retryTimer = setTimeout(() => void connect(), delay);
  };

  const connect = async () => {
    if (closed) return;
    try {
      const res = await fetch(`${base()}/api/events/ticket`, {
        method: "POST",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error("ticket");
      const { ticket } = (await res.json()) as { ticket: string };
      if (closed) return;
      es = new EventSource(`${base()}/api/events?ticket=${encodeURIComponent(ticket)}`);
      es.onopen = () => {
        attempt = 0; // connected — reset backoff on any later drop
        handlers.onOpen?.();
      };
      es.addEventListener("message", (e) => {
        try {
          handlers.onMessage?.(JSON.parse((e as MessageEvent).data));
        } catch {
          /* malformed frame — ignore */
        }
      });
      es.addEventListener("interest_received", (e) => {
        try {
          const p = JSON.parse((e as MessageEvent).data);
          handlers.onInterestReceived?.(p);
        } catch { /* ignore */ }
      });
      es.addEventListener("interest_responded", (e) => {
        try {
          const p = JSON.parse((e as MessageEvent).data);
          handlers.onInterestResponded?.(p);
        } catch { /* ignore */ }
      });
      es.addEventListener("webrtc", (e) => {
        try {
          handlers.onWebRtc?.(JSON.parse((e as MessageEvent).data));
        } catch { /* ignore */ }
      });
      es.addEventListener("typing", (e) => {
        try {
          handlers.onTyping?.(JSON.parse((e as MessageEvent).data));
        } catch { /* ignore */ }
      });
      // (listeners continue to fire; the disposer removes them on teardown)
      es.onerror = () => {
        handlers.onError?.();
        es?.close();
        es = null;
        if (!closed) scheduleRetry();
      };
    } catch {
      if (!closed) scheduleRetry();
    }
  };

  void connect();
  return () => {
    closed = true;
    if (retryTimer) clearTimeout(retryTimer);
    es?.close();
    es = null;
  };
}

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

export interface ServerInvoice {
  invoiceNumber: string;
  date: string;
  planName: string;
  amount: number;
  total: number;
  status: string;
}

export async function listInvoices(): Promise<ServerInvoice[] | null> {
  const out = await call<{ invoices: ServerInvoice[] }>("/api/invoices");
  return out?.invoices ?? null;
}