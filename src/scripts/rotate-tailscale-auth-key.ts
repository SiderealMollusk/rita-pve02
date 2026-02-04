/**
 * Rotate Tailscale Auth Key
 * External no-op: user must generate from Tailscale UI
 */

import { orchestrateRotation, getRotationInstructions, requireOpSignedIn } from "../lib/rotation-orchestrator.js";
import { getStrategy } from "../lib/secrets-config.js";
import { getSecretConfig } from "../lib/secrets-config.js";
import { getActiveVault } from "../lib/vaults-config.js";
import { createInterface } from "readline";

async function rotateTailscaleAuthKey() {
  // Fail early if op not signed in
  await requireOpSignedIn();

  const secretName = "TAILSCALE_AUTH_KEY";
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

  // Step 2: Prompt for user input
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question("Paste auth key here: ", async (key) => {
    rl.close();

    if (!key.trim()) {
      console.log("⏭️  Skipped");
      process.exit(0);
    }

    try {
      const { execa } = await import("execa");
      await execa("op", ["item", "edit", "tailscale", `AUTH_KEY=${key}`, "--vault", activeVault]);
      console.log(`✓ Tailscale auth key updated`);
    } catch (error) {
      console.error(`❌ Failed to update key:`, error);
      process.exit(1);
    }
  });
}

rotateTailscaleAuthKey()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });
