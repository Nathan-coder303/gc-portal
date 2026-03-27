#!/bin/bash
# Daily full database backup — dumps Neon to ~/gc-portal-backups/
# Keeps only the most recent backup (deletes previous ones).
# Run via cron: 0 2 * * * /Users/mike/gc-portal/scripts/backup-db.sh

set -e

BACKUP_DIR="$HOME/gc-portal-backups"
mkdir -p "$BACKUP_DIR"

DATE=$(date +%Y-%m-%d)
OUTFILE="$BACKUP_DIR/backup-$DATE.sql"

# Load DATABASE_URL from .env
ENV_FILE="/Users/mike/gc-portal/.env"
DATABASE_URL=$(grep '^DATABASE_URL=' "$ENV_FILE" | sed 's/DATABASE_URL="\(.*\)"/\1/' | sed "s/DATABASE_URL='\(.*\)'/\1/")

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL not found in $ENV_FILE" >&2
  exit 1
fi

echo "[$(date)] Starting backup → $OUTFILE"

# Delete all previous backups first
find "$BACKUP_DIR" -name "backup-*.sql" -not -name "backup-$DATE.sql" -delete

# Dump the database
/opt/homebrew/opt/postgresql@17/bin/pg_dump "$DATABASE_URL" \
  --no-password \
  --format=plain \
  --no-owner \
  --no-acl \
  --file="$OUTFILE"

SIZE=$(du -sh "$OUTFILE" | cut -f1)
echo "[$(date)] Backup complete — $SIZE → $OUTFILE"

# Write a status file the app can read
echo "{\"date\":\"$DATE\",\"file\":\"$OUTFILE\",\"size\":\"$SIZE\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" \
  > "$BACKUP_DIR/last-backup.json"
