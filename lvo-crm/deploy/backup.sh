#!/bin/sh
# Sauvegarde quotidienne du CRM : dump Postgres + volumes data/uploads/MinIO.
# Cron (utilisateur de déploiement) :
#   30 2 * * * /opt/lvo-crm/deploy/backup.sh >> /var/log/lvo-backup.log 2>&1
set -eu

DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/lvo-crm}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"
DEST="$BACKUP_DIR/$STAMP"
COMPOSE="docker compose -f $DEPLOY_DIR/docker-compose.prod.yml --project-directory $DEPLOY_DIR"

mkdir -p "$DEST"

echo "[$STAMP] pg_dump"
$COMPOSE exec -T postgres pg_dump -U lvo_crm -d lvo_crm --format=custom > "$DEST/lvo_crm.dump"

# Volumes nommés : préfixés par le nom du projet (`name: lvo-crm` dans le compose).
PROJECT=lvo-crm
for vol in crm_data crm_uploads minio_data; do
  echo "[$STAMP] volume $vol"
  docker run --rm -v "${PROJECT}_${vol}:/src:ro" -v "$DEST:/dest" alpine \
    tar czf "/dest/${vol}.tar.gz" -C /src .
done

find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -mtime +"$KEEP_DAYS" -exec rm -rf {} +
echo "[$STAMP] OK → $DEST"
