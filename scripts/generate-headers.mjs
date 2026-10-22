#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Generates `dist/_headers` (Cloudflare Pages / Netlify) from the committed
// template in `public/_headers`, adding the deployment-specific bits that
// cannot be known at authoring time:
//
//   - the exact API origin from VITE_API_BASE_URL in `connect-src`
//     (audit H-11: the committed template used the bare scheme wildcard
//     `https:` / `wss:`, which allowed requests to ANY host);
//   - an ABSOLUTE `report-uri` / `report-to` pointing at the API's
//     `/api/csp-report` sink (audit M-15 / L-7: the relative path resolved
//     against the CDN origin, which does not serve that route, so the sink
//     could never fire);
//   - Cache-Control rules that distinguish immutable hashed assets from the
//     HTML entry point (audit L-6).
//
// The API origin is read with Vite's own `loadEnv`, so it follows exactly the
// same precedence as the build itself (process.env > .env.<mode> > .env).
// ---------------------------------------------------------------------------
import fs from "node:fs";
import path from "node:path";
import { loadEnv } from "vite";

const ROOT = process.cwd();
const TEMPLATE = path.join(ROOT, "public", "_headers");
const OUT = path.join(ROOT, "dist", "_headers");

if (!fs.existsSync(TEMPLATE)) {
  console.error(`headers:generate: template not found at ${TEMPLATE}`);
  process.exit(1);
}
if (!fs.existsSync(path.join(ROOT, "dist"))) {
  console.error("headers:generate: dist/ not found — run `npm run build` first.");
  process.exit(1);
}

const mode = process.env.MODE || "production";
const env = loadEnv(mode, ROOT, "VITE_");

/** The API origin the SPA talks to, or null when it is not configured. */
function apiOrigin() {
  const raw = env.VITE_API_BASE_URL || process.env.VITE_API_BASE_URL || "";
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.origin;
  } catch {
    return null;
  }
}

const origin = apiOrigin();
const template = fs.readFileSync(TEMPLATE, "utf8");

// ---------------------------------------------------------------------------
// 1. connect-src — start from the committed list and add the real API origin.
// ---------------------------------------------------------------------------
const BASE_CONNECT_SOURCES = [
  "'self'",
  "https://api.medicomatch.in",
  "https://api.razorpay.com",
  "https://lumberjack.razorpay.com",
  // Railway's default service domains. Scoped to Railway rather than a bare
  // `https:` wildcard so the app keeps working on a default Railway domain
  // without opening the policy to every host on the internet.
  "https://*.up.railway.app",
  "wss://*.up.railway.app",
];

const connectSources = [...BASE_CONNECT_SOURCES];
if (origin && !connectSources.includes(origin)) {
  connectSources.push(origin);
}
const connectSrc = connectSources.join(" ");

// ---------------------------------------------------------------------------
// 2. Build the CSP directives from the template, replacing connect-src and
//    adding the report sink.
// ---------------------------------------------------------------------------
const cspDirectives = [];
for (const rawLine of template.split(/\r?\n/)) {
  const line = rawLine.trim();
  if (!line || line.startsWith("#") || line.startsWith("/*")) continue;
  const idx = line.indexOf(":");
  if (idx === -1) continue;
  const name = line.slice(0, idx).trim().toLowerCase();
  const value = line.slice(idx + 1).trim();
  if (name !== "content-security-policy") continue;
  for (const part of value.split(";")) {
    const t = part.trim();
    if (t) cspDirectives.push(t);
  }
}

const withoutConnect = cspDirectives.filter((d) => !d.toLowerCase().startsWith("connect-src"));
withoutConnect.push(`connect-src ${connectSrc}`);

// media-src: local camera streams. Not present in the template because the
// default-src fallback ('self') already covered the app's MediaStream usage;
// blob: is added explicitly so a future <video src="blob:..."> is not blocked.
if (!withoutConnect.some((d) => d.toLowerCase().startsWith("media-src"))) {
  withoutConnect.push("media-src 'self' blob:");
}

// CSP reporting. The sink lives on the API, so the URI must be ABSOLUTE — a
// relative one would resolve against the CDN origin and 404.
const reportTarget = origin ? `${origin}/api/csp-report` : null;
if (reportTarget) {
  if (!withoutConnect.some((d) => d.toLowerCase().startsWith("report-uri"))) {
    withoutConnect.push(`report-uri ${reportTarget}`);
  }
  if (!withoutConnect.some((d) => d.toLowerCase().startsWith("report-to"))) {
    withoutConnect.push("report-to csp-endpoint");
  }
}

const csp = withoutConnect.join("; ");

// ---------------------------------------------------------------------------
// 3. Emit the final headers file.
// ---------------------------------------------------------------------------
const lines = [
  "/*",
  "  X-Content-Type-Options: nosniff",
  "  X-Frame-Options: DENY",
  "  Referrer-Policy: strict-origin-when-cross-origin",
  "  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload",
  "  Permissions-Policy: camera=(self), microphone=(self), geolocation=()",
  `  Content-Security-Policy: ${csp}`,
  "",
  "# Hashed assets are immutable - their filename changes with the content.",
  "/assets/*",
  "  Cache-Control: public, max-age=31536000, immutable",
  "",
  "# The HTML entry point must never be cached, or a CDN can serve a stale",
  "# document that points at assets (and an API origin) from an older deploy.",
  "/*.html",
  "  Cache-Control: no-cache, must-revalidate",
];

fs.writeFileSync(OUT, lines.join("\n") + "\n", "utf8");

// Cloudflare Pages / static host native SPA fallback: generate 200.html alongside index.html
const indexHtml = path.join(ROOT, "dist", "index.html");
const fallback200 = path.join(ROOT, "dist", "200.html");
if (fs.existsSync(indexHtml)) {
  fs.copyFileSync(indexHtml, fallback200);
}

console.log(
  `headers:generate: wrote dist/_headers (api origin: ${origin ?? "NOT CONFIGURED"})`
);
if (!origin) {
  console.warn(
    "headers:generate: WARNING — VITE_API_BASE_URL is not set. The CSP allows the " +
      "committed API origins plus *.up.railway.app. Set VITE_API_BASE_URL at build " +
      "time if the API is served from another host, or the SPA's API calls will be " +
      "blocked by the CSP."
  );
}
