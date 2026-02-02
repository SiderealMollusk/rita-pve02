#!/usr/bin/env bash
set -euo pipefail

# Run the Proxmox token creation script over SSH.
# Usage:
#   PROXMOX_HOST=100.121.136.16 ./scripts/proxmox-create-token-remote.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
VAULTS_CONFIG="${VAULTS_CONFIG:-${ROOT_DIR}/vaults.config.json}"
ENV_FILE="${ENV_FILE:-${ROOT_DIR}/.env}"
PROXMOX_HOST="${PROXMOX_HOST:-}"
TOKEN_ID="${TOKEN_ID:-}"

if [ -z "$PROXMOX_HOST" ] && [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  PROXMOX_HOST="${PVE02_TS_MAGIC_IP:-}"
fi

if [ -z "$PROXMOX_HOST" ]; then
  read -r -p "Enter Proxmox host (IP or hostname): " PROXMOX_HOST
fi

if [ -z "$TOKEN_ID" ]; then
  read -r -p "Enter Proxmox TOKEN_ID (e.g. dev-container-test): " TOKEN_ID
fi

if [ -z "$TOKEN_ID" ]; then
  echo "TOKEN_ID is required." >&2
  exit 1
fi

if [ -f "$VAULTS_CONFIG" ]; then
  VAULT_NAME="$(jq -r '.active' "$VAULTS_CONFIG")"
else
  VAULT_NAME="unknown-vault"
fi

export VAULT_NAME
export TOKEN_ID

ssh "root@${PROXMOX_HOST}" 'bash -s' < "${SCRIPT_DIR}/proxmox-create-token.sh"
