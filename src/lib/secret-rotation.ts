/**
 * Secret rotation and initialization
 * Parses secrets.template and maps to rotation strategies
 */

import { readFileSync } from "fs";

export interface SecretEntry {
  envVar: string;
  opRef: string;
  type: string;
}

export interface RotationOptions {
  dryRun?: boolean;
  verbose?: boolean;
}

export interface RotationResult {
  success: boolean;
  newValue?: string;
  dryRun: boolean;
  written: boolean;
  error?: string;
}

/**
 * Parse secrets.template and extract secret entries
 */
export function parseSecretsTemplate(filePath: string): SecretEntry[] {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const entries: SecretEntry[] = [];

  for (const line of lines) {
    // Skip comments and empty lines
    if (line.trim().startsWith("#") || !line.trim()) {
      continue;
    }

    // Parse: ENV_VAR="op://vault/item/field"  
    const match = line.match(/^([A-Z][A-Z0-9_a-z]*)="(op:\/\/.+)"$/);
    if (match) {
      const [, envVar, opRef] = match;
      const type = inferSecretType(envVar, opRef);
      entries.push({ envVar, opRef, type });
    }
  }

  return entries;
}

/**
 * Infer secret type from env var name and op reference
 */
function inferSecretType(envVar: string, opRef: string): string {
  const field = opRef.split("/").pop() || "";

  if (field.includes("api-token")) return "proxmox-api-token";
  if (field.includes("public-key")) return "ssh-public-key";
  if (field.includes("private-key")) return "ssh-private-key";
  if (field.includes("auth-key")) return "tailscale-auth-key";
  if (field.includes("password")) return "password";

  return "unknown";
}
