#!/bin/bash
set -euo pipefail

# This script is called by apply-terraform-remote.sh with secrets injected via op run
# Arguments: endpoint, node_name, storage_pool, network_bridge
# Environment: TF_VAR_proxmox_api_token, TF_VAR_ssh_public_key (from op run)

ENDPOINT="$1"
NODE_NAME="$2"
STORAGE_POOL="$3"
NETWORK_BRIDGE="$4"

echo "Connecting to Proxmox and running terraform..."

# Run terraform - use Proxmox's own SSH key for localhost
ssh -t root@100.121.136.16 "cd /root/terraform && \
  if [ -f .terraform.tfstate.lock.info ]; then
    echo 'Removing stale terraform lock file...'
    rm -f .terraform.tfstate.lock.info
  fi && \
  TF_VAR_proxmox_endpoint='$ENDPOINT' \
  TF_VAR_proxmox_api_token='$TF_VAR_proxmox_api_token' \
  TF_VAR_ssh_public_key='$TF_VAR_ssh_public_key' \
  TF_VAR_ssh_private_key=\"\$(cat ~/.ssh/id_ed25519)\" \
  TF_VAR_node_name='$NODE_NAME' \
  TF_VAR_storage_pool='$STORAGE_POOL' \
  TF_VAR_network_bridge='$NETWORK_BRIDGE' \
  terraform apply -auto-approve"

