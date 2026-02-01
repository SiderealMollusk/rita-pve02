/**
 * Rotate Tailscale API Token
 * External no-op: user must generate from Tailscale UI
 */

import { orchestrateRotation, getRotationInstructions } from "../lib/rotation-orchestrator";
import { getStrategy } from "../lib/secret-name-mapping";
import { createInterface } from "readline";

async function rotateTailscaleApiToken() {
  const secretName = "TAILSCALE_API_TOKEN";
  const opPath = "op://pve02/tailscale/api-token";
  const strategy = getStrategy(secretName);

  if (!strategy) {
    console.error(`❌ No strategy found for ${secretName}`);
    process.exit(1);
  }

  console.log(`🔄 Rotating ${secretName}\n`);

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

  rl.question("Paste API token here: ", async (token) => {
    rl.close();

    if (!token.trim()) {
      console.log("⏭️  Skipped");
      process.exit(0);
    }

    try {
      const { execa } = await import("execa");
      await execa("op", ["item", "edit", "tailscale", `api-token=${token}`, "--vault", "pve02"]);
      console.log(`✓ Tailscale API token updated`);
    } catch (error) {
      console.error(`❌ Failed to update token:`, error);
      process.exit(1);
    }
  });
}

rotateTailscaleApiToken();
