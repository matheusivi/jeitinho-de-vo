#!/bin/sh
# Backup diário do banco. Coloque no cron do servidor, por exemplo:
#   15 3 * * * cd /caminho/jeitinho-de-vo && ./scripts/backup.sh >> backups/backup.log 2>&1
set -eu
cd "$(dirname "$0")/.."
mkdir -p backups
STAMP=$(date +%Y-%m-%d_%H%M)
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "backups/jdv_$STAMP.dump"
# guarda 14 dias
find backups -name 'jdv_*.dump' -mtime +14 -delete
echo "Backup ok: backups/jdv_$STAMP.dump"
