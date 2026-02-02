# Proxmox Home Lab Infrastructure

This repository contains the Infrastructure as Code (IaC) and configuration management for a Proxmox-based Kubernetes home lab.

## Architecture

- **Proxmox:** Host for Virtual Machines.
- **Terraform:** Used for provisioning VMs on Proxmox.
- **Ansible:** Used for baseline configuration and K3s deployment.
- **Kubernetes:** K3s distribution with 1 Control Plane and 2 Worker nodes.
- **Connectivity:** Tailscale for secure networking.
- **Secrets:** 1Password CLI (`op`) for managing sensitive information.

### Resource Targets

| Name | Role | vCPU | RAM | Disk |
|------|------|------|-----|------|
| k8s-cp-01 | Control Plane | 4 | 12 GB | 120 GB |
| k8s-wk-01 | Worker | 6 | 20 GB | 200 GB |
| k8s-wk-02 | Worker | 6 | 20 GB | 200 GB |

## Prerequisites

1.  **Proxmox VE:** A running Proxmox server.
2.  **1Password CLI:** Installed (included in Dev Container).
3.  **Tailscale:** Tailscale account and Auth Key.
4.  **Ubuntu 24.04 Cloud Image:** Recommended to have a cloud-init template ready on Proxmox.

## Usage

### Secret Management & Vaults

This project uses 1Password for centralized secret management with support for multiple vaults (production and testing).

**Vault Configuration:** [vaults.config.json](vaults.config.json)
```json
{
  "vaults": {
    "pve02": { "id": "pve02", "name": "PVE02 Production", ... },
    "pve2-test": { "id": "pve2-test", "name": "PVE2 Testing", ... }
  },
  "active": "pve02"
}
```

**Switching Vaults:**
```bash
# Use production vault (default)
npm run rotate:ssh-keys

# Switch to testing vault with environment variable
OP_VAULT=pve2-test npm run rotate:ssh-keys

# Or update vaults.config.json to change default active vault
```

**Secret Rotation Commands:**
```bash
npm run rotate:ssh-keys          # Generate ED25519 keypair
npm run rotate:proxmox-token     # Prompt for Proxmox API token
npm run rotate:tailscale-auth-key    # Prompt for Tailscale auth key
npm run rotate:tailscale-api-token   # Prompt for Tailscale API token
```

All commands will:
- Check 1Password CLI availability and signin status
- Display secret purpose from configuration
- Automatically store in the active vault

### 1. Secret Configuration

Copy `.env.example` to `.env` and fill in the 1Password URIs or values.

```bash
cp .env.example .env
# Edit .env with your op:// links
```

Inject secrets into your environment:

```bash
eval $(op inject -i .env)
```

### 2. SSH Key Setup

Run the helper script to write your SSH private key to the correct location for Ansible:

```bash
./scripts/setup-ssh.sh
```

### 3. Ansible Inventory

Copy `ansible/inventory.ini.example` to `ansible/inventory.ini` and update it with your VM IP addresses (once they are provisioned).

```bash
cp ansible/inventory.ini.example ansible/inventory.ini
```

### 4. Infrastructure Provisioning

```bash
cd terraform
terraform init
terraform plan
terraform apply
```

### 5. Baseline & K3s Deployment

```bash
cd ansible
ansible-playbook -i inventory.ini playbooks/baseline.yml
ansible-playbook -i inventory.ini playbooks/k3s-setup.yml
```

## Repository Structure

- `.devcontainer/`: VS Code Dev Container configuration.
- `terraform/`: Terraform manifests for Proxmox.
- `ansible/`: Ansible playbooks and roles for configuration.
- `.env.example`: Template for secret management.
