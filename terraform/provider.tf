terraform {
  required_providers {
    proxmox = {
      source  = "bpg/proxmox"
      version = "0.66.1"
    }
  }
}

provider "proxmox" {
  endpoint  = var.proxmox_endpoint
  api_token = var.proxmox_api_token
  insecure  = true
  ssh {
    agent       = false
    private_key = var.ssh_private_key
    username    = "root"
    node {
      name    = "pve02"
      address = "localhost"
    }
  }
}
