#!/usr/bin/env bash
# Item 12: DESTRUCTIVE restore from a pg_dump custom-format archive. Refuses
# to run unless the operator types the literal phrase "RESTORE" to confirm
# intent. Restores into the URL in DATABASE_URL (or a fresh DB you create
# first).
set -euo pipefail

DUMP="${1:-}"
if [ -z "$DUMP" ]; then
  echo "Usage: $0 <dump-file> [target-DATABASE_URL]"
  exit 1
fi
if [ ! -f "$DUMP" ]; then
  echo "ERROR: dump file not found: $DUMP"
  exit 1
fi

TARGET_URL="${2:-${DATABASE_URL:-}}"
if [ -z "$TARGET_URL" ]; then
  echo "ERROR: DATABASE_URL (or second arg) must be set"
  exit 1
fi

# Audit L-3: the target URL used to be echoed to stdout (writing the database
# password into terminal scrollback and CI logs) and passed as an argv element
# (visible to anything that can run `ps`). Only the non-secret part is printed,
# and the credential is passed through PGPASSWORD.
SAFE_TARGET="$(printf '%s' "$TARGET_URL" | sed -E 's#//[^@]*@#//***@#')"
echo "WARNING: This will REPLACE all data in: $SAFE_TARGET"
echo "Source dump: $DUMP"
read -r -p 'Type RESTORE to continue: ' CONFIRM
if [ "$CONFIRM" != "RESTORE" ]; then
  echo "Aborted."
  exit 1
fi

PGPASSWORD="$(printf '%s' "$TARGET_URL" | sed -E 's#^[^:]+://([^:]+):[^@]*@#\1:#')"
export PGPASSWORD

# Drop & recreate the public schema so we don't collide with FK chains mid-
# restore. Then run the dump. --clean --if-existent matches what pg_dump
# -Fc produces by default; we use --no-owner to match our backup script.
echo "Dropping public schema..."
psql --dbname="$TARGET_URL" -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO PUBLIC;"

echo "Restoring from $DUMP..."
pg_restore --no-owner --no-privileges --dbname="$TARGET_URL" "$DUMP"

# Re-apply idempotent DDL. The dump contains DDL but it was captured at
# backup time, so any drift in schema.sql (additive changes since the
# backup) won't be present. Re-running migrate() brings the restored DB up
# to the current schema.
echo "Re-applying schema.sql via migrate()..."
DATABASE_URL="$TARGET_URL" NODE_ENV=production node -e "
  import('./src/db.mjs').then(async (m) => {
    await m.migrate();
    process.exit(0);
  }).catch((e) => { console.error(e); process.exit(1); });
"

echo "OK: restored. Run scripts/db-verify-restore.sh to confirm."
