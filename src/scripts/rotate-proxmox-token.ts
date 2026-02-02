/**
 * Rotate Proxmox API Token
 * External no-op: user must generate from Proxmox UI
 */

import { orchestrateRotation, getRotationInstructions, requireOpSignedIn } from "../lib/rotation-orchestrator";
import { getStrategy } from "../lib/secret-name-mapping";
import { getSecretConfig } from "../lib/secrets-config";
import { getActiveVault } from "../lib/vaults-config";
import { createInterface } from "readline";

async function rotateProxmoxToken() {
  // Fail early if op not signed in
  await requireOpSignedIn();

  const secretName = "TF_VAR_PROXMOX_API_TOKEN";
  const secretConfig = getSecretConfig(secretName);
  
  if (!secretConfig) {
    console.error(`❌ Secret not found: ${secretName}`);
    process.exit(1);
  }

  const opPath = secretConfig.opPath;
  const strategy = getStrategy(secretName);

  if (!strategy) {
    console.error(`❌ No strategy found for ${secretName}`);
    process.exit(1);
  }

  const activeVault = getActiveVault();
  console.log(`🔄 Rotating ${secretName}`);
  if (secretConfig.description) {
    console.log(`   Purpose: ${secretConfig.description}`);
  }
  console.log();

  // Step 1: Orchestrate (check op, create dummy if needed)
  const state = await orchestrateRotation({
    secretName,
    opPath,
    strategy,
  });

  if (!state.opAvailable) {
    console.error("❌ Cannot rotate: op CLI not available");
    process.exit(1);
  }

  console.log();
  console.log(getRotationInstructions(strategy));
  console.log();

  // Step 2: Prompt for user input (token id + secret)
  const tokenId = await promptUser("Paste token ID (e.g., root@pam!token-id): ");
  if (!tokenId.trim()) {
    console.log("⏭️  Skipped");
    process.exit(0);
  }

  const tokenSecret = await promptUser("Paste token secret: ");
  if (!tokenSecret.trim()) {
    console.log("⏭️  Skipped");
    process.exit(0);
  }

  const combined = `${tokenId.trim()}=${tokenSecret.trim()}`;

  try {
    const { execa } = await import("execa");
    await execa("op", ["item", "edit", "PROXMOX_API_TOKEN", `value=${combined}`, "--vault", activeVault]);
    console.log(`✓ Proxmox API token updated`);
  } catch (error) {
    console.error(`❌ Failed to update token:`, error);
    process.exit(1);
  }
}

function promptUser(question: string): Promise<string> {
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

rotateProxmoxToken()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });
