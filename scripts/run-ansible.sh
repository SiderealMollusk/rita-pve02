#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

source "$SCRIPT_DIR/lib/require-env.sh"

# Check required environment variables
require_env "TAILSCALE_AUTH_KEY" "TAILSCALE_AUTH_KEY/value"
require_env "VM_INIT_SSH_PRIVATE_KEY" "VM_INIT_SSH_PRIVATE_KEY/value"

# Parse arguments
PLAYBOOK="${1:-}"
if [ -z "$PLAYBOOK" ]; then
  echo "Usage: $0 <playbook> [ansible-playbook args...]"
  echo ""
  echo "Available playbooks:"
  ls -1 "$REPO_ROOT/ansible/playbooks/"*.yml | xargs -n1 basename
  exit 1
fi
shift

# Write SSH key to temp file
SSH_KEY_FILE=$(mktemp)
echo "$VM_INIT_SSH_PRIVATE_KEY" > "$SSH_KEY_FILE"
chmod 600 "$SSH_KEY_FILE"

cleanup() {
  rm -f "$SSH_KEY_FILE"
}
trap cleanup EXIT

# Run ansible
cd "$REPO_ROOT/ansible"
ANSIBLE_HOST_KEY_CHECKING=False ansible-playbook \
  -i inventory.ini \
  --private-key="$SSH_KEY_FILE" \
  -e "tailscale_auth_key=$TAILSCALE_AUTH_KEY" \
  "playbooks/$PLAYBOOK" \
  "$@"
