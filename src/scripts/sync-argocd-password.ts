/**
 * Sync ArgoCD Admin Password from K8s cluster to 1Password
 * Auto-fetch: reads from cluster secret, no user input needed
 */

import { orchestrateRotation, requireOpSignedIn } from "../lib/rotation-orchestrator";
import { getStrategy } from "../lib/secret-name-mapping";
import { getSecretConfig } from "../lib/secrets-config";
import { getActiveVault } from "../lib/vaults-config";
import { execa } from "execa";

async function syncArgoCDPassword() {
  // Fail early if op not signed in
  await requireOpSignedIn();

  const secretName = "ARGOCD_ADMIN_PASSWORD";
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
  console.log(`🔄 Syncing ${secretName} from K8s cluster`);
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
    console.error("❌ Cannot sync: op CLI not available");
    process.exit(1);
  }

  // Step 2: Check KUBECONFIG
  const kubeconfig = process.env.KUBECONFIG;
  if (!kubeconfig) {
    console.error("❌ KUBECONFIG not set");
    console.error("Run: export KUBECONFIG=/workspaces/rita-pve02/ansible/kubeconfig");
    process.exit(1);
  }

  // Step 3: Fetch password from cluster
  console.log("📡 Fetching password from K8s cluster...");
  let password: string;
  try {
    const result = await execa("kubectl", [
      "-n", "argocd",
      "get", "secret", "argocd-initial-admin-secret",
      "-o", "jsonpath={.data.password}"
    ]);
    
    const base64Password = result.stdout;
    password = Buffer.from(base64Password, "base64").toString("utf-8");
    
    if (!password) {
      console.error("❌ Password is empty - ArgoCD may not be installed");
      process.exit(1);
    }
    
    console.log("✓ Password retrieved from cluster");
  } catch (error) {
    console.error("❌ Failed to fetch password from cluster:");
    console.error("   Is ArgoCD installed? Is KUBECONFIG correct?");
    process.exit(1);
  }

  // Step 4: Update in 1Password
  try {
    // Check if item exists
    try {
      await execa("op", ["item", "get", "ARGOCD_ADMIN_PASSWORD", "--vault", activeVault]);
      // Item exists, edit it
      await execa("op", ["item", "edit", "ARGOCD_ADMIN_PASSWORD", `value=${password}`, "--vault", activeVault]);
    } catch {
      // Item doesn't exist, create it
      await execa("op", ["item", "create", "--vault", activeVault, "--category", "password", "--title", "ARGOCD_ADMIN_PASSWORD", `value=${password}`]);
    }
    console.log(`✓ ArgoCD admin password synced to 1Password`);
    console.log();
    console.log("📋 Access ArgoCD:");
    console.log("   URL: https://192.168.6.100:32533");
    console.log("   User: admin");
    console.log("   Password: (stored in 1Password)");
  } catch (error) {
    console.error(`❌ Failed to update 1Password:`, error);
    process.exit(1);
  }
}

syncArgoCDPassword();
