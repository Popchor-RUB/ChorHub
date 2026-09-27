#!/usr/bin/env bash
set -euo pipefail

REMOTE_USER="philipp"
REMOTE_HOST="alphanudel.de"
REMOTE_DIR="~/docker/chorhub_staging"

echo "==> Syncing files to ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR} ..."
rsync -av \
  --exclude ".DS_Store" \
  --exclude "node_modules" \
  --exclude ".git" \
  --exclude "pgdata" \
  --exclude "pgadmin-data" \
  --exclude "dist" \
  --exclude '.env*' \
  --exclude 'docker-compose.override.yml' \
  --exclude 'generated' \
  --exclude '.e2e-runs' \
  --exclude 'test-results' \
  --exclude '.playwright-mcp' \
  --exclude '.serena' \
  --progress \
  --delete \
  ./ "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/"

echo "==> Building and starting containers on remote ..."
ssh "${REMOTE_USER}@${REMOTE_HOST}" "cd ${REMOTE_DIR} && docker compose -f docker-compose.yml -f docker-compose.override.yml build && docker compose -f docker-compose.yml -f docker-compose.override.yml up -d"

echo "==> Deployment complete."
