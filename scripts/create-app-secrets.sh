#!/bin/bash
# Creates 1Password items for application secrets
# 
# USAGE:
#   ./scripts/create-app-secrets.sh <app-name> [vault]
#
# EXAMPLES:
#   ./scripts/create-app-secrets.sh rita-baseapp-01
#   ./scripts/create-app-secrets.sh my-new-app pve02-test
#
# Requires: op CLI authenticated (run `op signin` first)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

#############################################################################
# ARGUMENTS
#############################################################################

APP_NAME="${1:-}"
if [ -z "$APP_NAME" ]; then
  echo "❌ Error: App name required"
  echo ""
  echo "Usage: $0 <app-name> [vault]"
  echo ""
  echo "Examples:"
  echo "  $0 rita-baseapp-01"
  echo "  $0 my-new-app pve02-test"
  exit 1
fi

# Default vault from config or second argument
DEFAULT_VAULT=$(cat "$SCRIPT_DIR/../vaults.config.json" 2>/dev/null | grep -o '"active": *"[^"]*"' | cut -d'"' -f4 || echo "pve02-test")
VAULT="${2:-$DEFAULT_VAULT}"

echo "🔐 Creating app secrets for: $APP_NAME"
echo "   Vault: $VAULT"
echo ""

#############################################################################
# SECRET PHILOSOPHY
#############################################################################
# 
# SHARED SECRETS (Infrastructure-level, used by multiple apps):
#   - Database connection pooler credentials (if using PgBouncer/Supabase)
#   - Shared API keys (Supabase project key, etc.)
#   - Observability endpoints (not really secrets, but config)
#
# APP-SPECIFIC SECRETS (One per app, isolated):
#   - App's own database user/password (principle of least privilege)
#   - JWT signing secrets (each app should have its own)
#   - API keys for external services specific to the app
#
# NAMING CONVENTION:
#   Item Name: {app-name}-secrets
#   Field Names: Keep them generic (DATABASE_USER, not RITA_DATABASE_USER)
#   
#   Why? The Helm chart expects DATABASE_USER. ESO maps the 1Password field
#   to the K8s secret key. Keep the mapping simple.
#
#############################################################################

ITEM_NAME="${APP_NAME}-secrets"

# Check if item already exists
if op item get "$ITEM_NAME" --vault "$VAULT" &>/dev/null; then
  echo "⚠️  Item '$ITEM_NAME' already exists in vault '$VAULT'"
  echo "   Use 'op item edit' to update, or delete and re-run."
  exit 1
fi

echo "📝 Creating item: $ITEM_NAME"
echo ""

# Generate secure random values
JWT_SECRET=$(openssl rand -base64 32)
DB_PASSWORD=$(openssl rand -base64 16)
DB_NAME="${APP_NAME//-/_}"  # Convert dashes to underscores for valid DB name

# Create the 1Password item with all required fields
op item create \
  --category=login \
  --title="$ITEM_NAME" \
  --vault="$VAULT" \
  --tags="kubernetes,app-secret,${APP_NAME}" \
  "DATABASE_USER=postgres" \
  "DATABASE_PASSWORD[password]=$DB_PASSWORD" \
  "DATABASE_NAME=$DB_NAME" \
  "JWT_SECRET[password]=$JWT_SECRET" \
  "SUPABASE_URL=" \
  "SUPABASE_KEY[password]="

echo ""
echo "✅ Created '$ITEM_NAME' in vault '$VAULT'"
echo ""
echo "📋 Summary of created secrets:"
echo "   DATABASE_USER     = postgres"
echo "   DATABASE_PASSWORD = [auto-generated]"
echo "   DATABASE_NAME     = $DB_NAME"
echo "   JWT_SECRET        = [auto-generated]"
echo "   SUPABASE_URL      = (empty - set if needed)"
echo "   SUPABASE_KEY      = (empty - set if needed)"
echo ""
echo "🔗 External Secrets Operator will sync this to K8s"
echo "   Update your app's values.yaml to reference:"
echo "   externalSecrets.remoteRef.key: \"$ITEM_NAME\""
