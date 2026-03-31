#!/bin/bash
# Daily full database backup — dumps Neon to ~/gc-portal-backups/ and uploads to portal.
# Run via cron: 0 2 * * * /Users/mike/gc-portal/scripts/backup-db.sh

set -e

BACKUP_DIR="$HOME/gc-portal-backups"
mkdir -p "$BACKUP_DIR"

DATE=$(date +%Y-%m-%d)
OUTFILE="$BACKUP_DIR/backup-$DATE.sql"
COMPANY_ID="cmmij161r000004jm8il8bd0e"
BASE_URL="https://gc-portal-two.vercel.app"

# Load env vars from .env
ENV_FILE="/Users/mike/gc-portal/.env"
DATABASE_URL=$(grep '^DATABASE_URL=' "$ENV_FILE" | sed 's/DATABASE_URL="\(.*\)"/\1/' | sed "s/DATABASE_URL='\(.*\)'/\1/")
CRON_SECRET=$(grep '^CRON_SECRET=' "$ENV_FILE" | sed 's/CRON_SECRET="\(.*\)"/\1/' | sed "s/CRON_SECRET='\(.*\)'/\1/" | sed 's/CRON_SECRET=\(.*\)/\1/')

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

# Upload backup to portal
echo "[$(date)] Uploading backup to portal…"
RESP=$(curl -s -w "\n%{http_code}" \
  -X POST "$BASE_URL/api/$COMPANY_ID/upload-backup" \
  -H "x-cron-secret: $CRON_SECRET" \
  -F "file=@$OUTFILE;type=application/sql")
HTTP_CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -1)
if [ "$HTTP_CODE" = "200" ]; then
  echo "[$(date)] Backup uploaded to portal — $BODY"
else
  echo "[$(date)] WARNING: Backup upload failed ($HTTP_CODE) — $BODY" >&2
fi
