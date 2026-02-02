#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

# Load non-secret config
source "$REPO_ROOT/.env"

# Get vault name and create a temp env file with vault substituted
VAULT=$(jq -r '.active' "$REPO_ROOT/vaults.config.json")
TEMP_ENV=$(mktemp)
sed "s/VAULT/$VAULT/g" "$REPO_ROOT/secrets.template" > "$TEMP_ENV"

echo "Using 1Password vault: $VAULT"
echo "Proxmox endpoint: $TF_VAR_proxmox_endpoint"
echo "Node: $TF_VAR_node_name"

# Use op run to inject secrets, then SSH to Proxmox
op run --env-file="$TEMP_ENV" -- bash "$SCRIPT_DIR/apply-terraform-remote-inner.sh" \
  "$TF_VAR_proxmox_endpoint" \
  "$TF_VAR_node_name" \
  "$TF_VAR_storage_pool" \
  "$TF_VAR_network_bridge"

rm "$TEMP_ENV"


