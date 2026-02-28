#!/usr/bin/env bash
set -euo pipefail

REMOTE_USER="philipp"
REMOTE_HOST="alphanudel.de"
REMOTE_DIR="~/docker/chorhub"

echo "==> Syncing files to ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR} ..."
rsync -av \
  --exclude ".DS_Store" \
  --exclude "node_modules" \
  --exclude ".git" \
  --progress \
  --delete \
  ./ "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/"

echo "==> Building and starting containers on remote ..."
ssh "${REMOTE_USER}@${REMOTE_HOST}" "cd ${REMOTE_DIR} && docker compose build && docker compose up -d"

echo "==> Deployment complete."
