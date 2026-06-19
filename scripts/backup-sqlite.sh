#!/usr/bin/env bash
set -euo pipefail

# Backup script for Quantix SQLite database
# - Safe backup using sqlite3 .backup if available
# - Writes backups to BACKUP_DIR (default /home/ubuntu/db-backups)
# - Names: custom-YYYY-MM-DD.db
# - Keeps last 30 days
# - Optional S3 upload when S3_BUCKET env is set and aws CLI is configured

DB_PATH="/home/ubuntu/data/custom.db"
BACKUP_DIR="/home/ubuntu/db-backups"
LOGFILE="$BACKUP_DIR/backup.log"
TS=$(date -u +"%Y-%m-%d")
FNAME="custom-${TS}.db"
DEST_TMP="$BACKUP_DIR/${FNAME}.tmp"
DEST="$BACKUP_DIR/${FNAME}"
RETAIN_DAYS=30

mkdir -p "$BACKUP_DIR"
touch "$LOGFILE"
chmod 700 "$BACKUP_DIR" || true

echo "[$(date -u +'%Y-%m-%d %H:%M:%S %Z')] Starting backup" | tee -a "$LOGFILE"

if [ ! -f "$DB_PATH" ]; then
  echo "[$(date -u +'%Y-%m-%d %H:%M:%S %Z')] ERROR: DB not found at $DB_PATH" | tee -a "$LOGFILE"
  exit 2
fi

# Prefer sqlite3 .backup for a safe online backup
if command -v sqlite3 >/dev/null 2>&1; then
  echo "[$(date -u +'%Y-%m-%d %H:%M:%S %Z')] Using sqlite3 .backup to create $DEST_TMP" | tee -a "$LOGFILE"
  # use a temporary file and then atomically move into place
  sqlite3 "$DB_PATH" ".backup '$DEST_TMP'" || { echo "[$(date -u +'%Y-%m-%d %H:%M:%S %Z')] ERROR: sqlite3 backup failed" | tee -a "$LOGFILE"; rm -f "$DEST_TMP" || true; exit 3; }
else
  echo "[$(date -u +'%Y-%m-%d %H:%M:%S %Z')] WARNING: sqlite3 not found, using cp (less safe)" | tee -a "$LOGFILE"
  cp --archive --preserve=mode,ownership,timestamps "$DB_PATH" "$DEST_TMP" || { echo "[$(date -u +'%Y-%m-%d %H:%M:%S %Z')] ERROR: cp failed" | tee -a "$LOGFILE"; rm -f "$DEST_TMP" || true; exit 4; }
fi

mv -f "$DEST_TMP" "$DEST"
chmod 600 "$DEST"

if [ -f "$DEST" ]; then
  echo "[$(date -u +'%Y-%m-%d %H:%M:%S %Z')] SUCCESS: backup created $DEST" | tee -a "$LOGFILE"
else
  echo "[$(date -u +'%Y-%m-%d %H:%M:%S %Z')] ERROR: backup file missing after move" | tee -a "$LOGFILE"
  exit 5
fi

# Keep only last $RETAIN_DAYS backups
echo "[$(date -u +'%Y-%m-%d %H:%M:%S %Z')] Cleaning up backups older than $RETAIN_DAYS days" | tee -a "$LOGFILE"
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'custom-*.db' -mtime +$((RETAIN_DAYS-1)) -print -exec rm -f {} \; | tee -a "$LOGFILE" || true

# Optional: upload to S3 if S3_BUCKET set
if [ -n "${S3_BUCKET:-}" ] && command -v aws >/dev/null 2>&1; then
  S3_KEY="backups/$(basename "$DEST")"
  echo "[$(date -u +'%Y-%m-%d %H:%M:%S %Z')] Uploading $DEST to s3://$S3_BUCKET/$S3_KEY" | tee -a "$LOGFILE"
  if aws s3 cp "$DEST" "s3://$S3_BUCKET/$S3_KEY" --only-show-errors; then
    echo "[$(date -u +'%Y-%m-%d %H:%M:%S %Z')] S3 upload success" | tee -a "$LOGFILE"
  else
    echo "[$(date -u +'%Y-%m-%d %H:%M:%S %Z')] WARNING: S3 upload failed" | tee -a "$LOGFILE"
  fi
fi

echo "[$(date -u +'%Y-%m-%d %H:%M:%S %Z')] Backup run complete" | tee -a "$LOGFILE"

exit 0
