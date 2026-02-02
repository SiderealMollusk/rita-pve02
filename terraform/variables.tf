variable "proxmox_endpoint" {
  type = string
}

variable "proxmox_api_token" {
  type      = string
  sensitive = true
}

variable "ssh_public_key" {
  type = string
}

variable "ssh_private_key" {
  type      = string
  sensitive = true
}

variable "node_name" {
  type    = string
  default = "pve"
}

variable "network_bridge" {
  type    = string
  default = "vmbr0"
}

variable "storage_pool" {
  type    = string
  default = "local-lvm"
}
