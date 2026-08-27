import { usePersistedState } from './usePersistedState';
import type { AuthSession } from './useAuth';

/**
 * Returns a stable key identifying the current authenticated identity, derived
 * from the persisted session (`mm:authSession`).
 *
 * It reacts to login, logout, and account switches WITHOUT a full page reload
 * (the post-logout purge + sign-in broadcasts trigger a persisted-state
 * re-read). One-shot effects that key their deps on this value therefore
 * refetch for a new identity and can clear cross-account residue (audit H6).
 */
export const useAuthSessionKey = (): string => {
  const [session] = usePersistedState<AuthSession | null>('mm:authSession', null);
  const id = String(session?.user?.id ?? '');
  return id ? `user:${id}` : 'guest';
};