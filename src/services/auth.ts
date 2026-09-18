// Client-side auth API. Passwords are checked SERVER-SIDE (scrypt + sessions)
// whenever a backend is configured via VITE_API_BASE_URL; without a backend the
// app falls back to the local demo session (clearly a demo build).

import { isCheckoutServerConfigured, getApiBaseUrl as getBaseUrl } from '@/services/checkout';
import { obtainPowSolution } from '@/lib/pow';

export interface ServerUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName?: string;
  specialty?: string;
  degree?: string;
}

export interface AuthResult {
  ok: boolean;
  status: number;
  /** Bearer for explicit mobile/API opt-in; null/undefined for cookie-first browsers. */
  token?: string | null;
  csrfToken?: string;
  user?: ServerUser;
  message?: string;
  error?: string;
}

export const isAuthServerConfigured = isCheckoutServerConfigured;

// Audit M-12 / item 1: every fetch the web SPA makes must carry credentials
// so the httpOnly session cookie is attached. The Bearer path is preserved
// for the mobile app / API clients.
const credentials = 'include';

const json = async (res: Response) => {
  try {
    return await res.json();
  } catch {
    return null;
  }
};

// Audit M-12: CSRF token handling lives in src/lib/csrf.ts (shared with
// api.ts/useAuth). On a split-origin deploy the SPA cannot read the API
// domain's cookie, so the cache (populated from the login/verify JSON body)
// is the reliable source; the cookie fallback covers same-origin dev.
import { getCsrfToken as getCsrfTokenCached, setCsrfToken } from '@/lib/csrf';

const csrfHeaders = (): Record<string, string> => {
  const t = getCsrfTokenCached();
  return t ? { 'X-CSRF-Token': t } : {};
};

const baseHeaders = (token?: string): Record<string, string> => ({
  'Content-Type': 'application/json',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
  ...csrfHeaders(),
});

/** Register a real account on the server. */
export const registerWithServer = async (payload: {
  email: string;
  password: string;
  firstName: string;
  lastName?: string;
  specialty?: string;
  degree?: string;
}): Promise<AuthResult> => {
  let res: Response;
  const pow = await obtainPowSolution(getBaseUrl(), payload.email);
  try {
    res = await fetch(`${getBaseUrl()}/api/auth/register`, {
      method: 'POST',
      credentials,
      headers: baseHeaders(),
      body: JSON.stringify({ ...payload, ...pow, csrfToken: getCsrfTokenCached() }),
    });
  } catch {
    return { ok: false, status: 0, error: 'Could not reach the server.' };
  }
  const body = await json(res);
  if (!res.ok) return { ok: false, status: res.status, error: body?.error || 'Registration failed.' };
  return { ok: true, status: res.status, message: body?.message };
};

/** Sign in against the server — wrong credentials return ok:false (401). */
export const loginWithServer = async (email: string, password: string): Promise<AuthResult> => {
  let res: Response;
  try {
    res = await fetch(`${getBaseUrl()}/api/auth/login`, {
      method: 'POST',
      credentials,
      headers: baseHeaders(),
      body: JSON.stringify({ email, password, csrfToken: getCsrfTokenCached() }),
    });
  } catch {
    return { ok: false, status: 0, error: 'Could not reach the server.' };
  }
  const body = await json(res);
  if (!res.ok) return { ok: false, status: res.status, error: body?.error || 'Invalid email or password.' };
  // Cache the CSRF token delivered in the body — on a split-origin deploy the
  // SPA cannot read the API domain's cookie, so this is the only source.
  if (body?.csrfToken) setCsrfToken(body.csrfToken);
  return { ok: true, status: res.status, token: body.token, csrfToken: body.csrfToken, user: body.user };
};

export interface MeResult {
  valid: boolean;
  user?: ServerUser;
  activePlan?: string | null;
  /** 'server' = the /me endpoint answered; 'network' = unreachable (offline). */
  source: 'server' | 'network';
}

/**
 * Validate the current session. With no token argument, the httpOnly cookie
 * (set by the server on login) carries the authentication. Audit M-12 / item 1:
 * the SPA no longer needs a Bearer token in localStorage.
 */
export const serverMe = async (token?: string): Promise<MeResult> => {
  let res: Response;
  try {
    res = await fetch(`${getBaseUrl()}/api/auth/me`, {
      credentials,
      headers: token ? baseHeaders(token) : { ...csrfHeaders() },
    });
  } catch {
    // Network failure: cannot verify — keep the session (offline grace window),
    // but be explicit that this is an offline opinion, not a server verdict.
    return { valid: true, source: 'network' };
  }
  if (!res.ok) return { valid: false, source: 'server' };
  const body = await json(res);
  return { valid: true, user: body?.user, activePlan: body?.activePlan ?? null, source: 'server' };
};

/** Verify an emailed verification link; returns a session token on success. */
export const verifyEmail = async (token: string): Promise<AuthResult> => {
  let res: Response;
  try {
    res = await fetch(getBaseUrl() + "/api/auth/verify-email", {
      method: 'POST',
      credentials,
      headers: baseHeaders(),
      body: JSON.stringify({ token, csrfToken: getCsrfTokenCached() }),
    });
  } catch {
    return { ok: false, status: 0, error: 'Could not reach the server.' };
  }
  const body = await json(res);
  if (!res.ok) return { ok: false, status: res.status, error: body?.error || 'Verification failed.' };
  if (body?.csrfToken) setCsrfToken(body.csrfToken);
  return { ok: true, status: res.status, token: body.token, csrfToken: body.csrfToken, user: body.user };
};

/** Request a password reset link (generic response — no enumeration). */
export const forgotPassword = async (email: string): Promise<AuthResult> => {
  let res: Response;
  const pow = await obtainPowSolution(getBaseUrl(), email);
  try {
    res = await fetch(getBaseUrl() + "/api/auth/forgot-password", {
      method: 'POST',
      credentials,
      headers: baseHeaders(),
      body: JSON.stringify({ email, ...pow, csrfToken: getCsrfTokenCached() }),
    });
  } catch {
    return { ok: false, status: 0, error: 'Could not reach the server.' };
  }
  const body = await json(res);
  if (!res.ok) return { ok: false, status: res.status, error: body?.error || 'Request failed.' };
  return { ok: true, status: res.status, message: body?.message };
};

/** Set a new password using a reset link. */
export const resetPassword = async (token: string, password: string): Promise<AuthResult> => {
  let res: Response;
  try {
    res = await fetch(getBaseUrl() + "/api/auth/reset-password", {
      method: 'POST',
      credentials,
      headers: baseHeaders(),
      body: JSON.stringify({ token, password, csrfToken: getCsrfTokenCached() }),
    });
  } catch {
    return { ok: false, status: 0, error: 'Could not reach the server.' };
  }
  const body = await json(res);
  if (!res.ok) return { ok: false, status: res.status, error: body?.error || 'Reset failed.' };
  return { ok: true, status: res.status, message: body?.message };
};

/**
 * Change the signed-in user's password (server verifies the CURRENT password
 * and invalidates every existing session). Requires a real server session.
 */
export const changePassword = async (currentPassword: string, newPassword: string): Promise<AuthResult> => {
  // Cookie-first: the web SPA authenticates via httpOnly mm_session (token
  // typically absent from localStorage). Fall back to Bearer when present for
  // mobile/API clients. Never 401 here — let the server decide.
  let token: string | undefined;
  try {
    const raw = localStorage.getItem('mm:authSession');
    const session = raw ? JSON.parse(raw) : null;
    token = typeof session?.token === 'string' ? session.token : undefined;
  } catch {
    token = undefined;
  }

  let res: Response;
  try {
    res = await fetch(`${getBaseUrl()}/api/auth/change-password`, {
      method: 'POST',
      credentials,
      headers: baseHeaders(token),
      body: JSON.stringify({ currentPassword, newPassword, csrfToken: getCsrfTokenCached() }),
    });
  } catch {
    return { ok: false, status: 0, error: 'Could not reach the server.' };
  }
  const body = await json(res);
  if (!res.ok) return { ok: false, status: res.status, error: body?.error || 'Password change failed.' };
  return { ok: true, status: res.status, message: body?.message };
};
