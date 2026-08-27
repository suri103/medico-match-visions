import { usePersistedState } from './usePersistedState';
import { useCallback, useEffect } from 'react';
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
  /** Server-issued session token — present only for real (non-demo) accounts. */
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

// One-time-per-load guard: every component instance mounts this hook, but the
// session only needs to be validated against the server once.
let sessionValidatedThisLoad = false;

export const useAuth = () => {
  // NOTE: default is `null` (guest). A session is only created by an explicit
  // `signIn(...)` call (hero login, demo login, sign-in, sign-up). Never seed a
  // fake doctor here — visitors must not appear logged-in before authenticating.
  const [session, setSession] = usePersistedState<AuthSession | null>('mm:authSession', null);

  const isSignedIn = Boolean(session?.user);

  // Validate server-backed sessions once per page load: a rejected token signs
  // the user out, and the server-side entitlement is the source of truth for
  // the active plan (a self-edited mm:activePlan cannot grant premium to a
  // real account).
  useEffect(() => {
    if (sessionValidatedThisLoad) return;
    sessionValidatedThisLoad = true;
    const token = session?.token;
    if (!token || !isAuthServerConfigured()) return;
    serverMe(token).then((me) => {
      if (!me.valid) {
        setSession(null);
        return;
      }
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
  }, [session, setSession]);

  const signIn = useCallback((user: Partial<AuthUser>, token?: string) => {
    const fullUser: AuthUser = {
      id: user.id || `doc_${Date.now()}`,
      email: user.email || 'doctor@medicomatch.in',
      firstName: user.firstName || 'Doctor',
      lastName: user.lastName || '',
      fullName: user.fullName || `Dr. ${user.firstName || 'Doctor'}`,
      imageUrl: user.imageUrl || localAvatar(user.firstName || user.email),
      specialty: user.specialty || 'Physician',
      degree: user.degree || 'MBBS',
      // Verification is a real process — never default a session to verified.
      isDoctorVerified: false,
      ...user,
    };
    setSession({
      user: fullUser,
      ...(token ? { token } : {}),
      signedInAt: new Date().toISOString(),
    });
  }, [setSession]);

  const signOut = useCallback(async () => {
    setSession(null);
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
    isServerAccount: Boolean(session?.token),
    signIn,
    signOut,
  };
};
