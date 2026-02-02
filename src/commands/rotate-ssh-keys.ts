/**
 * Rotate SSH keys
 * Auto-generates ED25519 keypair
 */

import { execa } from "execa";
import { orchestrateRotation, getRotationInstructions, requireOpSignedIn } from "../lib/rotation-orchestrator";
import { getStrategy } from "../lib/secret-name-mapping";
import { getSecretConfig } from "../lib/secrets-config";

async function rotateSshKeys() {
  // Fail early if op not signed in
  await requireOpSignedIn();

  const secretName = "VM_INIT_SSH_PRIVATE_KEY";
  const opPath = "op://pve02/vm-init-ssh/private-key";
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

  // Step 2: Generate new SSH key
  try {
    const homeDir = process.env.HOME || "/root";
    const keyPath = `${homeDir}/.ssh/id_ed25519_tmp`;

    // Remove temp files if they exist (from previous interrupted runs)
    await execa("rm", ["-f", keyPath, `${keyPath}.pub`]);

    console.log(`🔑 Generating ED25519 keypair...`);
    await execa("ssh-keygen", [
      "-t",
      "ed25519",
      "-f",
      keyPath,
      "-N",
      "",
      "-C",
      "vm-init@pve02",
      "-q", // Quiet mode - no progress output
    ]);

    // Read the generated private key
    const { readFileSync } = await import("fs");
    const privateKey = readFileSync(keyPath, "utf-8");

    // Store in op
    console.log(`✓ Generated. Storing in vault...`);
    await execa("op", ["item", "edit", "vm-init-ssh", `private-key=${privateKey}`, "--vault", "pve02"]);

    // Also update public key
    const publicKey = readFileSync(`${keyPath}.pub`, "utf-8");
    await execa("op", ["item", "edit", "vm-init-ssh", `public-key=${publicKey}`, "--vault", "pve02"]);

    console.log(`✓ SSH keys rotated successfully\n`);

    // Cleanup temp files
    await execa("rm", [keyPath, `${keyPath}.pub`]);
  } catch (error) {
    console.error(`❌ Failed to generate/store SSH keys:`, error);
    process.exit(1);
  }
}

rotateSshKeys()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });
