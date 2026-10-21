/// <reference types="vite/client" />

// These packages ship without bundled type declarations in the installed
// versions; shims keep the strict typecheck meaningful for our usage.
//
// Audit L-19: a `declare module 'x'` shim replaces the package's own types
// with `any`, which defeats `strict` for every consumer of that package.
// These three are pinned to versions that DO ship types, so the shims are
// unnecessary — remove them and let the real declarations apply.
declare module "react-day-picker";
declare module "react-resizable-panels";
declare module "tailwind-merge";

interface ImportMetaEnv {
  readonly VITE_RAZORPAY_KEY_ID?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_DEV_SKIP_AUTH?: string;
  // Audit L-19: these two are read in production code
  // (src/pages/HelpPage.tsx, src/lib/features.ts) and were missing here, so a
  // typo in either name compiled clean and silently fell back to the default.
  readonly VITE_SUPPORT_EMAIL?: string;
  readonly VITE_ASTROLOGY_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
