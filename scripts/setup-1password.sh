#!/bin/bash
set -e

VAULT_ID="jbnxykcqniirni5afko6n5yhey"

echo "Setting up 1Password items in vault 'pve02'..."
echo

# Prompt for values
read -p "Enter Proxmox API token (root@pam!terraform-token=xxx): " PROXMOX_TOKEN
read -p "Enter Tailscale auth key (tskey-auth-xxx): " TAILSCALE_KEY
read -sp "Enter VM SSH password: " VM_PASSWORD
echo

# Get SSH keys
if [ -f ~/.ssh/id_ed25519.pub ]; then
    SSH_PUBLIC_KEY=$(cat ~/.ssh/id_ed25519.pub)
    SSH_PRIVATE_KEY=$(cat ~/.ssh/id_ed25519)
    echo "Found SSH keys at ~/.ssh/id_ed25519"
elif [ -f ~/.ssh/id_rsa.pub ]; then
    SSH_PUBLIC_KEY=$(cat ~/.ssh/id_rsa.pub)
    SSH_PRIVATE_KEY=$(cat ~/.ssh/id_rsa)
    echo "Found SSH keys at ~/.ssh/id_rsa"
else
    echo "No SSH keys found. Generating new ones..."
    ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N ""
    SSH_PUBLIC_KEY=$(cat ~/.ssh/id_ed25519.pub)
    SSH_PRIVATE_KEY=$(cat ~/.ssh/id_ed25519)
fi

echo
echo "Creating 1Password items..."

# Create Proxmox API token item
op item create --category="API Credential" \
  --title="proxmox" \
  --vault="$VAULT_ID" \
  "api-token=$PROXMOX_TOKEN"

# Create SSH keys item
op item create --category="SSH Key" \
  --title="ssh" \
  --vault="$VAULT_ID" \
  "public-key=$SSH_PUBLIC_KEY" \
  "private-key=$SSH_PRIVATE_KEY"

# Create Tailscale auth key
op item create --category="API Credential" \
  --title="tailscale" \
  --vault="$VAULT_ID" \
  "auth-key=$TAILSCALE_KEY"

# Create VM password
op item create --category="Password" \
  --title="k8s-vms" \
  --vault="$VAULT_ID" \
  "ssh-password=$VM_PASSWORD"

echo
echo "✅ All items created successfully!"
echo
echo "Your .env should now have these references:"
echo "TF_VAR_PROXMOX_API_TOKEN=\"op://$VAULT_ID/proxmox/api-token\"""
echo "TF_VAR_SSH_PUBLIC_KEY=\"op://$VAULT_ID/ssh/public-key\""
echo "SSH_PRIVATE_KEY=\"op://$VAULT_ID/ssh/private-key\""
echo "TAILSCALE_AUTH_KEY=\"op://$VAULT_ID/tailscale/auth-key\""
echo "VM_SSH_PASSWORD=\"op://$VAULT_ID/k8s-vms/ssh-password\""
