#!/usr/bin/env bash
set -euo pipefail

# Creates a Proxmox API token and assigns Terraform permissions.
# Run this on the Proxmox host (or over SSH).
#
# Usage:
#   ./proxmox-create-token.sh
#   # Optional: VAULT_NAME or TOKEN_ID can be provided via env
#
# Optional overrides:
#   ROLE_NAME=TerraformRole
#   STORAGE_PATH=/storage/local
#   VM_PATH=/vms
#   PRIVS="Datastore.Audit Datastore.AllocateSpace VM.Audit VM.Allocate VM.Config.CDROM VM.Config.CPU VM.Config.Disk VM.Config.Memory VM.Config.Network VM.Config.Options VM.Monitor VM.PowerMgmt"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VAULTS_CONFIG="${VAULTS_CONFIG:-${SCRIPT_DIR}/../vaults.config.json}"

if [ -z "${VAULT_NAME:-}" ] && [ -f "$VAULTS_CONFIG" ]; then
  VAULT_NAME="$(jq -r '.active' "$VAULTS_CONFIG")"
fi
VAULT_NAME="${VAULT_NAME:-unknown-vault}"

if [ -z "${TOKEN_ID:-}" ]; then
  read -r -p "Enter Proxmox TOKEN_ID (e.g. dev-container-test): " TOKEN_ID
fi
TOKEN_ID="${TOKEN_ID:-terraform}"
ROLE_NAME="${ROLE_NAME:-TerraformRole}"
STORAGE_PATH="${STORAGE_PATH:-/storage/local}"
VM_PATH="${VM_PATH:-/vms}"
PRIVS="${PRIVS:-Datastore.Audit Datastore.AllocateSpace VM.Audit VM.Allocate VM.Config.CDROM VM.Config.CPU VM.Config.Disk VM.Config.Memory VM.Config.Network VM.Config.Options VM.Monitor VM.PowerMgmt}"

USER="root@pam"
TOKEN_NAME="${USER}!${TOKEN_ID}"

if ! command -v pveum >/dev/null 2>&1; then
  echo "pveum not found. Run this on the Proxmox host." >&2
  exit 1
fi

if [ -z "$TOKEN_ID" ]; then
  echo "TOKEN_ID is required." >&2
  exit 1
fi

# Create role if it does not exist
if ! pveum role list | awk '{print $1}' | grep -qx "$ROLE_NAME"; then
  echo "Creating role: $ROLE_NAME"
  pveum roleadd "$ROLE_NAME" -privs "$PRIVS"
else
  echo "Role already exists: $ROLE_NAME"
fi

# Apply permissions
echo "Assigning role to ${TOKEN_NAME}"
# Storage permissions (for image upload)
pveum aclmod "$STORAGE_PATH" -token "$TOKEN_NAME" -role "$ROLE_NAME" -propagate 1
# VM permissions (for VM create/config)
pveum aclmod "$VM_PATH" -token "$TOKEN_NAME" -role "$ROLE_NAME" -propagate 1

# Create token (outputs secret once)
echo "Creating token: ${TOKEN_NAME} (comment: vault=${VAULT_NAME})"
pveum user token add "$USER" "$TOKEN_ID" --comment "vault=${VAULT_NAME}"

echo "\nSave the token secret now (shown above) into 1Password as PROXMOX_API_TOKEN."