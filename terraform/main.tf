resource "proxmox_virtual_environment_file" "ubuntu_cloud_image" {
  content_type = "iso"
  datastore_id = "local"
  node_name    = var.node_name

  source_file {
    path = "https://cloud-images.ubuntu.com/noble/current/noble-server-cloudimg-amd64.img"
  }
}

resource "proxmox_virtual_environment_vm" "k8s_cp_01" {
  name        = "k8s-cp-01"
  description = "Kubernetes Control Plane"
  tags        = ["k8s", "control-plane"]
  node_name   = var.node_name
  vm_id       = 100

  cpu {
    cores = 4
    type  = "host"
  }

  memory {
    dedicated = 12288
  }

  agent {
    enabled = true
  }

  scsi_hardware = "virtio-scsi-pci"

  network_device {
    bridge = var.network_bridge
  }

  disk {
    datastore_id = var.storage_pool
    file_id      = proxmox_virtual_environment_file.ubuntu_cloud_image.id
    interface    = "scsi0"
    size         = 120
  }

  initialization {
    ip_config {
      ipv4 {
        address = "dhcp"
      }
    }
    user_account {
      keys     = [var.ssh_public_key]
      username = "ubuntu"
    }
  }
}

resource "proxmox_virtual_environment_vm" "k8s_wk_01" {
  name        = "k8s-wk-01"
  description = "Kubernetes Worker 01"
  tags        = ["k8s", "worker"]
  node_name   = var.node_name
  vm_id       = 101

  cpu {
    cores = 6
    type  = "host"
  }

  memory {
    dedicated = 20480
  }

  agent {
    enabled = true
  }

  scsi_hardware = "virtio-scsi-pci"

  network_device {
    bridge = var.network_bridge
  }

  disk {
    datastore_id = var.storage_pool
    file_id      = proxmox_virtual_environment_file.ubuntu_cloud_image.id
    interface    = "scsi0"
    size         = 200
  }

  initialization {
    ip_config {
      ipv4 {
        address = "dhcp"
      }
    }
    user_account {
      keys     = [var.ssh_public_key]
      username = "ubuntu"
    }
  }
}

resource "proxmox_virtual_environment_vm" "k8s_wk_02" {
  name        = "k8s-wk-02"
  description = "Kubernetes Worker 02"
  tags        = ["k8s", "worker"]
  node_name   = var.node_name
  vm_id       = 102

  cpu {
    cores = 6
    type  = "host"
  }

  memory {
    dedicated = 20480
  }

  agent {
    enabled = true
  }

  scsi_hardware = "virtio-scsi-pci"

  network_device {
    bridge = var.network_bridge
  }

  disk {
    datastore_id = var.storage_pool
    file_id      = proxmox_virtual_environment_file.ubuntu_cloud_image.id
    interface    = "scsi0"
    size         = 200
  }

  initialization {
    ip_config {
      ipv4 {
        address = "dhcp"
      }
    }
    user_account {
      keys     = [var.ssh_public_key]
      username = "ubuntu"
    }
  }
}
