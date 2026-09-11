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

echo "Backing up $DATABASE_URL -> $OUT"
# -Fc custom format, compressed. -Z 9 is the max compression level.
pg_dump --no-owner --no-privileges -Fc -Z 9 "$DATABASE_URL" -f "$OUT"

# Verify the dump is restorable. pg_restore -l lists the contents; non-zero
# exit means a corrupt archive. This is a cheap smoke test.
pg_restore -l "$OUT" >/dev/null

echo "OK: $OUT ($(du -h "$OUT" | cut -f1))"
