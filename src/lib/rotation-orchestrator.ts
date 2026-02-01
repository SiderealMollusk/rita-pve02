/**
 * Shared rotation orchestrator
 * Parent function that all rotation scripts use
 */

import { execa } from "execa";
import { getStrategy } from "./secret-name-mapping";

export interface RotationContext {
  secretName: string;
  opPath: string;
  strategy: string;
}

export interface RotationState {
  opAvailable: boolean;
  pathExists: boolean;
  currentValue?: string;
  createdDummy: boolean;
}

/**
 * Check if op CLI is available
 */
export async function checkOpAvailable(): Promise<boolean> {
  try {
    await execa("op", ["--version"]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a secret path exists in op
 */
export async function checkOpPathExists(opPath: string): Promise<{ exists: boolean; value?: string }> {
  try {
    const result = await execa("op", ["read", opPath]);
    return { exists: true, value: result.stdout };
  } catch {
    return { exists: false };
  }
}

/**
 * Create a dummy value in op for a secret that doesn't exist
 */
export async function createDummyInOp(opPath: string): Promise<boolean> {
  try {
    const [vault, item, field] = opPath.replace("op://", "").split("/");

    // Check if item exists, if not create it
    try {
      await execa("op", ["item", "get", item, "--vault", vault]);
    } catch {
      // Item doesn't exist, create it
      await execa("op", ["item", "create", "--vault", vault, "--category", "password", "--title", item, `${field}=PLACEHOLDER`]);
    }

    return true;
  } catch (error) {
    console.error(`Failed to create dummy value for ${opPath}:`, error);
    return false;
  }
}

/**
 * Get instructions for a rotation strategy
 */
export function getRotationInstructions(strategy: string): string {
  const instructions: Record<string, string> = {
    "proxmox-api-token": `
🔗 Proxmox API Token
1. Go to your Proxmox interface
2. Navigate to Datacenter → Permissions → API Tokens
3. Create a new API token
4. Copy the token value
5. Paste it below (or press Ctrl+C to skip):`,

    "ssh-public-key": `
🔑 SSH Public Key
This will be auto-generated from your SSH private key.`,

    "ssh-private-key": `
🔑 SSH Private Key (ED25519)
This will be auto-generated. A new keypair will be created.`,

    "tailscale-auth-key": `
🔗 Tailscale Auth Key
1. Go to https://login.tailscale.com/admin/settings/keys
2. Click "Generate auth key"
3. Settings: Reusable=Yes, Tags=tag:vm, Expiry=90 days
4. Copy the key (format: tskey-...)
5. Paste it below (or press Ctrl+C to skip):`,

    "tailscale-api-token": `
🔗 Tailscale API Token
1. Go to https://login.tailscale.com/admin/settings/keys
2. Create a Personal API token
3. Settings: Expiry=90 days
4. Copy the token (format: tskey-api-...)
5. Paste it below (or press Ctrl+C to skip):`,
  };

  return instructions[strategy] || `Unknown strategy: ${strategy}`;
}

/**
 * Orchestrate rotation for a single secret
 */
export async function orchestrateRotation(context: RotationContext): Promise<RotationState> {
  const state: RotationState = {
    opAvailable: false,
    pathExists: false,
    createdDummy: false,
  };

  // Step 1: Check op availability
  state.opAvailable = await checkOpAvailable();
  if (!state.opAvailable) {
    console.error("❌ op CLI not available in container");
    return state;
  }

  // Step 2: Check if path exists in op
  const pathCheck = await checkOpPathExists(context.opPath);
  state.pathExists = pathCheck.exists;
  state.currentValue = pathCheck.value;

  if (!state.pathExists) {
    console.log(`ℹ️  Path ${context.opPath} doesn't exist in op vault`);
    console.log(`📝 Creating placeholder...`);
    state.createdDummy = await createDummyInOp(context.opPath);

    if (!state.createdDummy) {
      console.error(`❌ Failed to create placeholder`);
      return state;
    }
    console.log(`✓ Placeholder created`);
  }

  return state;
}
