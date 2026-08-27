/// <reference types="vite/client" />

// These packages ship without bundled type declarations in the installed
// versions; shims keep the strict typecheck meaningful for our usage.
declare module 'react-day-picker';
declare module 'react-resizable-panels';
declare module 'tailwind-merge';

interface ImportMetaEnv {
  readonly VITE_RAZORPAY_KEY_ID?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_DEV_SKIP_AUTH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
