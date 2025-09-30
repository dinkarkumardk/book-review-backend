#!/usr/bin/env bash
# diagnose-db.sh
# Deep diagnostic for backend DB connectivity from the EC2 instance.
#  - Reads terraform outputs (EC2 public IP, RDS endpoint)
#  - SSH to EC2 and:
#      * Shows sanitized DATABASE_URL from /opt/bookverse/.env
#      * Attempts a lightweight Prisma connection/query (SELECT 1)
#      * Installs a modern psql client if missing (postgresql15 or 14)
#      * Runs psql SELECT 1 using the DATABASE_URL credentials
#      * Prints clear PASS/FAIL summary
#  - Exits non‑zero if both Prisma and psql fail so scripts can detect failure.
#
# Requirements:
#   export SSH_KEY_PATH=~/path/to/key.pem
#   (Terraform already applied; terraform outputs available)
# Optional:
#   DRY_RUN=1 to only show planned operations (no SSH)
#
# NOTE: Password is never echoed. psql uses env PGPASSWORD derived from DATABASE_URL inside the instance only.

set -euo pipefail
BLUE='\033[0;34m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log(){ echo -e "${BLUE}[*]${NC} $*"; };
ok(){ echo -e "${GREEN}[OK]${NC} $*"; };
warn(){ echo -e "${YELLOW}[WARN]${NC} $*"; };
err(){ echo -e "${RED}[ERR]${NC} $*" 1>&2; }

DRY_RUN=${DRY_RUN:-0}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
TF_DIR="$ROOT_DIR/terraform"

if ! command -v terraform >/dev/null 2>&1; then
  err "Terraform not in PATH"; exit 1
fi

if [ -z "${SSH_KEY_PATH:-}" ] && [ "$DRY_RUN" != "1" ]; then
  err "SSH_KEY_PATH not set"; exit 1
fi

pushd "$TF_DIR" >/dev/null
EC2_IP=$(terraform output -raw backend_instance_public_ip 2>/dev/null || true)
RDS_ENDPOINT=$(terraform output -raw rds_endpoint 2>/dev/null || true)
popd >/dev/null

if [ -z "$EC2_IP" ] || [ -z "$RDS_ENDPOINT" ]; then
  err "Missing terraform outputs"; exit 1
fi

log "EC2 IP       : $EC2_IP"
log "RDS Endpoint : $RDS_ENDPOINT"

if [ "$DRY_RUN" = "1" ]; then
  ok "Dry run complete. Would connect to EC2 and perform diagnostics."
  exit 0
fi

SSH_OPTS="-o StrictHostKeyChecking=no -i $SSH_KEY_PATH"

REMOTE_SCRIPT='set -euo pipefail
cd /opt/bookverse || { echo "[remote][ERR] /opt/bookverse missing" >&2; exit 2; }

if [ ! -f .env ]; then
  echo "[remote][ERR] .env file missing -> cannot proceed" >&2; exit 3;
fi
SANITIZED=$(grep -E "^DATABASE_URL=" .env | sed -E "s#(postgresql://[^:]+:)[^@]*#\\1****#") || true
if [ -z "$SANITIZED" ]; then
  echo "[remote][ERR] DATABASE_URL not set in .env" >&2; exit 4
fi

echo "[remote] DATABASE_URL (masked): $SANITIZED"

# Extract parts for psql test
RAW=$(grep -E "^DATABASE_URL=" .env | cut -d= -f2- | tr -d '\r\n')
# Remove protocol
URL_NO_PROTO="${RAW#postgresql://}"
# Split creds and host/db?params
CREDS="${URL_NO_PROTO%%@*}"
HOST_DB="${URL_NO_PROTO#*@}"
USER="${CREDS%%:*}"
PASS_PART="${CREDS#*:}"
HOST_PORT_DB="${HOST_DB%%\?*}"
HOST_PORT="${HOST_PORT_DB%%/*}"
DB_NAME="${HOST_PORT_DB#*/}"
HOST_ONLY="${HOST_PORT%%:*}"
PORT_PART="${HOST_PORT#*:}"
if [ "$PORT_PART" = "$HOST_ONLY" ]; then PORT=5432; else PORT="$PORT_PART"; fi
PASS="$PASS_PART"

# Trim possible sslmode suffix from DB_NAME
DB_NAME="${DB_NAME%%\?*}"

echo "[remote] Parsed: user=$USER host=$HOST_ONLY port=$PORT db=$DB_NAME"

# Prisma quick test
PRISMA_STATUS=0
export DATABASE_URL="$RAW"
cat > /tmp/prisma_test.js <<'PRISMA_TEST'
(async () => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    await prisma.$queryRaw`SELECT 1`;
    console.log('[remote][prisma] SELECT 1 success');
    await prisma.$disconnect();
  } catch (e) {
    console.log('[remote][prisma][ERROR]', e.message || e);
    process.exitCode = 10;
  }
})();
PRISMA_TEST
node /tmp/prisma_test.js || PRISMA_STATUS=$?

if [ ${PRISMA_STATUS:-0} -ne 0 ]; then
  echo "[remote] Prisma probe failed (will still attempt psql)."
fi

# Ensure psql present
if ! command -v psql >/dev/null 2>&1; then
  echo "[remote] Installing PostgreSQL client..."
  if command -v amazon-linux-extras >/dev/null 2>&1; then
    amazon-linux-extras enable postgresql15 >/dev/null 2>&1 || amazon-linux-extras enable postgresql14 >/dev/null 2>&1 || true
  fi
  yum -y install postgresql15 >/dev/null 2>&1 || yum -y install postgresql14 >/dev/null 2>&1 || yum -y install postgresql >/dev/null 2>&1 || true
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "[remote][psql][ERROR] Could not install psql client" >&2
  PSQL_STATUS=11
else
  echo "[remote] psql version: $(psql --version)"
  export PGPASSWORD="$PASS"
  set +e
  psql -h "$HOST_ONLY" -p "$PORT" -U "$USER" -d "$DB_NAME" -c 'SELECT 1;' >/tmp/psql_out 2>/tmp/psql_err
  PSQL_STATUS=$?
  set -e
  if [ $PSQL_STATUS -eq 0 ]; then
    echo "[remote][psql] SELECT 1 success"
  else
    echo "[remote][psql][ERROR] $(cat /tmp/psql_err | tr '\n' ' ')"
  fi
fi

# Summary
if [ ${PRISMA_STATUS:-0} -eq 0 ]; then echo "[remote][summary] Prisma: OK"; else echo "[remote][summary] Prisma: FAIL"; fi
if [ ${PSQL_STATUS:-0} -eq 0 ]; then echo "[remote][summary] psql:   OK"; else echo "[remote][summary] psql:   FAIL"; fi

# Exit code logic: fail only if both failed
if [ ${PRISMA_STATUS:-0} -ne 0 ] && [ ${PSQL_STATUS:-0} -ne 0 ]; then exit 42; fi
'

log "Running remote diagnostics..."
if ! ssh $SSH_OPTS ec2-user@"$EC2_IP" "bash -s" <<<"$REMOTE_SCRIPT"; then
  err "Remote diagnostics indicated failure (both Prisma and psql failed)"; exit 42
fi
ok "Diagnostics complete"
