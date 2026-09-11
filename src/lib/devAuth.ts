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

// Belt-and-braces: if a misconfigured CI ever ships a prod build that somehow
// retained the VITE_DEV_SKIP_AUTH=true flag, refuse to evaluate demo code at
// module load. DEV is statically false in a prod build so this branch is
// unreachable; if it ever isn't, the app crashes loudly rather than minting
// sessions for arbitrary credentials.
if (!import.meta.env.DEV && import.meta.env.VITE_DEV_SKIP_AUTH === "true") {
  // Throwing at module load is intentional: every page imports this file
  // transitively, so the entire app fails to render instead of silently
  // bypassing auth.
  throw new Error(
    "VITE_DEV_SKIP_AUTH must not be set in a production build. Refusing to start."
  );
}
