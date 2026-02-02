/**
 * Day 0 command: Complete secret initialization workflow
 * 1. Creates all secret items in vault
 * 2. Auto-generates SSH keys
 * 3. Prompts for external secrets (Proxmox token, Tailscale keys)
 */

import { Command } from "@oclif/core";
import chalk from "chalk";
import { getStrategy } from "../lib/secret-name-mapping.js";
import { orchestrateRotation, getRotationInstructions, requireOpSignedIn } from "../lib/rotation-orchestrator.js";
import { getSecretConfig, loadSecretsConfig } from "../lib/secrets-config.js";
import { getActiveVault } from "../lib/vaults-config.js";
import { execa } from "execa";
import { createInterface } from "readline";
import { readFileSync } from "fs";

export default class Day0 extends Command {
  static description = "Day 0 initialization: Create secrets and populate with values";

  async run(): Promise<void> {
    try {
      // Step 1: Verify op is available
      console.log(chalk.bold("\n🚀 Day 0 Initialization\n"));
      await requireOpSignedIn();

      const config = loadSecretsConfig();
      const activeVault = getActiveVault();

      console.log(chalk.blue(`📝 Initializing ${config.secrets.length} secret(s)`));
      console.log(chalk.gray(`   Using vault: ${activeVault}\n`));

      // Step 2: Create all secret items
      console.log(chalk.cyan("Step 1: Creating secret items..."));
      for (const secret of config.secrets) {
        const strategy = getStrategy(secret.name);
        if (!strategy) {
          console.log(chalk.red(`  ✗ ${secret.name}: No strategy found`));
          continue;
        }

        const state = await orchestrateRotation({
          secretName: secret.name,
          opPath: secret.opPath,
          strategy,
        });

        if (state.createdDummy) {
          console.log(chalk.gray(`  ✓ ${secret.name}`));
        }
      }

      // Step 3: Rotate SSH keys (auto-generate)
      console.log(chalk.cyan("\nStep 2: Generating SSH keys..."));
      await this.rotateSSHKeys();

      // Step 4: Prompt for external secrets
      console.log(chalk.cyan("\nStep 3: Prompting for external secrets..."));
      await this.promptForExternalSecrets();

      console.log(chalk.green("\n✓ Day 0 initialization complete!\n"));
    } catch (error) {
      console.error(chalk.red("\n✗ Day 0 initialization failed:"));
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  }

  private async rotateSSHKeys(): Promise<void> {
    const secretName = "VM_INIT_SSH_PRIVATE_KEY";
    const secretConfig = getSecretConfig(secretName);

    if (!secretConfig) {
      console.error(chalk.red(`❌ Secret not found: ${secretName}`));
      return;
    }

    try {
      const homeDir = process.env.HOME || "/root";
      const keyPath = `${homeDir}/.ssh/id_ed25519_tmp`;
      const activeVault = getActiveVault();

      // Remove temp files if they exist
      await execa("rm", ["-f", keyPath, `${keyPath}.pub`]);

      // Generate ED25519 keypair
      await execa("ssh-keygen", [
        "-t", "ed25519",
        "-f", keyPath,
        "-N", "",
        "-C", "vm-init@pve02",
        "-q",
      ]);

      // Read and store keys
      const privateKey = readFileSync(keyPath, "utf-8");
      const publicKey = readFileSync(`${keyPath}.pub`, "utf-8");

      await execa("op", ["item", "edit", "VM_INIT_SSH_PRIVATE_KEY", `value=${privateKey}`, "--vault", activeVault]);
      
      // Also store public key
      const publicKeySecretName = "VM_INIT_SSH_PUBLIC_KEY";
      await execa("op", ["item", "edit", "VM_INIT_SSH_PUBLIC_KEY", `value=${publicKey}`, "--vault", activeVault]);

      console.log(chalk.gray(`  ✓ SSH keys generated and stored`));

      // Cleanup
      await execa("rm", [keyPath, `${keyPath}.pub`]);
    } catch (error) {
      console.error(chalk.red(`❌ Failed to generate SSH keys:`, error));
    }
  }

  private async promptForExternalSecrets(): Promise<void> {
    const externalSecrets = [
      {
        name: "TF_VAR_PROXMOX_API_TOKEN",
        item: "PROXMOX_API_TOKEN",
        prompt: "Proxmox API Token",
        instructions: `
Go to Proxmox UI → Datacenter → API Tokens
Create a new API token (or copy existing)
    You will paste the Token ID and Token Secret separately`,
      },
      {
        name: "TAILSCALE_AUTH_KEY",
        item: "TAILSCALE_AUTH_KEY",
        prompt: "Tailscale Auth Key",
        instructions: `
Go to https://login.tailscale.com/admin/settings/keys
Create an Auth key (reusable, expiry=90 days)
Format: tskey-auth-...`,
      },
      {
        name: "TAILSCALE_API_TOKEN",
        item: "TAILSCALE_API_TOKEN",
        prompt: "Tailscale API Token",
        instructions: `
Go to https://login.tailscale.com/admin/settings/keys
Create a Personal API token (expiry=90 days)
Format: tskey-api-...`,
      },
    ];

    const activeVault = getActiveVault();

    for (const secret of externalSecrets) {
      console.log(chalk.yellow(`\n  ${secret.prompt}`));
      console.log(chalk.gray(secret.instructions));

      if (secret.name === "TF_VAR_PROXMOX_API_TOKEN") {
        const tokenId = await this.promptUser(`\n  Paste Token ID (root@pam!token-id) or press Enter to skip: `);
        if (!tokenId.trim()) {
          console.log(chalk.gray(`  ⏭️  Skipped`));
          continue;
        }

        const tokenSecret = await this.promptUser(`  Paste Token Secret: `);
        if (!tokenSecret.trim()) {
          console.log(chalk.gray(`  ⏭️  Skipped`));
          continue;
        }

        const combined = `${tokenId.trim()}=${tokenSecret.trim()}`;
        try {
          await execa("op", ["item", "edit", secret.item, `value=${combined}`, "--vault", activeVault]);
          console.log(chalk.gray(`  ✓ ${secret.prompt} stored`));
        } catch (error) {
          console.error(chalk.red(`  ✗ Failed to store ${secret.prompt}`));
        }
        continue;
      }

      const value = await this.promptUser(`\n  Paste ${secret.prompt} (or press Enter to skip): `);

      if (value.trim()) {
        try {
          await execa("op", ["item", "edit", secret.item, `value=${value}`, "--vault", activeVault]);
          console.log(chalk.gray(`  ✓ ${secret.prompt} stored`));
        } catch (error) {
          console.error(chalk.red(`  ✗ Failed to store ${secret.prompt}`));
        }
      } else {
        console.log(chalk.gray(`  ⏭️  Skipped`));
      }
    }
  }

  private promptUser(question: string): Promise<string> {
    return new Promise((resolve) => {
      const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      rl.question(question, (answer) => {
        rl.close();
        resolve(answer);
      });
    });
  }
}
