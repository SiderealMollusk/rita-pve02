/**
 * Configuration loading and validation
 */

import { config as loadEnv } from "dotenv";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { Config } from "./types";

const DEFAULT_ENV_FILE = ".env";
const DEFAULT_SECRETS_TEMPLATE = "secrets.template";
const DEFAULT_SECRETS_ENV = "secrets.env";

export interface LoadConfigOptions {
  envFile?: string;
  secretsTemplate?: string;
  secretsEnv?: string;
  cwd?: string;
}

/**
 * Load and validate configuration from .env files
 */
export function loadConfig(options: LoadConfigOptions = {}): Config {
  const {
    envFile = DEFAULT_ENV_FILE,
    secretsTemplate = DEFAULT_SECRETS_TEMPLATE,
    secretsEnv = DEFAULT_SECRETS_ENV,
    cwd = process.cwd(),
  } = options;

  const envPath = resolve(cwd, envFile);
  const secretsTemplatePath = resolve(cwd, secretsTemplate);
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

  // Check if secrets.template exists
  if (!existsSync(secretsTemplatePath)) {
    throw new Error(`Secrets template not found: ${secretsTemplatePath}`);
  }

  const config: Config = {
    envFile: envPath,
    secretsTemplate: secretsTemplatePath,
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
 * Validate that all required op:// references in secrets.template are valid
 */
export function validateSecretsTemplate(templatePath: string): string[] {
  if (!existsSync(templatePath)) {
    throw new Error(`Secrets template not found: ${templatePath}`);
  }

  const content = readFileSync(templatePath, "utf-8");
  const opRefPattern = /op:\/\/[\w\-]+\/[\w\-]+\/[\w\-]+/g;
  const refs = content.match(opRefPattern) || [];

  return [...new Set(refs)]; // Deduplicate
}

/**
 * Check if secrets.env exists and is stale
 */
export function isSecretsEnvStale(secretsEnvPath: string): boolean {
  return existsSync(secretsEnvPath);
}
