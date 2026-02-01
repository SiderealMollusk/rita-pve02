#!/bin/bash
# Setup VM initialization SSH key for Ansible (Tailscale SSH used after bootstrap)
if [ -z "$VM_INIT_SSH_PRIVATE_KEY" ]; then
    echo "Error: VM_INIT_SSH_PRIVATE_KEY environment variable is not set."
    exit 1
fi

mkdir -p ~/.ssh
echo "$VM_INIT_SSH_PRIVATE_KEY" > ~/.ssh/id_rsa
chmod 600 ~/.ssh/id_rsa
echo "VM initialization SSH private key has been written to ~/.ssh/id_rsa"
