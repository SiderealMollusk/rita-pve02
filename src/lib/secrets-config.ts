/**
 * Load secrets config with descriptions
 */
import { readFileSync } from "fs";
import { getActiveVault } from "./vaults-config.js";

export interface SecretConfig {
  name: string;
  opPath: string;
  strategy: string;
  description: string;
}

export interface SecretsConfigFile {
  secrets: SecretConfig[];
  sshTargets?: Array<{
    name: string;
    hostOpPath: string;
    user: string;
    port?: number;
    keyName: string;
  }>;
}

export function loadSecretsConfig(): SecretsConfigFile {
  const raw = readFileSync("secrets.config.json", "utf-8");
  const config = JSON.parse(raw) as SecretsConfigFile;

  // Interpolate VAULT placeholder with active vault
  const activeVault = getActiveVault();
  config.secrets = config.secrets.map((s) => ({
    ...s,
    opPath: s.opPath.replace(/\/\/VAULT\//, `//${activeVault}/`),
  }));

  if (config.sshTargets) {
    config.sshTargets = config.sshTargets.map((t) => ({
      ...t,
      hostOpPath: t.hostOpPath.replace(/\/\/VAULT\//, `//${activeVault}/`),
    }));
  }

  return config;
}

export function getSecretConfig(secretName: string): SecretConfig | undefined {
  const config = loadSecretsConfig();
  return config.secrets.find((s) => s.name === secretName);
}

export function getStrategy(secretName: string): string | undefined {
  return getSecretConfig(secretName)?.strategy;
}
