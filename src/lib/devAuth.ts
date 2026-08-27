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
