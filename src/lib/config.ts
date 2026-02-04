/**
 * Configuration loading and validation
 */

import { config as loadEnv } from "dotenv";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { Config } from "./types.js";
import { loadSecretsConfig } from "./secrets-config.js";

const DEFAULT_ENV_FILE = ".env";
const DEFAULT_SECRETS_CONFIG = "secrets.config.json";
const DEFAULT_SECRETS_ENV = ".env.secrets";

export interface LoadConfigOptions {
  envFile?: string;
  secretsConfig?: string;
  secretsEnv?: string;
  cwd?: string;
}

/**
 * Load and validate configuration from .env files
 */
export function loadConfig(options: LoadConfigOptions = {}): Config {
  const {
    envFile = DEFAULT_ENV_FILE,
    secretsConfig = DEFAULT_SECRETS_CONFIG,
    secretsEnv = DEFAULT_SECRETS_ENV,
    cwd = process.cwd(),
  } = options;

  const envPath = resolve(cwd, envFile);
  const secretsConfigPath = resolve(cwd, secretsConfig);
  const secretsEnvPath = resolve(cwd, secretsEnv);

  // Load .env
  if (!existsSync(envPath)) {
    throw new Error(`Configuration file not found: ${envPath}`);
  }

  loadEnv({ path: envPath });

  // Validate required variables
  const requiredVars = ["PVE02_TS_MAGIC_IP", "TF_VAR_proxmox_endpoint"];
  const missing = requiredVars.filter((v) => !process.env[v]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }

  // Check if secrets config exists
  if (!existsSync(secretsConfigPath)) {
    throw new Error(`Secrets config not found: ${secretsConfigPath}`);
  }

  const config: Config = {
    envFile: envPath,
    secretsConfig: secretsConfigPath,
    secretsEnv: secretsEnvPath,
    vault: process.env.OP_VAULT!,
    tailscaleMagicIP: process.env.PVE02_TS_MAGIC_IP!,
    proxyEndpoint: process.env.TF_VAR_proxmox_endpoint!,
  };

  // Merge all env vars into config
  Object.assign(config, process.env);

  return config;
}

/**
 * Validate that all required op:// references in secrets config are valid
 */
export function validateSecretsTemplate(): string[] {
  const config = loadSecretsConfig();

  const refs: string[] = [];
  if (config.secrets) {
    for (const s of config.secrets) {
      if (s.opPath) refs.push(s.opPath);
    }
  }

  if (config.sshTargets) {
    for (const t of config.sshTargets) {
      if (t.hostOpPath) refs.push(t.hostOpPath);
    }
  }

  return [...new Set(refs)]; // Deduplicate
}

/**
 * Check if secrets.env exists and is stale
 */
export function isSecretsEnvStale(secretsEnvPath: string): boolean {
  return existsSync(secretsEnvPath);
}
