#!/bin/bash
# Shared helper for checking required environment variables

require_env() {
  local var_name="$1"
  local op_path="$2"
  local vault="${OP_VAULT:-pve02-test}"

  if [ -z "${!var_name:-}" ]; then
    echo "❌ Missing required environment variable: $var_name" >&2
    echo "" >&2
    echo "Run this to set it:" >&2
    echo "  export $var_name=\$(op read \"op://$vault/$op_path\")" >&2
    echo "" >&2
    echo "Or load all secrets at once:" >&2
    echo "  source scripts/load-secrets.sh" >&2
    exit 1
  fi
}
