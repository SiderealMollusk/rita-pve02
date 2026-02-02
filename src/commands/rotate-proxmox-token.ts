/**
 * Rotate Proxmox API Token
 * External no-op: user must generate from Proxmox UI
 */

import { orchestrateRotation, getRotationInstructions, requireOpSignedIn } from "../lib/rotation-orchestrator";
import { getStrategy } from "../lib/secret-name-mapping";
import { getSecretConfig } from "../lib/secrets-config";
import { createInterface } from "readline";

async function rotateProxmoxToken() {
  // Fail early if op not signed in
  await requireOpSignedIn();

  const secretName = "TF_VAR_PROXMOX_API_TOKEN";
  const opPath = "op://pve02/proxmox/api-token";
  const strategy = getStrategy(secretName);

  if (!strategy) {
    console.error(`❌ No strategy found for ${secretName}`);
    process.exit(1);
  }

  const config = getSecretConfig(secretName);
  console.log(`🔄 Rotating ${secretName}`);
  if (config?.description) {
    console.log(`   Purpose: ${config.description}`);
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

  // Step 2: Prompt for user input
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question("Paste token here: ", async (token) => {
    rl.close();

    if (!token.trim()) {
      console.log("⏭️  Skipped");
      process.exit(0);
    }

    try {
      const { execa } = await import("execa");
      await execa("op", ["item", "edit", "proxmox", `api-token=${token}`, "--vault", "pve02"]);
      console.log(`✓ Proxmox API token updated`);
    } catch (error) {
      console.error(`❌ Failed to update token:`, error);
      process.exit(1);
    }
  });
}

rotateProxmoxToken()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });
