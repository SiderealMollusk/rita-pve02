/**
 * Rotation strategies for different secret types
 * Each strategy can initialize and rotate secrets with dry-run support
 */

import { randomBytes, generateKeyPairSync } from "crypto";
import { exec } from "./exec.js";
import {
  SecretEntry,
  RotationOptions,
  RotationResult,
} from "./secret-rotation.js";

export interface RotationStrategy {
  initialize(
    entry: SecretEntry,
    options: RotationOptions
  ): Promise<RotationResult>;
  rotate(
    entry: SecretEntry,
    options: RotationOptions
  ): Promise<RotationResult>;
}

/**
 * External secret strategy (must be provided manually or fetched from external API)
 */
function createExternalStrategy(
  name: string,
  instructions: string
): RotationStrategy {
  return {
    async initialize(entry, options) {
      const message = `${name} must be generated externally`;
      const details = instructions;

      if (options.dryRun) {
        return {
          success: true,
          newValue: `<${name.toUpperCase()}_PLACEHOLDER>`,
          dryRun: true,
          written: false,
        };
      }

      // In non-dry-run, return error with instructions
      return {
        success: false,
        dryRun: false,
        written: false,
        error: `${message}\n\n${details}\n\nOnce obtained, add to 1Password manually or use:\n  op item create --vault pve02 --title <item> <field>=<value>`,
      };
    },

    async rotate(entry, options) {
      return this.initialize(entry, options);
    },
  };
}

/**
 * Proxmox API Token strategy (external - to be implemented)
 */
const proxmoxAPITokenStrategy = createExternalStrategy(
  "Proxmox API Token",
  "Generate at: Proxmox UI → Datacenter → Permissions → API Tokens\nOr use Proxmox API (to be implemented later)"
);

/**
 * Tailscale Auth Key strategy (external - for production VMs)
 */
const tailscaleAuthKeyStrategy = createExternalStrategy(
  "Tailscale Auth Key",
  "Generate at: https://login.tailscale.com/admin/settings/keys\nSettings: Reusable, tag:vm, 90-day expiry\nFor production VMs joining tailnet"
);

/**
 * Tailscale API Token strategy (no-op - pve02-dev-container-sessions)
 * This is a manual-only secret. The user must generate it via the Tailscale admin console.
 * No automation possible - Tailscale API requires an existing token to create tokens.
 */
const tailscaleAPITokenStrategy = createExternalStrategy(
  "Tailscale API Token",
  "🔗 Generate here: https://login.tailscale.com/admin/settings/keys\n\nSettings:\n  • Type: Personal API token\n  • Expiry: 90 days\n  • Scope: API access (for pve02-dev-container-sessions)\n\nThis token lets the dev container generate ephemeral session keys.\nNo automation possible - requires existing token to create tokens."
);

/**
 * Generate a random secure password
 */
function generatePassword(length: number = 32): string {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  const bytes = randomBytes(length);
  return Array.from(bytes)
    .map((byte) => chars[byte % chars.length])
    .join("");
}

/**
 * Generate a random UUID
 */
function generateUUID(): string {
  return randomBytes(16).toString("hex").replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, "$1-$2-$3-$4-$5");
}

/**
 * Write secret to 1Password
 */
async function writeToOP(
  entry: SecretEntry,
  value: string,
  options: RotationOptions
): Promise<boolean> {
  if (options.dryRun) {
    return false; // Don't write in dry-run
  }

  const parts = entry.opRef.replace("op://", "").split("/");
  const vault = parts[0];
  const item = parts[1];
  const field = parts[2];

  try {
    // Try to update existing item
    await exec("op", [
      "item",
      "edit",
      item,
      `${field}=${value}`,
      "--vault",
      vault,
    ]);
    return true;
  } catch {
    // Item doesn't exist, create it
    try {
      await exec("op", [
        "item",
        "create",
        "--category",
        "password",
        "--title",
        item,
        "--vault",
        vault,
        `${field}=${value}`,
      ]);
      return true;
    } catch (error) {
      throw new Error(`Failed to write to 1Password: ${error}`);
    }
  }
}

/**
 * SSH Public Key strategy
 */
const sshPublicKeyStrategy: RotationStrategy = {
  async initialize(entry, options) {
    // Generate ED25519 key pair
    const { publicKey } = generateKeyPairSync("ed25519", {
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });

    // Convert to SSH format (simplified - in real use, use ssh-keygen)
    const newValue = publicKey.replace(/\n/g, "");

    try {
      const written = await writeToOP(entry, newValue, options);
      return {
        success: true,
        newValue,
        dryRun: options.dryRun || false,
        written,
      };
    } catch (error) {
      return {
        success: false,
        newValue,
        dryRun: options.dryRun || false,
        written: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },

  async rotate(entry, options) {
    return this.initialize(entry, options);
  },
};

/**
 * SSH Private Key strategy
 */
const sshPrivateKeyStrategy: RotationStrategy = {
  async initialize(entry, options) {
    const { privateKey } = generateKeyPairSync("ed25519", {
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });

    const newValue = privateKey;

    try {
      const written = await writeToOP(entry, newValue, options);
      return {
        success: true,
        newValue,
        dryRun: options.dryRun || false,
        written,
      };
    } catch (error) {
      return {
        success: false,
        newValue,
        dryRun: options.dryRun || false,
        written: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },

  async rotate(entry, options) {
    return this.initialize(entry, options);
  },
};

/**
 * Generic Password strategy
 */
const passwordStrategy: RotationStrategy = {
  async initialize(entry, options) {
    const newValue = generatePassword(32);

    try {
      const written = await writeToOP(entry, newValue, options);
      return {
        success: true,
        newValue,
        dryRun: options.dryRun || false,
        written,
      };
    } catch (error) {
      return {
        success: false,
        newValue,
        dryRun: options.dryRun || false,
        written: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },

  async rotate(entry, options) {
    return this.initialize(entry, options);
  },
};

/**
 * Rotation strategies registry
 */
export const rotationStrategies: Record<string, RotationStrategy> = {
  "proxmox-api-token": proxmoxAPITokenStrategy,
  "ssh-public-key": sshPublicKeyStrategy,
  "ssh-private-key": sshPrivateKeyStrategy,
  "tailscale-auth-key": tailscaleAuthKeyStrategy,
  "tailscale-api-token": tailscaleAPITokenStrategy,
  password: passwordStrategy,
};
