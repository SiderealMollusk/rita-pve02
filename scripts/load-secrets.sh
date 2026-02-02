#!/bin/bash
# Source this file to load all secrets into environment
# Usage: source scripts/load-secrets.sh

# Don't use set -e when sourcing - it will exit the parent shell
VAULT="${OP_VAULT:-pve02-test}"

echo "Loading secrets from 1Password vault: $VAULT"

# Check if signed in, sign in if needed
if ! op account get &>/dev/null; then
  echo "Signing in to 1Password..."
  eval $(op signin --account my)
fi

export TAILSCALE_AUTH_KEY=$(op read "op://$VAULT/TAILSCALE_AUTH_KEY/value")
export VM_INIT_SSH_PRIVATE_KEY=$(op read "op://$VAULT/VM_INIT_SSH_PRIVATE_KEY/value")
export TF_VAR_proxmox_api_token=$(op read "op://$VAULT/PROXMOX_API_TOKEN/value")
export TF_VAR_ssh_public_key=$(op read "op://$VAULT/VM_INIT_SSH_PUBLIC_KEY/value")
export ARGOCD_ADMIN_PASSWORD=$(op read "op://$VAULT/ARGOCD_ADMIN_PASSWORD/value")

if [ -n "$TAILSCALE_AUTH_KEY" ] && [ -n "$VM_INIT_SSH_PRIVATE_KEY" ]; then
  echo "✅ Secrets loaded into environment"
else
  echo "❌ Failed to load some secrets"
  return 1 2>/dev/null || exit 1
fi
