#!/usr/bin/env bash
# fix-db-connection.sh (enhanced with DRY_RUN mode)
# Repairs backend DB connectivity on the EC2 instance:
#   1. Reads Terraform outputs for EC2 IP, RDS endpoint, DB name
#   2. Updates /opt/bookverse/.env with a correct DATABASE_URL
#   3. Runs `prisma migrate deploy` remotely
#   4. Runs optional seed (npm run seed) if present
#   5. Restarts (or starts) PM2 process `bookverse-backend`
#   6. Performs readiness checks (local + external)
#
# DRY RUN:
#   Set DRY_RUN=1 to only show planned values & commands (no SSH, no password required)
#
# Password sourcing:
#   - Preferred: export DB_PASS (not echoed)
#   - Alternative: export DB_PASS_FILE=/secure/path (file contents used if DB_PASS unset)
#
# Required (non-dry-run):
#   export SSH_KEY_PATH=~/path/to/key.pem
#   export DB_PASS='actual-rds-master-password'  (or set DB_PASS_FILE)
# Optional overrides:
#   export DB_USER=bookverse_admin (default)
#   export DB_NAME=bookverse_dev    (otherwise taken from terraform output database_name_value)
#
# Security: Password is never echoed; a masked form of DATABASE_URL is shown.
# NOTE: Long term move password to AWS SSM Parameter Store / Secrets Manager.

set -euo pipefail

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${BLUE}[*]${NC} $*"; }
ok()  { echo -e "${GREEN}[OK]${NC} $*"; }
warn(){ echo -e "${YELLOW}[WARN]${NC} $*"; }
err() { echo -e "${RED}[ERR]${NC} $*" 1>&2; }

DRY_RUN=${DRY_RUN:-0}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
TF_DIR="$ROOT_DIR/terraform"

if ! command -v terraform >/dev/null 2>&1; then
  err "Terraform not installed or not in PATH"; exit 1
fi

if [ "$DRY_RUN" != "1" ]; then
  if [ -z "${SSH_KEY_PATH:-}" ]; then
    err "SSH_KEY_PATH env var not set (path to your EC2 key .pem)"; exit 1
  fi
  if [ ! -f "$SSH_KEY_PATH" ]; then
    err "SSH key not found at $SSH_KEY_PATH"; exit 1
  fi
  # Support password file fallback
  if [ -z "${DB_PASS:-}" ] && [ -n "${DB_PASS_FILE:-}" ] && [ -f "$DB_PASS_FILE" ]; then
    DB_PASS="$(tr -d '\n' < "$DB_PASS_FILE")"
  fi
  if [ -z "${DB_PASS:-}" ]; then
    if [ -n "${DB_PASS_FILE:-}" ] && [ -f "$DB_PASS_FILE" ]; then
      DB_PASS="$(tr -d '\n' < "$DB_PASS_FILE")"
    elif [ -t 0 ]; then
      # Interactive prompt if running in a TTY
      echo -n "Enter RDS password (hidden): "
      # Use stty to hide input for portability
      old_stty_cfg=$(stty -g 2>/dev/null || true)
      stty -echo 2>/dev/null || true
      read -r DB_PASS || true
      stty "$old_stty_cfg" 2>/dev/null || true
      echo
      if [ -z "${DB_PASS}" ]; then
        err "No password entered"; exit 1
      fi
    else
      err "Please export DB_PASS or set DB_PASS_FILE with the correct RDS master password"; exit 1
    fi
  fi
else
  # Dry run tolerance
  if [ -z "${SSH_KEY_PATH:-}" ]; then
    warn "DRY_RUN=1: SSH_KEY_PATH not set (ok)"
  fi
  if [ -z "${DB_PASS:-}" ]; then
    if [ -n "${DB_PASS_FILE:-}" ]; then
      warn "DRY_RUN=1: DB_PASS_FILE provided but ignoring in dry run"
    else
      warn "DRY_RUN=1: DB_PASS not set (ok)"
    fi
  fi
fi

DB_USER="${DB_USER:-bookverse_admin}"
DB_NAME_OVERRIDE="${DB_NAME:-}"  # optional manual override via env DB_NAME

pushd "$TF_DIR" >/dev/null
EC2_IP=$(terraform output -raw backend_instance_public_ip 2>/dev/null || true)
RDS_ENDPOINT=$(terraform output -raw rds_endpoint 2>/dev/null || true)
TF_DB_NAME=$(terraform output -raw database_name_value 2>/dev/null || true)
popd >/dev/null

if [ -z "$EC2_IP" ] || [ -z "$RDS_ENDPOINT" ]; then
  err "Missing Terraform outputs (ensure terraform apply completed)."; exit 1
fi

DB_NAME_USE=${DB_NAME_OVERRIDE:-$TF_DB_NAME}
if [ -z "$DB_NAME_USE" ]; then
  warn "Database name not found in outputs; defaulting to bookverse"
  DB_NAME_USE=bookverse
fi

log "EC2 IP         : $EC2_IP"
log "RDS Endpoint   : $RDS_ENDPOINT"
log "DB User        : $DB_USER"
log "DB Name        : $DB_NAME_USE"

MASKED="postgresql://$DB_USER:****@$RDS_ENDPOINT/$DB_NAME_USE?sslmode=require"
log "Will apply DATABASE_URL => $MASKED"

if [ "$DRY_RUN" = "1" ]; then
  echo
  ok "DRY RUN complete. No remote changes made."
  cat <<EODRY
To execute for real run:
  export SSH_KEY_PATH=~/keys/your-key.pem
  # Either export DB_PASS directly OR create a password file:
  #   echo -n 'YourPasswordHere' > ~/.bookverse-db-pass && chmod 600 ~/.bookverse-db-pass
  #   export DB_PASS_FILE=~/.bookverse-db-pass
  # Then run:
  #   bash $SCRIPT_DIR/fix-db-connection.sh
  # Optional overrides:
  # export DB_USER=bookverse_admin
  # export DB_NAME=$DB_NAME_USE
EODRY
  exit 0
fi

log "Building remote remediation script (password will NOT be logged)"

read -r -d '' REMOTE_SCRIPT <<'__REMOTE__'
set -euo pipefail
cd /opt/bookverse || { echo "[remote][ERR] /opt/bookverse missing" >&2; exit 1; }

echo "[remote] Working dir: $(pwd)"

if [ ! -f .env ]; then
  if [ -f .env.production ]; then
    cp .env.production .env
    echo "[remote] Created .env from .env.production"
  else
    touch .env
    echo "[remote] Created new .env"
  fi
fi

grep -q '^DATABASE_URL=' .env && sed -i "s|^DATABASE_URL=.*||" .env || true
echo "DATABASE_URL=postgresql://__DB_USER__:__DB_PASS__@__RDS_ENDPOINT__/__DB_NAME__?sslmode=require" >> .env
grep -q '^NODE_ENV=' .env || echo "NODE_ENV=production" >> .env

echo "[remote] Updated .env (sanitized):"
awk -F= '/^DATABASE_URL=/{gsub(/:[^@]*@/,":****@",$2); print "DATABASE_URL=" $2}' .env

export DATABASE_URL="postgresql://__DB_USER__:__DB_PASS__@__RDS_ENDPOINT__/__DB_NAME__?sslmode=require"
export NODE_ENV=production

if ! command -v npx >/dev/null 2>&1; then
  echo "[remote][ERR] npx not found - Node/NPM may not be installed" >&2
  exit 1
fi

echo "[remote] Running prisma migrate deploy"
npx prisma migrate deploy || { echo "[remote][ERR] migrate failed" >&2; exit 1; }

echo "[remote] Attempting seed (if seed script exists)"
if npm run | grep -q '^  seed'; then
  npm run seed || echo "[remote][WARN] Seed failed (continuing)"
else
  echo "[remote] No seed script defined"
fi

echo "[remote] Restarting PM2 process"
if command -v pm2 >/dev/null 2>&1; then
  if pm2 list | grep -q bookverse-backend; then
    pm2 restart bookverse-backend || pm2 delete bookverse-backend || true
  fi
  if ! pm2 list | grep -q bookverse-backend; then
    if [ -f dist/index.js ]; then
      pm2 start dist/index.js --name bookverse-backend
    else
      echo "[remote][WARN] dist/index.js not found; cannot start process" >&2
    fi
  fi
else
  echo "[remote][ERR] pm2 not installed" >&2
fi

sleep 4
echo "[remote] Local readiness check:"
if command -v curl >/dev/null 2>&1; then
  curl -sf http://localhost:3001/ready || echo "[remote][WARN] readiness endpoint not OK"
else
  echo "[remote][WARN] curl unavailable for readiness check"
fi
echo "[remote] Verifying DB connectivity via psql (SELECT 1)"
if ! command -v psql >/dev/null 2>&1; then
  if command -v amazon-linux-extras >/dev/null 2>&1; then
    amazon-linux-extras enable postgresql15 >/dev/null 2>&1 || amazon-linux-extras enable postgresql14 >/dev/null 2>&1 || true
  fi
  yum -y install postgresql15 >/dev/null 2>&1 || yum -y install postgresql14 >/dev/null 2>&1 || yum -y install postgresql >/dev/null 2>&1 || true
fi
if command -v psql >/dev/null 2>&1; then
  # parse DB parts for a clean psql call (avoid exposing password)
  URL_NO_PROTO="${DATABASE_URL#postgresql://}"
  CREDS_PART="${URL_NO_PROTO%%@*}"
  HOST_DB_PART="${URL_NO_PROTO#*@}"
  DB_HOST_PORT="${HOST_DB_PART%%/*}"
  DB_NAME_ONLY="${HOST_DB_PART#*/}"
  DB_NAME_ONLY="${DB_NAME_ONLY%%\?*}"
  DB_USER_ONLY="${CREDS_PART%%:*}"
  DB_PASS_ONLY="${CREDS_PART#*:}"
  DB_HOST_ONLY="${DB_HOST_PORT%%:*}"
  DB_PORT_ONLY="${DB_HOST_PORT#*:}"
  if [ "$DB_PORT_ONLY" = "$DB_HOST_ONLY" ]; then DB_PORT_ONLY=5432; fi
  ( export PGPASSWORD="$DB_PASS_ONLY"; psql -h "$DB_HOST_ONLY" -p "$DB_PORT_ONLY" -U "$DB_USER_ONLY" -d "$DB_NAME_ONLY" -c 'SELECT 1;' >/dev/null 2>&1 && echo "[remote][psql] SELECT 1 success" || echo "[remote][psql][WARN] psql connectivity failed" )
else
  echo "[remote][psql][WARN] psql client not available"
fi
__REMOTE__

REMOTE_FILLED=$(echo "$REMOTE_SCRIPT" | \
  sed "s|__DB_USER__|$DB_USER|g" | \
  sed "s|__RDS_ENDPOINT__|$RDS_ENDPOINT|g" | \
  sed "s|__DB_NAME__|$DB_NAME_USE|g" | \
  sed "s|__DB_PASS__|$DB_PASS|g")

log "Connecting to EC2 and applying changes..."
SSH_OPTS="-o StrictHostKeyChecking=no -i $SSH_KEY_PATH"
if ! ssh $SSH_OPTS ec2-user@"$EC2_IP" 'echo connection-ok' >/dev/null 2>&1; then
  err "SSH connection failed (check IP/key/security group)"; exit 1
fi

ssh $SSH_OPTS ec2-user@"$EC2_IP" "bash -s" <<EOF_REMOTE2
$REMOTE_FILLED
EOF_REMOTE2

oh() { ok "$*"; }
oh "Remote remediation completed"

log "External readiness check (public IP)"
if curl -sf "http://$EC2_IP:3001/ready" >/dev/null 2>&1; then
  curl -s "http://$EC2_IP:3001/ready"; echo
  ok "Readiness endpoint reachable from local machine"
else
  warn "Could not reach readiness endpoint from local machine (security group or app issue)"
fi

cat <<EONOTE
Next steps:
  1. Verify via CDN (if configured):   curl -s https://<cdn_domain>/api/ready
  2. Fetch books:                      curl -s http://$EC2_IP:3001/books || curl -s http://$EC2_IP:3001/api/books
  3. If readiness still degraded, inspect logs:
         ssh -i $SSH_KEY_PATH ec2-user@$EC2_IP 'pm2 logs --lines 50'
  4. Commit this script update if not already.

Security: Password was not logged; rotate into AWS SSM / Secrets Manager soon.
EONOTE

ok "All done"