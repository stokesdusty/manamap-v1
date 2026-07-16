#!/usr/bin/env bash
set -euo pipefail

: "${BACKUP_DATABASE_URL:?BACKUP_DATABASE_URL is required}"
: "${BACKUP_R2_ACCOUNT_ID:?BACKUP_R2_ACCOUNT_ID is required}"
: "${BACKUP_R2_BUCKET:?BACKUP_R2_BUCKET is required}"

RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
ENDPOINT_URL="https://${BACKUP_R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
PREFIX="manamap"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DUMP_FILE="/tmp/manamap-${TIMESTAMP}.dump"

echo "Dumping database..."
pg_dump --format=custom --file="$DUMP_FILE" "$BACKUP_DATABASE_URL"

echo "Uploading ${TIMESTAMP}.dump to R2..."
aws s3 cp "$DUMP_FILE" "s3://${BACKUP_R2_BUCKET}/${PREFIX}/${TIMESTAMP}.dump" --endpoint-url "$ENDPOINT_URL"
rm -f "$DUMP_FILE"

echo "Pruning backups older than ${RETENTION_DAYS} days..."
cutoff_epoch="$(date -u -d "${RETENTION_DAYS} days ago" +%s)"

keys="$(aws s3api list-objects-v2 \
  --bucket "$BACKUP_R2_BUCKET" \
  --prefix "${PREFIX}/" \
  --endpoint-url "$ENDPOINT_URL" \
  --query 'Contents[].Key' \
  --output text 2>/dev/null || true)"

if [ -n "$keys" ] && [ "$keys" != "None" ]; then
  for key in $keys; do
    name="$(basename "$key")"
    ts="${name%.dump}"
    obj_date="${ts:0:4}-${ts:4:2}-${ts:6:2} ${ts:9:2}:${ts:11:2}:${ts:13:2}"
    obj_epoch="$(date -u -d "$obj_date" +%s 2>/dev/null || echo 0)"
    if [ "$obj_epoch" -gt 0 ] && [ "$obj_epoch" -lt "$cutoff_epoch" ]; then
      echo "Deleting expired backup: $key"
      aws s3 rm "s3://${BACKUP_R2_BUCKET}/${key}" --endpoint-url "$ENDPOINT_URL"
    fi
  done
fi

echo "Backup complete: ${PREFIX}/${TIMESTAMP}.dump"
