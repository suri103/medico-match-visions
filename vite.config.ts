import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { fileURLToPath } from "url";

// ESM-safe __dirname (vite 8's native config loader warns on the CJS shim).
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => ({
  // H-14 / C-1 FIX — pin NODE_ENV for production builds.
  //
  // Vite only DEFAULTS NODE_ENV when it is unset. In
  // node_modules/vite/dist/node/chunks/node.js:
  //   const isNodeEnvSet = !!process.env.NODE_ENV;      // :36570
  //   if (!isNodeEnvSet) process.env.NODE_ENV = defaultNodeEnv;  // :36572
  //   const isProduction = process.env.NODE_ENV === "production";  // :36707
  //   env: { ...userEnv, BASE_URL, MODE, DEV: !isProduction, PROD: isProduction }    // :36823
  //
  // A build shell that already exported NODE_ENV=development|staging|test
  // therefore produced a bundle with `import.meta.env.DEV === true`, which
  // re-enabled the demo auth bypass (src/lib/devAuth.ts) and every
  // sample-data surface. Vite documents this exact escape hatch ("If you need
  // to set process.env.NODE_ENV, you can set it in the Vite config instead"),
  // and `isProduction` is read AFTER this file is evaluated, so the override
  // takes effect.
  //
  // The same file also STRIPS the demo bypass flag from production bundles.
  // `.env` is loaded in EVERY Vite mode, so `VITE_DEV_SKIP_AUTH=true` from a
  // developer's `.env` landed in production artifacts. Vite's loadEnv applies
  // `process.env` AFTER the parsed `.env` files (node.js:5927), and this
  // config file is evaluated BEFORE loadEnv runs (node.js:36581 vs :36701),
  // so assigning it here wins deterministically.
  //
  // `build:dev` (vite build --mode development) is intentionally exempt so the
  // local demo-flavoured build keeps working.
  config: (() => {
    if (command === "build" && mode !== "development") {
      process.env.NODE_ENV = "production";
      process.env.VITE_DEV_SKIP_AUTH = "false";
    }
    return {};
  })(),
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Function form is required by vite 8 (rolldown) and supported by
        // vite 5-7 (rollup): split stable third-party libraries so their
        // long-term cache stays valid and the entry chunk stays small.
        manualChunks: (id) => {
          if (id.includes("node_modules")) {
            if (/(react|react-dom|react-router|scheduler)/.test(id)) return "react-vendor";
            if (/(lucide-react|date-fns)/.test(id)) return "ui-vendor";
          }
          return undefined;
        },
      },
    },
  },
}));
