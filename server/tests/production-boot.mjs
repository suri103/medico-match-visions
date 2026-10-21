// ---------------------------------------------------------------------------
// Production boot matrix (audit M-43).
//
// Every other server suite runs with NODE_ENV=test, so the fail-closed
// production boot validation in src/index.mjs was NEVER executed by any CI
// gate. A typo in one of the `bootErrors.push(...)` lines would have shipped
// a server that boots happily in production with, for example, simulated
// payments enabled.
//
// This suite spawns the real server with NODE_ENV=production and asserts that
// it REFUSES to start for every reason the boot matrix lists, and that a
// correctly configured production env does NOT produce the refusal banner.
//
// Run: node tests/production-boot.mjs
// ---------------------------------------------------------------------------
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ENTRY = path.join(__dirname, "..", "src", "index.mjs");

// A fully valid production environment. Each case breaks exactly one field.
const VALID_ENV = {
  NODE_ENV: "production",
  PORT: "0",
  RAZORPAY_KEY_ID: "rzp_test_key",
  RAZORPAY_KEY_SECRET: "rzp_test_secret",
  RAZORPAY_WEBHOOK_SECRET: "whsec_test",
  APP_URL: "https://app.medicomatch.in",
  ACTIVATION_SECRET: "a-32-character-test-activation-secret",
  DATABASE_URL: "postgresql://postgres:pw@127.0.0.1:59999/postgres",
  RESEND_API_KEY: "re_test",
  CORS_ORIGINS: "https://app.medicomatch.in",
  // dotenv must not leak a developer's local server/.env into the matrix.
  DOTENV_CONFIG_PATH: path.join(__dirname, ".no-such-env-file"),
};

// Each case: [label, env overrides, expected substring of the refusal output].
const CASES = [
  ["missing Razorpay keys", { RAZORPAY_KEY_ID: "", RAZORPAY_KEY_SECRET: "" },
    "RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required in production."],
  ["simulated payments enabled", { RAZORPAY_SIMULATE: "true" },
    "RAZORPAY_SIMULATE must be unset/false in production."],
  ["missing APP_URL", { APP_URL: "" },
    "APP_URL is required in production"],
  ["non-https APP_URL", { APP_URL: "http://app.medicomatch.in" },
    "APP_URL must be an https:// origin in production."],
  ["missing ACTIVATION_SECRET", { ACTIVATION_SECRET: "" },
    "ACTIVATION_SECRET is required in production"],
  ["missing DATABASE_URL", { DATABASE_URL: "" },
    "DATABASE_URL is required in production"],
  ["missing RESEND_API_KEY", { RESEND_API_KEY: "" },
    "RESEND_API_KEY is required in production"],
  ["missing webhook secret", { RAZORPAY_WEBHOOK_SECRET: "" },
    "RAZORPAY_WEBHOOK_SECRET is required in production"],
  ["msg91 without an API key", { SMS_PROVIDER: "msg91", MSG91_API_KEY: "" },
    "SMS_PROVIDER=msg91 requires MSG91_API_KEY in production."],
  ["proof-of-work disabled", { DISABLE_POW: "true" },
    "DISABLE_POW must not be set in production"],
  ["engagement digest disabled", { DISABLE_DIGEST: "true" },
    "DISABLE_DIGEST must not be set in production"],
];

/**
 * Spawn the server with the given env and return { code, stderr }.
 * Resolves on process exit, or after `timeoutMs` with code === null when the
 * process is still running (the "it did not refuse to start" case).
 */
function boot(env, timeoutMs = 15000) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [SERVER_ENTRY], {
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    let stdout = "";
    let settled = false;
    const finish = (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, stderr, stdout });
    };
    child.stderr.on("data", (d) => { stderr += d.toString(); });
    child.stdout.on("data", (d) => { stdout += d.toString(); });
    child.on("exit", (code) => finish(code));
    child.on("error", () => finish(-1));
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(null);
    }, timeoutMs);
  });
}

let passed = 0;
let failed = 0;

const fail = (label, detail) => {
  failed++;
  console.error(`  x ${label}\n      ${detail}`);
};
const pass = (label) => {
  passed++;
  console.log(`  ok ${label}`);
};

console.log("Production boot matrix (NODE_ENV=production):");

for (const [label, overrides, expected] of CASES) {
  const env = { ...VALID_ENV, ...overrides };
  // Strip anything inherited from the ambient shell that could mask a case.
  for (const key of Object.keys(env)) {
    if (env[key] === undefined) delete env[key];
  }
  const { code, stderr } = await boot(env);
  if (stderr.includes("Refusing to start:") && stderr.includes(expected)) {
    pass(`refuses to start — ${label}`);
  } else {
    fail(
      `refuses to start — ${label}`,
      `expected exit=1 and stderr containing ${JSON.stringify(expected)}; ` +
        `got exit=${code} stderr=${JSON.stringify(stderr.slice(0, 400))}`
    );
  }
}

// Control: a fully valid production env must NOT print the refusal banner.
// The server will then fail on the unreachable database, which is a different
// (and expected) failure mode.
{
  const { code, stderr } = await boot({ ...VALID_ENV }, 12000);
  if (stderr.includes("Refusing to start:")) {
    fail(
      "valid production env does not trigger the refusal banner",
      `unexpected refusal banner: ${JSON.stringify(stderr.slice(0, 400))}`
    );
  } else {
    pass(`valid production env does not trigger the refusal banner (exit=${code})`);
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
