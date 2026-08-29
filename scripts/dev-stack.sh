#!/bin/bash
# scripts/dev-stack.sh
# Demarre l'infrastructure locale.
#
# Cette machine n'a pas Docker. Les trois services du docker-compose.yml
# tournent donc en natif, avec les memes identifiants et les memes ports :
# PostgreSQL et Redis via Homebrew, MinIO en processus autonome.
# Le docker-compose reste la reference pour la production.

set -e
MINIO_DATA="$HOME/.memora-minio"

echo "PostgreSQL..."
brew services start postgresql@17 >/dev/null 2>&1 || true

echo "Redis..."
brew services start redis >/dev/null 2>&1 || true

echo "MinIO..."
if ! curl -sf http://localhost:9000/minio/health/live >/dev/null 2>&1; then
  mkdir -p "$MINIO_DATA"
  MINIO_ROOT_USER=memora MINIO_ROOT_PASSWORD=memora-secret \
    nohup /opt/homebrew/opt/minio/bin/minio server \
    --address=:9000 --console-address=:9001 "$MINIO_DATA" \
    >/tmp/memora-minio.log 2>&1 &
  sleep 3
fi

echo
printf 'PostgreSQL  '; pg_isready -h localhost -q && echo 'pret' || echo 'INDISPONIBLE'
printf 'Redis       '; [ "$(redis-cli ping 2>/dev/null)" = PONG ] && echo 'pret' || echo 'INDISPONIBLE'
printf 'MinIO       '; curl -sf http://localhost:9000/minio/health/live >/dev/null && echo 'pret' || echo 'INDISPONIBLE'
echo
echo "Ensuite : pnpm dev      (API sur 3000, client sur 5173)"
echo "Invite  : http://localhost:5173/e/mariage-de-lea-et-sam-demo01"
echo "Console MinIO : http://localhost:9001  (memora / memora-secret)"
