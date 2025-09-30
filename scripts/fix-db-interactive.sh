#!/usr/bin/env bash
# fix-db-interactive.sh
# Convenience wrapper for fix-db-connection.sh that safely prompts for the DB password.
# Usage:
#   ./scripts/fix-db-interactive.sh /absolute/path/to/key.pem [DB_USER] [DB_NAME]
# Example:
#   ./scripts/fix-db-interactive.sh ~/.ssh/bookverse-key.pem bookverse_admin bookverse_dev
# Notes:
#   - DB_USER and DB_NAME are optional; if omitted, underlying script will use defaults / terraform outputs.
#   - Password is not echoed; not stored in history.
#   - Requires terraform to have been applied so outputs are available.

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 /path/to/key.pem [DB_USER] [DB_NAME]" >&2
  exit 1
fi

SSH_KEY_PATH=$1
DB_USER=${2:-${DB_USER:-}}
DB_NAME=${3:-${DB_NAME:-}}

if [ ! -f "$SSH_KEY_PATH" ]; then
  echo "[ERR] SSH key not found: $SSH_KEY_PATH" >&2
  exit 1
fi

chmod 600 "$SSH_KEY_PATH" 2>/dev/null || true

# Prompt for password securely
if [ -t 0 ]; then
  # If running in an interactive terminal
  if [ -n "${ZSH_VERSION:-}" ]; then
    # zsh compatible prompt
    read -s "DB_PASS?Enter RDS password: "
    echo
  else
    # bash style
    read -s -p "Enter RDS password: " DB_PASS
    echo
  fi
else
  echo "[ERR] Not a TTY; cannot securely prompt for password" >&2
  exit 1
fi

export SSH_KEY_PATH
[ -n "$DB_USER" ] && export DB_USER
[ -n "$DB_NAME" ] && export DB_NAME
export DB_PASS

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

bash "$SCRIPT_DIR/fix-db-connection.sh"
