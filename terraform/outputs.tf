output "k8s_cp_01_ip" {
  value = length(proxmox_virtual_environment_vm.k8s_cp_01.ipv4_addresses) > 1 ? proxmox_virtual_environment_vm.k8s_cp_01.ipv4_addresses[1][0] : "IP not yet assigned"
}

output "k8s_wk_01_ip" {
  value = length(proxmox_virtual_environment_vm.k8s_wk_01.ipv4_addresses) > 1 ? proxmox_virtual_environment_vm.k8s_wk_01.ipv4_addresses[1][0] : "IP not yet assigned"
}

output "k8s_wk_02_ip" {
  value = length(proxmox_virtual_environment_vm.k8s_wk_02.ipv4_addresses) > 1 ? proxmox_virtual_environment_vm.k8s_wk_02.ipv4_addresses[1][0] : "IP not yet assigned"
}
