#!/usr/bin/env bash
# Item 12: verify a restored DB by running the wired-backend smoke test
# against it. Use this after db-restore.sh to prove the restored data is
# consistent and the schema is current.
set -euo pipefail

if [ -z "${TEST_DATABASE_URL:-}" ]; then
  echo "Usage: TEST_DATABASE_URL=postgres://... $0"
  exit 1
fi

# Guard against running against a non-disposable URL (same guard as smoke-db).
echo "$TEST_DATABASE_URL" | grep -qE '(localhost|127\.0\.0\.1|::1|_test([/:]|$)|medicomatch_test)' || {
  echo "Refusing: TEST_DATABASE_URL must be loopback or *_test"
  exit 1
}

echo "Running smoke-db against $TEST_DATABASE_URL..."
cd "$(dirname "$0")/.."
TEST_DATABASE_URL="$TEST_DATABASE_URL" node tests/smoke-db.mjs
