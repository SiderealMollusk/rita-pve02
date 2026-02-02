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

### 0. Proxmox Host Setup (Manual)

These steps must be completed on the Proxmox host before running Terraform:

#### Basic Setup
1. **Install Proxmox VE** from ISO
2. **Configure hostname resolution** - Proxmox needs to resolve its own hostname:
   ```bash
   # On Proxmox host, add to /etc/hosts
   echo "127.0.1.1 pve" >> /etc/hosts
   ```

#### Networking
3. **Install Tailscale:**
   ```bash
   curl -fsSL https://tailscale.com/install.sh | sh
   tailscale up
   ```

4. **Enable Tailscale SSH:**
   ```bash
   tailscale up --ssh
   ```
   Update `.env` with the Tailscale IP: `PVE02_TS_MAGIC_IP=100.x.x.x`

#### Terraform Prerequisites
5. **Install Terraform on Proxmox:**
   ```bash
   # Download HashiCorp GPG key
   wget -O- https://apt.releases.hashicorp.com/gpg | gpg --dearmor > /usr/share/keyrings/hashicorp-archive-keyring.gpg
   
   # Add HashiCorp repo
   DEBIAN_CODENAME=$(grep VERSION_CODENAME /etc/os-release | cut -d= -f2)
   echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com ${DEBIAN_CODENAME} main" > /etc/apt/sources.list.d/hashicorp.list
   
   # Install
   apt update && apt install -y terraform
   ```

6. **Create Terraform API Role & Token:**
   ```bash
   # Create role with required permissions
   pveum role add TerraformRole -privs "Datastore.Audit,Datastore.AllocateSpace,VM.Audit,VM.Allocate,VM.Config.CDROM,VM.Config.CPU,VM.Config.Cloudinit,VM.Config.Disk,VM.Config.HWType,VM.Config.Memory,VM.Config.Network,VM.Config.Options,VM.Console,VM.PowerMgmt"
   
   # Create token (replace TOKEN_NAME)
   pveum user token add root@pam TOKEN_NAME -privsep 0
   
   # Grant permissions to token
   pveum aclmod /storage/local -token 'root@pam!TOKEN_NAME' -role TerraformRole
   pveum aclmod /vms -token 'root@pam!TOKEN_NAME' -role TerraformRole
   ```
   
   Then run `npm run rotate:proxmox-token` to store the token in 1Password.

**Note:** Running Terraform directly on Proxmox avoids dev container memory limitations.

### 1. Initialize Secrets (Day 0)

First time setup - creates all required secrets in 1Password vault, generates SSH keypair, and prompts for external secrets:

```bash
npm run day0
```

If you only want to create the secret items (no prompts/rotation):

```bash
npm run day0:secrets
```

### 2. Secret Management & Vault Switching

This project uses 1Password for centralized secret management with support for multiple vaults (production and testing).

#### TL;DR Secret Flow

```bash
npm run day0
```
Creates items + generates SSH keys + prompts for external secrets.

```bash
npm run preflight -- --only-tags secrets
```
Validates that secrets exist and are formatted correctly.


**Vault Configuration:** [vaults.config.json](vaults.config.json)
```json
{
  "vaults": {
    "pve02": { "id": "pve02", "name": "PVE02 Production", ... },
    "pve02-test": { "id": "pve02-test", "name": "PVE2 Testing", ... }
  },
  "active": "pve02-test"
}
```

**Change Active Vault:**

Edit vaults.config.json and update the active field:

```json
"active": "pve02-test"
```

Or override at runtime:

```bash
OP_VAULT=pve02 OP_VAULT_OVERRIDE=1 npm run day0
```

**Secret Rotation Commands:**
```bash
npm run rotate:ssh-keys              # Auto-generate ED25519 keypair
npm run rotate:proxmox-token         # Update Proxmox API token
npm run rotate:tailscale-auth-key    # Update Tailscale auth key
npm run rotate:tailscale-api-token   # Update Tailscale API token
```

### 3. Validate Secrets

Check that all secrets are properly configured and functional:

```bash
# Quick validation (format and existence)
npm run preflight -- --only-tags secrets

# Full functional validation (actually tests each secret)
npm run preflight -- --only-tags functional
```

### 4. Infrastructure Provisioning

Ensure Proxmox endpoint is accessible:

```bash
curl -k https://<YOUR_PROXMOX_IP>:8006/api2/json/version
```

Then provision VMs with Terraform:

```bash
cd terraform
terraform init

# Inject 1Password secrets into the environment for Terraform
VAULT="$(jq -r '.active' ../vaults.config.json)"
eval "$(sed "s/VAULT/$VAULT/g" ../secrets.template | op inject)"

terraform plan
terraform apply
```

This creates 3 VMs with cloud-init setup (SSH keys, basic networking).

### 5. VM Snapshot Management (Optional)

Snapshots are managed directly in the Proxmox UI (no npm scripts yet).
Create a snapshot after cloud-init finishes so you can revert quickly during Ansible iteration.

### 6. Configuration Management

Copy Ansible inventory and run playbooks:

```bash
cd ansible
cp inventory.ini.example inventory.ini
# Update inventory.ini with VM IP addresses

ansible-playbook -i inventory.ini playbooks/baseline.yml
ansible-playbook -i inventory.ini playbooks/k3s-setup.yml
```

## Repository Structure

- `.devcontainer/`: VS Code Dev Container configuration.
- `terraform/`: Terraform manifests for Proxmox.
- `ansible/`: Ansible playbooks and roles for configuration.
- `.env.example`: Template for secret management.
