/**
 * Maps secret names to their rotation strategies
 */

export const secretNameToStrategy: Record<string, string> = {
  TF_VAR_PROXMOX_API_TOKEN: "proxmox-api-token",
  TF_VAR_SSH_PUBLIC_KEY: "ssh-public-key",
  VM_INIT_SSH_PRIVATE_KEY: "ssh-private-key",
  TAILSCALE_AUTH_KEY: "tailscale-auth-key",
  TAILSCALE_API_TOKEN: "tailscale-api-token",
  ARGOCD_ADMIN_PASSWORD: "argocd-admin-password",
};

/**
 * Get the rotation strategy for a secret name
 */
export function getStrategy(secretName: string): string | undefined {
  return secretNameToStrategy[secretName];
}
