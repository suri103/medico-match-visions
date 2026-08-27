// Typed client for the wired (DB-backed) product APIs. Every call degrades to
// `null` on failure so callers can fall back to demo behaviour when the
// backend has no database (dev) or is unreachable (offline).
//
// SECURITY: contact data (phone/email) is NEVER present in list/detail
// responses — the server strips it. It is only ever obtained through
// revealContact(), which is metered by the server-side quota.

import { getApiBaseUrl } from "@/services/checkout";

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

function authHeaders(): Record<string, string> {
  try {
    const raw = localStorage.getItem("mm:authSession");
    const session = raw ? JSON.parse(raw) : null;
    return session?.token
      ? { Authorization: `Bearer ${session.token}`, "Content-Type": "application/json" }
      : { "Content-Type": "application/json" };
  } catch {
    return { "Content-Type": "application/json" };
  }
}

/** True when a real server session exists AND an API base URL is configured. */
export function hasServerSession(): boolean {
  try {
    const raw = localStorage.getItem("mm:authSession");
    const session = raw ? JSON.parse(raw) : null;
    return Boolean(session?.token) && Boolean(base());
  } catch {
    return false;
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T | null> {
  if (!base()) return null;
  try {
    const res = await fetch(`${base()}${path}`, {
      ...init,
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
    minAge?: number; maxAge?: number; verifiedOnly?: boolean; limit?: number;
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

export async function getQuota(): Promise<QuotaSummary | null> {
  const out = await call<QuotaSummary>("/api/quota");
  return out ?? null;
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

export async function listMessages(channelId: string): Promise<ServerMessage[] | null> {
  const out = await call<{ messages: ServerMessage[] }>(`/api/channels/${encodeURIComponent(channelId)}/messages`);
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

export async function setSamplesHidden(hidden: boolean): Promise<{ ok: boolean; affected?: number; error: string | null }> {
  const out = await callOrError<{ affected: number }>("/api/admin/samples/hide-all", {
    method: "POST",
    body: JSON.stringify({ hidden }),
  });
  return { ok: out.error === null, affected: out.data?.affected, error: out.error };
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
// Realtime WebRTC signaling relay (1:1 calls between matched users)
// ---------------------------------------------------------------------------

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