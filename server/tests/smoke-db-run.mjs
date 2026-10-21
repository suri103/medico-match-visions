// DB-mode e2e driver: boots an EMBEDDED Postgres (Windows binary shipped in
// node_modules) so this suite can run without a container/service. CI keeps
// using the actions service container; locally `node tests/smoke-db-run.mjs`
// (this file) provisions the database, exports TEST_DATABASE_URL, and runs
// tests/smoke-db.mjs as a child, then tears everything down.
import EmbeddedPostgres from "embedded-postgres";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 54329; // dedicated; avoid the CI service port
const DATA_DIR = path.join(os.tmpdir(), `mm-epg-${process.pid}-${Date.now()}`);
const DB_NAME = "medicomatch_test";

const pg = new EmbeddedPostgres({
  databaseDir: DATA_DIR,
  user: "postgres",
  password: "testpass",
  port: PORT,
  persistent: false,
});

const _wait = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  await pg.initialise();
  await pg.start();
  await pg.createDatabase(DB_NAME);
  console.log(`embedded-postgres up on :${PORT}/${DB_NAME}`);
} catch (err) {
  console.error("embedded-postgres failed to start:", err);
  process.exit(1);
}

const url = `postgres://postgres:testpass@127.0.0.1:${PORT}/${DB_NAME}`;
// smoke-db refuses non-loopback/non-*_test URLs; this one satisfies both.
// Spawn with the ABSOLUTE script path (cwd is the server root so the child's
// own server-spawn cwd math stays valid).
const child = spawn(process.execPath, [path.join(__dirname, "smoke-db.mjs")], {
  cwd: path.join(__dirname, ".."),
  env: { ...process.env, TEST_DATABASE_URL: url },
  stdio: "inherit",
});

const code = await new Promise((resolve) => child.on("close", resolve));

try {
  await pg.stop();
} catch {}
try {
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
} catch {}
process.exit(code);