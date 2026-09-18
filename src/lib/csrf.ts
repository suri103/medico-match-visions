// Shared CSRF token store (single source of truth for the whole SPA).
//
// WHY THIS EXISTS (split-origin deploys): the SPA lives on one origin (e.g.
// Vercel) and the API on another (Railway). The server sets the mm_csrf cookie
// on the API's domain, and document.cookie can only ever expose cookies for
// the CURRENT site — so on a split-origin deploy the SPA can NEVER read the
// CSRF cookie. Instead, the server returns the token in the JSON body of
// /api/auth/login, /api/auth/verify-email and GET /api/csrf; those callers
// cache it here via setCsrfToken(), and every mutating request echoes it via
// getCsrfToken(). The browser still attaches the mm_csrf COOKIE to API
// requests automatically (cookies travel with credentials:"include"), so the
// server's double-submit comparison (header vs cookie) keeps working.
//
// The cookie fallback below keeps same-origin dev (localhost frontend +
// localhost API) working without any login round-trip.

let cached: string | null = null;

const readCookie = (): string | null => {
  if (typeof document === "undefined") return null;
  const raw = document.cookie || "";
  for (const part of raw.split(/;\s*/)) {
    const eq = part.indexOf("=");
    if (eq > 0 && part.slice(0, eq) === "mm_csrf") return part.slice(eq + 1);
  }
  return null;
};

/** Echo token for mutating requests: memory cache first, cookie fallback (same-origin dev). */
export function getCsrfToken(): string | null {
  if (cached) return cached;
  cached = readCookie();
  return cached;
}

/** Cache the token handed back by the server (login/verify/csrf endpoints). */
export function setCsrfToken(token: string | null): void {
  cached = token;
}

/** Clear on sign-out (the server also rotates the cookie). */
export function clearCsrfToken(): void {
  cached = null;
}
