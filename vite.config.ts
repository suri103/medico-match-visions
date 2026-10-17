import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { fileURLToPath } from "url";

// ESM-safe __dirname (vite 8's native config loader warns on the CJS shim).
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config/
export default defineConfig(({ mode: _mode }) => ({
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
