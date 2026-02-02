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
 * Check if op CLI is signed in
 */
export async function checkOpSignedIn(): Promise<boolean> {
  try {
    await execa("op", ["whoami"]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure op CLI is signed in, fail early with instructions if not
 */
export async function requireOpSignedIn(): Promise<void> {
  const available = await checkOpAvailable();
  if (!available) {
    console.error("❌ op CLI not available");
    console.error("Install: https://developer.1password.com/docs/cli/get-started");
    process.exit(1);
  }

  const signedIn = await checkOpSignedIn();
  if (!signedIn) {
    console.error("❌ Not signed in to 1Password");
    console.error("Run: op signin");
    process.exit(1);
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

    // Create descriptive titles based on item name
    const titleMap: Record<string, string> = {
      "PROXMOX_API_TOKEN": "PROXMOX_API_TOKEN",
      "VM_INIT_SSH_PRIVATE_KEY": "VM_INIT_SSH_PRIVATE_KEY",
      "VM_INIT_SSH_PUBLIC_KEY": "VM_INIT_SSH_PUBLIC_KEY",
      "TAILSCALE_AUTH_KEY": "TAILSCALE_AUTH_KEY",
      "TAILSCALE_API_TOKEN": "TAILSCALE_API_TOKEN",
      "PROXMOX_SSH_HOST": "PROXMOX_SSH_HOST",
    };

    const title = titleMap[item] || item;

    // Check if item exists
    let itemExists = false;
    try {
      await execa("op", ["item", "get", item, "--vault", vault]);
      itemExists = true;
    } catch {
      itemExists = false;
    }

    // If item exists, delete it first so we can recreate with correct title
    if (itemExists) {
      try {
        await execa("op", ["item", "delete", item, "--vault", vault, "--archive"]);
      } catch {
        // Ignore deletion errors, might already be deleted
      }
    }

    // Create the item with correct title
    await execa("op", ["item", "create", "--vault", vault, "--category", "password", "--title", title, `${field}=PLACEHOLDER`]);

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
