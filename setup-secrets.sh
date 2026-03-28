#!/usr/bin/env bash
# setup-secrets.sh — generates all required .env files and project-root symlinks.
# Safe to re-run: prompts before overwriting existing files.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── helpers ──────────────────────────────────────────────────────────────────

generate_secret() {
  openssl rand -base64 48 | tr -d '/+=\n' | head -c 64
}

prompt() {
  local var_name="$1"
  local prompt_text="$2"
  local default="$3"
  local value
  read -rp "${prompt_text} [${default}]: " value
  echo "${value:-$default}"
}

prompt_secret() {
  local var_name="$1"
  local prompt_text="$2"
  local value
  read -rsp "${prompt_text}: " value
  echo
  echo "$value"
}

confirm_overwrite() {
  local file="$1"
  if [[ -f "$file" ]]; then
    local answer
    read -rp "$(echo -e "\033[33mWarning:\033[0m $file already exists. Overwrite? [y/N] ")" answer
    [[ "${answer,,}" == "y" ]]
  else
    return 0
  fi
}

# ── preflight ─────────────────────────────────────────────────────────────────

if ! command -v openssl &>/dev/null; then
  echo "Error: openssl is required but not found." >&2
  exit 1
fi

if ! command -v node &>/dev/null; then
  echo "Error: Node.js is required for VAPID key generation." >&2
  exit 1
fi

if [[ ! -f "$SCRIPT_DIR/backend/node_modules/web-push/src/index.js" ]]; then
  echo "Error: web-push not found. Run 'npm install' in backend/ first." >&2
  exit 1
fi

echo ""
echo "=== ChorHub Secret Setup ==="
echo "This script generates .env.db, .env.backend, and frontend/.env.* files."
echo "All values with [defaults] can be left empty to use the default."
echo ""

# ── deployment config ─────────────────────────────────────────────────────────

APP_URL=$(prompt APP_URL "App URL (used in magic links)" "https://example.com/chorhub/")
VITE_API_URL_PROD=$(prompt VITE_API_URL_PROD "Frontend API URL (production)" "https://example.com/chorhub/api")
VITE_BASE_PATH_PROD=$(prompt VITE_BASE_PATH_PROD "Frontend base path (production)" "/chorhub/")
MAIL_FROM=$(prompt MAIL_FROM "Mail from address" "noreply@chorhub.de")
VAPID_EMAIL=$(prompt VAPID_EMAIL "VAPID contact email" "mailto:admin@chorhub.de")

echo ""
echo "SMTP settings (leave empty to use MailHog defaults):"
SMTP_HOST=$(prompt SMTP_HOST "SMTP host" "mailhog")
SMTP_PORT=$(prompt SMTP_PORT "SMTP port" "1025")
SMTP_SECURE=$(prompt SMTP_SECURE "Use implicit TLS / secure SMTP on port 465 (true/false)" "false")
SMTP_USER=$(prompt SMTP_USER "SMTP username" "")
SMTP_PASS=$(prompt_secret SMTP_PASS "SMTP password (hidden)")
IS_STAGING=$(prompt IS_STAGING "Enable staging mode (true/false)" "false")

# ── generate secrets ──────────────────────────────────────────────────────────

echo ""
echo "Generating secrets..."

PG_PASS=$(generate_secret)
JWT_SECRET=$(generate_secret)

VAPID_LINES=$(cd "$SCRIPT_DIR/backend" && node -e "
  const wp = require('web-push');
  const k = wp.generateVAPIDKeys();
  console.log(k.publicKey);
  console.log(k.privateKey);
")
VAPID_PUBLIC_KEY=$(echo "$VAPID_LINES" | head -1)
VAPID_PRIVATE_KEY=$(echo "$VAPID_LINES" | tail -1)

CHECKIN_KEY_LINES=$(node -e "
  const { generateKeyPairSync } = require('crypto');
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const privateDer = privateKey.export({ format: 'der', type: 'pkcs8' });
  const publicDer = publicKey.export({ format: 'der', type: 'spki' });
  console.log(Buffer.from(privateDer).toString('base64'));
  console.log(Buffer.from(publicDer).toString('base64'));
")
QR_CHECKIN_PRIVATE_KEY_BASE64=$(echo "$CHECKIN_KEY_LINES" | head -1)
QR_CHECKIN_PUBLIC_KEY_BASE64=$(echo "$CHECKIN_KEY_LINES" | tail -1)

# ── write .env.db ─────────────────────────────────────────────────────────────

ENV_DB="$SCRIPT_DIR/.env.db"
if confirm_overwrite "$ENV_DB"; then
  cat > "$ENV_DB" <<EOF
POSTGRES_USER=chorhub
POSTGRES_PASSWORD=${PG_PASS}
POSTGRES_DB=chorhub
EOF
  echo "  Written: .env.db"
fi

# ── write .env.backend ────────────────────────────────────────────────────────

ENV_BACKEND="$SCRIPT_DIR/.env.backend"
if confirm_overwrite "$ENV_BACKEND"; then
  cat > "$ENV_BACKEND" <<EOF
DATABASE_URL=postgresql://chorhub:${PG_PASS}@db:5432/chorhub
JWT_SECRET=${JWT_SECRET}
SMTP_HOST=${SMTP_HOST}
SMTP_PORT=${SMTP_PORT}
SMTP_SECURE=${SMTP_SECURE}
SMTP_USER=${SMTP_USER}
SMTP_PASS=${SMTP_PASS}
MAIL_FROM=${MAIL_FROM}
APP_URL=${APP_URL}
IS_STAGING=${IS_STAGING}
NODE_ENV=production
VAPID_PUBLIC_KEY=${VAPID_PUBLIC_KEY}
VAPID_PRIVATE_KEY=${VAPID_PRIVATE_KEY}
VAPID_EMAIL=${VAPID_EMAIL}
QR_CHECKIN_PRIVATE_KEY_BASE64=${QR_CHECKIN_PRIVATE_KEY_BASE64}
QR_CHECKIN_PUBLIC_KEY_BASE64=${QR_CHECKIN_PUBLIC_KEY_BASE64}
EOF
  echo "  Written: .env.backend"
fi

# ── write frontend/.env.development ───────────────────────────────────────────

ENV_FRONTEND_DEV="$SCRIPT_DIR/frontend/.env.development"
if confirm_overwrite "$ENV_FRONTEND_DEV"; then
  cat > "$ENV_FRONTEND_DEV" <<EOF
VITE_API_URL=http://localhost:5173/api
VITE_BASE_PATH=/
VITE_FORCE_IOS_PWA=1
EOF
  echo "  Written: frontend/.env.development"
fi

# ── write frontend/.env.production ────────────────────────────────────────────

ENV_FRONTEND_PROD="$SCRIPT_DIR/frontend/.env.production"
if confirm_overwrite "$ENV_FRONTEND_PROD"; then
  cat > "$ENV_FRONTEND_PROD" <<EOF
VITE_API_URL=${VITE_API_URL_PROD}
VITE_BASE_PATH=${VITE_BASE_PATH_PROD}
VITE_FORCE_IOS_PWA=1
EOF
  echo "  Written: frontend/.env.production"
fi

# ── symlinks in project root ──────────────────────────────────────────────────

ln -sf frontend/.env.development "$SCRIPT_DIR/.env.frontend.dev"
ln -sf frontend/.env.production  "$SCRIPT_DIR/.env.frontend"
echo "  Symlinked: .env.frontend.dev -> frontend/.env.development"
echo "  Symlinked: .env.frontend -> frontend/.env.production"

# ── done ──────────────────────────────────────────────────────────────────────

echo ""
echo "Done! Next steps:"
echo ""
echo "  Development:"
echo "    docker compose -f docker-compose.dev.yaml up -d"
echo "    cd backend && npm run start:dev"
echo "    cd frontend && npm run dev"
echo ""
echo "  Production:"
echo "    cp docker-compose.override.yml.example docker-compose.override.yml"
echo "    # Edit docker-compose.override.yml to match your domain / Traefik config"
echo "    docker compose up -d"
