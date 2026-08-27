import { Dispatch, SetStateAction, useCallback, useEffect, useRef, useState } from "react";

// Dispatched (same tab) whenever a persisted value changes, so other
// mounted components using the same key re-read it from localStorage.
const SYNC_EVENT = "mm:persisted-state-changed";

/**
 * useState that is automatically persisted to localStorage.
 * The stored value is hydrated lazily on first render and written back
 * on every change, so state survives page reloads.
 */
export function usePersistedState<T>(
  key: string,
  initial: T | (() => T)
): [T, Dispatch<SetStateAction<T>>] {
  // Latest `key`/`initial`, readable from effects without adding them to deps.
  // `readStored` is therefore a stable callback (empty deps) so the re-init
  // effect never resubscribes on every render, and no exhaustive-deps disable
  // directive is needed (audit L9).
  const keyRef = useRef(key);
  useEffect(() => {
    keyRef.current = key;
  }, [key]);
  const initialRef = useRef(initial);
  useEffect(() => {
    initialRef.current = initial;
  }, [initial]);

  const readStored = useCallback((): T => {
    const k = keyRef.current;
    const ini = initialRef.current;
    try {
      const raw = localStorage.getItem(k);
      if (raw !== null) return JSON.parse(raw) as T;
    } catch {
      // Corrupt or unavailable storage - fall through to initial
    }
    return typeof ini === "function" ? (ini as () => T)() : ini;
  }, []);

  const [state, setState] = useState<T>(readStored);
  const lastWrittenRef = useRef<string | null>(null);

  // When key changes, re-initialize state for the new key
  useEffect(() => {
    setState(readStored());
  }, [key, readStored]);

  // Persist state to localStorage and broadcast sync only when state actually changed
  useEffect(() => {
    try {
      const serialized = JSON.stringify(state);
      if (lastWrittenRef.current !== serialized) {
        lastWrittenRef.current = serialized;
        localStorage.setItem(key, serialized);
        window.dispatchEvent(
          new CustomEvent(SYNC_EVENT, { detail: { key, value: serialized } })
        );
      }
    } catch {
      // Storage full or unavailable (e.g. private mode) - ignore.
    }
  }, [key, state]);

  // Cross-component sync within tab and cross-tab
  useEffect(() => {
    const reread = () => {
      try {
        const raw = localStorage.getItem(key);
        if (raw === null) {
          // Key was purged (e.g. the sign-out wipe): reset mounted consumers to
          // their initial value so stale cross-account state cannot linger in
          // memory and be re-persisted by a later mutation (audit H6).
          lastWrittenRef.current = null;
          setState(
            typeof initialRef.current === "function"
              ? (initialRef.current as () => T)()
              : initialRef.current
          );
          return;
        }
        setState((prev) => {
          if (JSON.stringify(prev) === raw) return prev;
          try {
            const parsed = JSON.parse(raw) as T;
            lastWrittenRef.current = raw;
            return parsed;
          } catch {
            return prev;
          }
        });
      } catch {
        // Corrupt or unavailable storage - keep current state.
      }
    };

    const onSync = (e: Event) => {
      const customEvent = e as CustomEvent;
      // detail.key === "*" is the sign-out "purge everything" broadcast.
      if (customEvent.detail?.key === key || customEvent.detail?.key === "*") {
        if (customEvent.detail?.value && customEvent.detail.value === lastWrittenRef.current) {
          return;
        }
        reread();
      }
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key === key) reread();
    };

    window.addEventListener(SYNC_EVENT, onSync);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(SYNC_EVENT, onSync);
      window.removeEventListener("storage", onStorage);
    };
  }, [key]);

  return [state, setState];
}