// Client-side auth API. Passwords are checked SERVER-SIDE (scrypt + sessions)
// whenever a backend is configured via VITE_API_BASE_URL; without a backend the
// app falls back to the local demo session (clearly a demo build).

import { isCheckoutServerConfigured, getApiBaseUrl as getBaseUrl } from '@/services/checkout';

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
  token?: string;
  user?: ServerUser;
  message?: string;
  error?: string;
}

export const isAuthServerConfigured = isCheckoutServerConfigured;

const json = async (res: Response) => {
  try {
    return await res.json();
  } catch {
    return null;
  }
};

const baseHeaders = (token?: string): Record<string, string> => ({
  'Content-Type': 'application/json',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
  try {
    res = await fetch(`${getBaseUrl()}/api/auth/register`, {
      method: 'POST',
      headers: baseHeaders(),
      body: JSON.stringify(payload),
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
      headers: baseHeaders(),
      body: JSON.stringify({ email, password }),
    });
  } catch {
    return { ok: false, status: 0, error: 'Could not reach the server.' };
  }
  const body = await json(res);
  if (!res.ok) return { ok: false, status: res.status, error: body?.error || 'Invalid email or password.' };
  return { ok: true, status: res.status, token: body.token, user: body.user };
};

export interface MeResult {
  valid: boolean;
  user?: ServerUser;
  activePlan?: string | null;
  /** 'server' = the /me endpoint answered; 'network' = unreachable (offline). */
  source: 'server' | 'network';
}

/**
 * Validate a session token; also returns the server-side active plan.
 *
 * Audit L7: a network failure (server unreachable / offline) is intentionally
 * fail-open — we keep the session rather than logging the user out on a
 * transient blip. That is safe because every real API request is re-checked
 * server-side anyway (suspension/revocation is enforced on each call, not just
 * this load-time check). A definitive server rejection (4xx) still returns
 * `valid:false`. The `source` field makes the distinction explicit.
 */
export const serverMe = async (token: string): Promise<MeResult> => {
  let res: Response;
  try {
    res = await fetch(`${getBaseUrl()}/api/auth/me`, { headers: baseHeaders(token) });
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
      headers: baseHeaders(),
      body: JSON.stringify({ token }),
    });
  } catch {
    return { ok: false, status: 0, error: 'Could not reach the server.' };
  }
  const body = await json(res);
  if (!res.ok) return { ok: false, status: res.status, error: body?.error || 'Verification failed.' };
  return { ok: true, status: res.status, token: body.token, user: body.user };
};

/** Request a password reset link (generic response — no enumeration). */
export const forgotPassword = async (email: string): Promise<AuthResult> => {
  let res: Response;
  try {
    res = await fetch(getBaseUrl() + "/api/auth/forgot-password", {
      method: 'POST',
      headers: baseHeaders(),
      body: JSON.stringify({ email }),
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
      headers: baseHeaders(),
      body: JSON.stringify({ token, password }),
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
  let token: string | undefined;
  try {
    const raw = localStorage.getItem('mm:authSession');
    const session = raw ? JSON.parse(raw) : null;
    token = typeof session?.token === 'string' ? session.token : undefined;
  } catch {
    token = undefined;
  }
  if (!token) return { ok: false, status: 401, error: 'Sign in first.' };

  let res: Response;
  try {
    res = await fetch(`${getBaseUrl()}/api/auth/change-password`, {
      method: 'POST',
      headers: baseHeaders(token),
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  } catch {
    return { ok: false, status: 0, error: 'Could not reach the server.' };
  }
  const body = await json(res);
  if (!res.ok) return { ok: false, status: res.status, error: body?.error || 'Password change failed.' };
  return { ok: true, status: res.status, message: body?.message };
};
