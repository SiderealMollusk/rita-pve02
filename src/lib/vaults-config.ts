/**
 * Vault configuration loader and accessor
 */

import { readFileSync } from "fs";
import { resolve } from "path";

interface VaultEntry {
  id: string;
  name: string;
  description: string;
}

interface VaultsConfig {
  vaults: Record<string, VaultEntry>;
  active: string;
}

let cachedConfig: VaultsConfig | null = null;

export function loadVaultsConfig(): VaultsConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const configPath = resolve(process.cwd(), "vaults.config.json");
  const raw = readFileSync(configPath, "utf-8");
  cachedConfig = JSON.parse(raw) as VaultsConfig;
  return cachedConfig;
}

export function getActiveVault(): string {
  // Check environment variable first (allows override)
  const envVault = process.env.OP_VAULT;
  if (envVault) {
    return envVault;
  }

  const config = loadVaultsConfig();
  return config.active;
}

export function getVaultInfo(vaultId: string): VaultEntry {
  const config = loadVaultsConfig();
  const vault = config.vaults[vaultId];

  if (!vault) {
    throw new Error(`Vault not found: ${vaultId}`);
  }

  return vault;
}

export function listVaults(): VaultEntry[] {
  const config = loadVaultsConfig();
  return Object.values(config.vaults);
}
