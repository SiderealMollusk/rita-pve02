/**
 * Load secrets config with descriptions
 */
import { readFileSync } from "fs";

export interface SecretConfig {
  name: string;
  opPath: string;
  strategy: string;
  description: string;
}

export interface SecretsConfigFile {
  secrets: SecretConfig[];
  sshTargets?: unknown[];
}

export function loadSecretsConfig(): SecretsConfigFile {
  const raw = readFileSync("secrets.config.json", "utf-8");
  return JSON.parse(raw) as SecretsConfigFile;
}

export function getSecretConfig(secretName: string): SecretConfig | undefined {
  const config = loadSecretsConfig();
  return config.secrets.find((s) => s.name === secretName);
}
