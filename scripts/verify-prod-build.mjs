#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Production bundle verifier (audit C-1 / H-14 / H-11 / L-6 / L-19).
//
// Runs automatically after `vite build` (npm's `postbuild` hook). It turns the
// class of defect that produced a TOTAL OUTAGE — a production bundle that
// throws at module load — into a BUILD FAILURE, which is recoverable, instead
// of a deployed app that renders nothing.
//
// Every rule below is a regression test for a finding that was verified
// against a real build output:
//   - C-1  the dev-auth guard used to leave an unconditional `throw` at module
//          scope in the entry chunk, so every page failed to boot.
//   - H-14 a build shell with NODE_ENV=development used to produce a bundle
//          with `import.meta.env.DEV === true`, re-enabling the demo auth
//          bypass and every sample-data surface.
//   - H-11 the CDN CSP allowed `connect-src https: wss:`, i.e. any origin.
//   - L-6  no Cache-Control policy existed for hashed assets vs index.html.
//   - L-19 production source maps must not be published.
// ---------------------------------------------------------------------------
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DIST = path.resolve(ROOT, "dist");
const failures = [];

const fail = (msg) => failures.push(msg);

if (!fs.existsSync(DIST)) {
  console.error("verify-prod-build: dist/ not found — run `npm run build` first.");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 1. The entry script referenced by index.html must exist.
// ---------------------------------------------------------------------------
const html = fs.readFileSync(path.join(DIST, "index.html"), "utf8");
const entryMatch = html.match(/<script[^>]+src="\/([^"]+\.js)"/);
if (!entryMatch) {
  fail("index.html does not reference a module entry script.");
} else {
  const entry = path.join(DIST, entryMatch[1]);
  if (!fs.existsSync(entry)) {
    fail(`index.html references ${entryMatch[1]} but it does not exist in dist/.`);
  }
}

// ---------------------------------------------------------------------------
// 2. No dev-only affordances may survive into a production bundle.
//    `1-Click Quick Demo Login` lives inside a `demoModeEnabled && (...)`
//    branch; when `import.meta.env.DEV` folds to false the whole subtree is
//    dead code and the minifier removes it. If the string is still present,
//    DEV was true in the build — the H-14 auth bypass is live.
// ---------------------------------------------------------------------------
const assetsDir = path.join(DIST, "assets");
const assets = fs.existsSync(assetsDir)
  ? fs.readdirSync(assetsDir).filter((f) => f.endsWith(".js"))
  : [];
if (assets.length === 0) fail("dist/assets contains no JavaScript chunks.");

const FORBIDDEN_MARKERS = [
  { needle: "Refusing to start", why: "the fatal dev-auth guard is back (audit C-1)" },
  { needle: "1-Click Quick Demo Login", why: "demo sign-in UI shipped — import.meta.env.DEV was true (audit H-14)" },
  { needle: "VITE_DEV_SKIP_AUTH must not", why: "the fatal dev-auth guard is back (audit C-1)" },
];

for (const file of assets) {
  const src = fs.readFileSync(path.join(assetsDir, file), "utf8");
  for (const { needle, why } of FORBIDDEN_MARKERS) {
    if (src.includes(needle)) {
      fail(`dist/assets/${file} contains "${needle}" — ${why}.`);
    }
  }
}

// ---------------------------------------------------------------------------
// 3. Production source maps must not be published (audit L-19).
// ---------------------------------------------------------------------------
const maps = fs.existsSync(assetsDir)
  ? fs.readdirSync(assetsDir).filter((f) => f.endsWith(".map"))
  : [];
if (maps.length > 0) {
  fail(`dist/assets contains ${maps.length} source map file(s) — they must not be published.`);
}

// ---------------------------------------------------------------------------
// 4. The CDN headers file must exist and must not allow a bare scheme
//    wildcard in connect-src (audit H-11).
// ---------------------------------------------------------------------------
const headersPath = path.join(DIST, "_headers");
if (!fs.existsSync(headersPath)) {
  fail("dist/_headers is missing — the CDN security headers were not generated.");
} else {
  const headers = fs.readFileSync(headersPath, "utf8");
  const cspLine = headers
    .split(/\r?\n/)
    .find((l) => l.toLowerCase().includes("content-security-policy:"));
  if (!cspLine) {
    fail("dist/_headers has no Content-Security-Policy.");
  } else {
    const connectSrc = (cspLine.split("connect-src")[1] || "").split(";")[0] || "";
    for (const wildcard of ["https:", "wss:", "http:"]) {
      if (new RegExp(`(^|\\s)${wildcard}(\\s|$)`).test(connectSrc)) {
        fail(
          `connect-src contains the bare scheme wildcard "${wildcard}" — it allows ` +
            `requests to ANY host. Use an explicit origin list (audit H-11).`
        );
      }
    }
    if (!connectSrc.includes("'self'")) {
      fail("connect-src does not include 'self'.");
    }
  }
  // SPA fallback: Netlify is covered via netlify.toml, Cloudflare via wrangler.jsonc / 200.html (audit L-4).
  const hasNetlifyConfig = fs.existsSync(path.join(ROOT, "netlify.toml"));
  const hasCloudflareFallback = fs.existsSync(path.join(DIST, "200.html"));
  if (!hasNetlifyConfig && !hasCloudflareFallback && !fs.existsSync(path.join(DIST, "_redirects"))) {
    fail("SPA fallback configuration is missing for Netlify/Cloudflare (audit L-4).");
  }
}

// ---------------------------------------------------------------------------
// 5. Cache-Control policy for hashed assets vs index.html (audit L-6).
// ---------------------------------------------------------------------------
if (fs.existsSync(headersPath)) {
  const headers = fs.readFileSync(headersPath, "utf8");
  if (!/cache-control/i.test(headers)) {
    fail(
      "dist/_headers declares no Cache-Control policy — a stale index.html served " +
        "from a CDN cache can point at the wrong API origin (audit L-6)."
    );
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
if (failures.length > 0) {
  console.error("\nverify-prod-build FAILED:\n");
  for (const f of failures) console.error(`  x ${f}`);
  console.error("");
  process.exit(1);
}
console.log(`verify-prod-build: OK (${assets.length} chunks checked)`);
