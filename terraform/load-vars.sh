#!/usr/bin/env bash
set -euo pipefail

# Load non-secret TF_VARs from .env (if present)
set -a
if [ -f "../.env" ]; then
  # shellcheck disable=SC1091
  source "../.env"
fi

# Always regenerate secrets environment to ensure correct vault is used
echo "Generating .env.secrets..."
(cd .. && npm run secrets:generate > /dev/null)

# Inject secrets from 1Password using the generated secrets environment
VAULT="$(jq -r '.active' ../vaults.config.json)"
eval "$(op inject -i ../.env.secrets)"
set +a

echo "Loaded Terraform variables from .env and 1Password (vault: $VAULT)."