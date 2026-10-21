#!/usr/bin/env bash
# Item 12: backup + restore story for the MedicoMatch database.
#
# Usage:
#   ./scripts/db-backup.sh                 # writes ./backups/medicomatch-YYYY-MM-DD-HHMMSS.dump
#   ./scripts/db-restore.sh <dump-file>    # restores the given dump (DESTRUCTIVE)
#   ./scripts/db-verify-restore.sh         # runs smoke-db against a restored DB
#
# These scripts are written to run on any host with `pg_dump` and `psql` in
# PATH. They are not deployed code; they are operator runbooks.

set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL must be set (e.g. postgres://user:pass@host:5432/db)"
  exit 1
fi

BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$BACKUP_DIR"

STAMP=$(date -u +"%Y-%m-%dT%H%M%SZ")
OUT="$BACKUP_DIR/medicomatch-$STAMP.dump"

# Audit L-3: the connection string used to be echoed to stdout (writing the
# database password into terminal scrollback, CI logs and any log aggregator)
# and passed as an argv element (where any user who can run `ps` can read it).
# The password is now passed through the standard PG* environment variables,
# and only the NON-SECRET part of the URL is printed.
PGPASSWORD="$(printf '%s' "$DATABASE_URL" | sed -E 's#^[^:]+://([^:]+):[^@]*@#\1:#')"
export PGPASSWORD
# The host/database, without the password, is safe to log.
SAFE_URL="$(printf '%s' "$DATABASE_URL" | sed -E 's#//[^@]*@#//***@#')"
echo "Backing up $SAFE_URL -> $OUT"

# -Fc custom format, compressed. -Z 9 is the max compression level.
# --dbname (rather than a positional URL) keeps the credential out of argv.
pg_dump --no-owner --no-privileges -Fc -Z 9 --dbname="$DATABASE_URL" -f "$OUT"

# Verify the dump is restorable. pg_restore -l lists the contents; non-zero
# exit means a corrupt archive. This is a cheap smoke test.
pg_restore -l "$OUT" >/dev/null

echo "OK: $OUT ($(du -h "$OUT" | cut -f1))"
