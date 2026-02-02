#!/usr/bin/env bash
set -euo pipefail

# Load non-secret TF_VARs from .env (if present)
set -a
if [ -f "../.env" ]; then
  # shellcheck disable=SC1091
  source "../.env"
fi

# Inject secrets from 1Password using the active vault
VAULT="$(jq -r '.active' ../vaults.config.json)"
eval "$(sed "s/VAULT/$VAULT/g" ../secrets.template | op inject)"
set +a

echo "Loaded Terraform variables from .env and 1Password (vault: $VAULT)."