// Demo-mode affordances: 1-click demo logins on /sign-in, seeded conversations
// and likes, and the offline session fallback. These exist for development
// convenience only.
//
// The `import.meta.env.DEV` guards make it structurally impossible for any of
// this to ship in a production build: Vite statically replaces DEV with `false`
// during `vite build`, so both expressions collapse no matter what any .env
// file contains (audit H3).
export const devAuthBypass = import.meta.env.DEV && import.meta.env.VITE_DEV_SKIP_AUTH === "true";

// Broader demo-content switch: true in every dev server session regardless of
// VITE_DEV_SKIP_AUTH, statically false in production builds.
export const demoModeEnabled = import.meta.env.DEV;

// ---------------------------------------------------------------------------
// Production safety net (audit C-1 / H-14).
//
// PRODUCT DECISION (safe default): a misconfigured build flag is NEVER fatal.
// The previous version threw at module load whenever VITE_DEV_SKIP_AUTH was
// present in a production build. Vite folds `import.meta.env.DEV` to `false`
// and substitutes the flag value from `.env` — and because `.env` is loaded
// in EVERY mode, that value was always "true" — so the `if` folded to a
// constant and the minifier left an UNCONDITIONAL `throw` at module scope in
// the entry chunk. Every page then failed to boot (blank screen) before
// rendering a single route: a total outage caused by a harmless
// misconfiguration.
//
// The invariant that actually matters is "`import.meta.env.DEV` must be false
// in a shipped bundle". `vite.config.ts` guarantees it by pinning
// NODE_ENV=production for `vite build` (Vite only DEFAULTS NODE_ENV when it
// is unset, so a shell that pre-set NODE_ENV=development used to produce a
// DEV=true bundle that re-enabled this bypass) and by stripping the flag from
// the production bundle.
//
// So: no throw. The bypass above stays off, and the build-time strip keeps
// the flag out of the artifact entirely.
// ---------------------------------------------------------------------------
if (!import.meta.env.DEV && import.meta.env.VITE_DEV_SKIP_AUTH === "true") {
  console.error(
    "[medicomatch] VITE_DEV_SKIP_AUTH reached a production bundle. The demo " +
      "auth bypass is still OFF (it is gated on import.meta.env.DEV), but the " +
      "flag must not be present in a shipped artifact."
  );
}
