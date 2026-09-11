import { usePersistedState } from './usePersistedState';
import { useCallback, useEffect, useState } from 'react';
import { serverMe, isAuthServerConfigured } from '@/services/auth';
import { localAvatar } from '@/lib/avatar';

export interface AuthUser {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  imageUrl?: string;
  specialty?: string;
  degree?: string;
  isDoctorVerified?: boolean;
}

export interface AuthSession {
  user: AuthUser;
  /**
   * Server-issued session token — used for the Authorization: Bearer path
   * (mobile / API). The web SPA uses the httpOnly `mm_session` cookie and does
   * NOT need this token to authenticate, so it is typically absent on the web.
   */
  token?: string;
  signedInAt: string;
}

// Server entitlement sku -> plan name (annual skus map to their base plan).
const planFromSku = (sku?: string | null): 'premium' | 'platinum' | null => {
  if (!sku) return null;
  if (sku.startsWith('platinum')) return 'platinum';
  if (sku.startsWith('premium')) return 'premium';
  return null;
};

// Cookie names MUST match the server constants in server/src/index.mjs.
const SESSION_COOKIE = 'mm_session';
const CSRF_COOKIE = 'mm_csrf';

const readCookie = (name: string): string | null => {
  if (typeof document === 'undefined') return null;
  const raw = document.cookie || '';
  for (const part of raw.split(/;\s*/)) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq) === name) return part.slice(eq + 1);
  }
  return null;
};

const clearClientCookie = (name: string) => {
  if (typeof document === 'undefined') return;
  // The httpOnly server cookie is cleared by the server on /api/auth/sign-out;
  // this only handles the non-httpOnly CSRF cookie.
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Strict`;
};

// In-memory cache of the most recent CSRF token, kept in sync with the cookie
// so the fetch layer can echo it on every mutating request without a round-trip
// to read the cookie.
let csrfTokenCache: string | null = null;
export const getCsrfToken = (): string | null => {
  if (csrfTokenCache) return csrfTokenCache;
  const fromCookie = readCookie(CSRF_COOKIE);
  if (fromCookie) csrfTokenCache = fromCookie;
  return csrfTokenCache;
};
const setCsrfTokenCache = (token: string | null) => {
  csrfTokenCache = token;
};

// Fetch a fresh CSRF token from the server (the server also sets the cookie).
// Call this after sign-in, after sign-out, and on app boot.
const fetchCsrfToken = async (): Promise<string | null> => {
  if (!isAuthServerConfigured()) return null;
  try {
    const base = (await import('@/services/checkout')).getApiBaseUrl();
    const res = await fetch(`${base}/api/csrf`, { credentials: 'include' });
    if (!res.ok) return null;
    const body = (await res.json()) as { csrfToken?: string };
    if (body.csrfToken) setCsrfTokenCache(body.csrfToken);
    return body.csrfToken ?? null;
  } catch {
    return null;
  }
};

// One-time-per-load guard: every component instance mounts this hook, but the
// session only needs to be validated against the server once.
let sessionValidatedThisLoad = false;

export const useAuth = () => {
  // NOTE: default is `null` (guest). A session is only created by an explicit
  // `signIn(...)` call (hero login, demo login, sign-in, sign-up). Never seed a
  // fake doctor here — visitors must not appear logged-in before authenticating.
  const [session, setSession] = usePersistedState<AuthSession | null>('mm:authSession', null);
  // Audit M-12 / item 1: track whether the SERVER says we are signed in
  // (cookie-backed). This is the source of truth; the local `session.user`
  // is a display optimisation that can be cleared in the same tick the server
  // invalidates our cookie.
  const [serverSignedIn, setServerSignedIn] = useState<boolean | null>(null);

  // Detect cookie presence synchronously so the first render reflects the
  // real auth state instead of waiting for a network round-trip.
  const hasCookie = typeof document !== 'undefined' && Boolean(readCookie(SESSION_COOKIE));
  const isSignedIn = Boolean(session?.user) || (serverSignedIn ?? hasCookie);

  // Validate server-backed sessions once per page load: a rejected cookie
  // signs the user out, and the server-side entitlement is the source of
  // truth for the active plan (a self-edited mm:activePlan cannot grant
  // premium to a real account).
  useEffect(() => {
    if (sessionValidatedThisLoad) return;
    sessionValidatedThisLoad = true;
    if (!isAuthServerConfigured()) return;
    // Always refresh the CSRF token on app boot — it survives the cookie's
    // 12h lifetime but may have been rotated by a prior tab's sign-out.
    void fetchCsrfToken();
    serverMe().then((me) => {
      if (!me.valid) {
        setSession(null);
        setServerSignedIn(false);
        return;
      }
      setServerSignedIn(true);
      const plan = planFromSku(me.activePlan);
      try {
        if (plan) {
          localStorage.setItem('mm:activePlan', JSON.stringify({ name: plan, activatedAt: new Date().toISOString() }));
        } else {
          // Server account with no entitlement — clear any locally self-set plan.
          localStorage.removeItem('mm:activePlan');
        }
        window.dispatchEvent(new CustomEvent('mm:persisted-state-changed', { detail: { key: 'mm:activePlan' } }));
      } catch { /* storage unavailable */ }
    });
  }, [setSession]);

  const signIn = useCallback((user: Partial<AuthUser>, token?: string) => {
    const fullUser: AuthUser = {
      id: user.id || `doc_${Date.now()}`,
      // Audit H-2: no fabricated fallback — a missing email stays empty rather
      // than showing a fake address in the session / UI.
      email: user.email || '',
      firstName: user.firstName || 'Doctor',
      lastName: user.lastName || '',
      // The "Dr." title comes from the SERVER (mayUseDrTitle) which gates it on
      // completed qualifications — never fabricated client-side for students.
      fullName: user.fullName || user.firstName || 'Doctor',
      imageUrl: user.imageUrl || localAvatar(user.firstName || user.email),
      specialty: user.specialty || '',
      // Degree stays exactly as declared — no "MBBS" default (a student who
      // hasn't chosen a degree must never appear credentialed).
      degree: user.degree || '',
      // Verification is a real process — never default a session to verified.
      isDoctorVerified: false,
      ...user,
    };
    setSession({
      user: fullUser,
      ...(token ? { token } : {}),
      signedInAt: new Date().toISOString(),
    });
    setServerSignedIn(true);
    // Refresh the CSRF token after sign-in (the server rotated the cookie).
    void fetchCsrfToken();
  }, [setSession]);

  const signOut = useCallback(async () => {
    // Audit M-12 / item 1: ask the server to clear the httpOnly session cookie
    // and rotate the CSRF cookie. The fetch layer will also send the cached
    // CSRF token on this call, satisfying the guard.
    if (isAuthServerConfigured()) {
      try {
        const base = (await import('@/services/checkout')).getApiBaseUrl();
        await fetch(`${base}/api/auth/sign-out`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...(getCsrfToken() ? { 'X-CSRF-Token': getCsrfToken() as string } : {}) },
          body: JSON.stringify({ csrfToken: getCsrfToken() }),
        });
      } catch {
        // Best-effort: still clear local state even if the network is down.
      }
    }
    setSession(null);
    setServerSignedIn(false);
    setCsrfTokenCache(null);
    clearClientCookie(CSRF_COOKIE);
    // Purge ALL app state — chats, photos, certificates, reports, plan,
    // quotas, everything. Keys are not user-scoped, so anything left behind
    // bleeds into the next account on a shared device (audit H6).
    try {
      const stale: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('mm:')) stale.push(key);
      }
      for (const key of stale) localStorage.removeItem(key);
      sessionStorage.removeItem('mm:checkoutToken');
      window.dispatchEvent(new CustomEvent('mm:persisted-state-changed', { detail: { key: '*' } }));
    } catch {
      // Storage unavailable — nothing to purge.
    }
  }, [setSession]);

  return {
    user: session?.user || null,
    isSignedIn,
    isLoaded: true,
    isServerAccount: Boolean(session?.token) || (serverSignedIn ?? hasCookie),
    signIn,
    signOut,
  };
};
