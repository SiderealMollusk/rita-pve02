/**
 * Tailscale authentication command: Install and connect to Tailscale network
 */

import { Command, Flags } from "@oclif/core";
import chalk from "chalk";
import { execOutput, execJSON } from "../lib/exec.js";
import { loadConfig } from "../lib/config.js";
import { checkOpAvailable, checkOpPathExists } from "../lib/rotation-orchestrator.js";

interface TailscaleStatus {
  BackendState?: string;
  Self?: {
    TailscaleIPs?: string[];
  };
}

export default class TailscaleUp extends Command {
  static description = "Authenticate with Tailscale network";

  static flags = {
    "dry-run": Flags.boolean({
      description: "Show what would happen without connecting",
      default: false,
    }),
    verbose: Flags.boolean({
      description: "Verbose output",
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(TailscaleUp);

    try {
      console.log(chalk.blue("\n🔗 Tailscale Setup\n"));

      // Check 1: Tailscale installed
      console.log(chalk.gray("1️⃣  Checking Tailscale installed..."));
      try {
        const version = await execOutput("tailscale", ["version"]);
        console.log(chalk.green(`   ✓ Tailscale ${version.split("\n")[0].trim()}`));
      } catch {
        console.log(
          chalk.red(
            "   ✗ Tailscale not installed\n   Run: https://tailscale.com/download"
          )
        );
        process.exit(1);
      }

      // Check 2: Not already authenticated
      console.log(chalk.gray("2️⃣  Checking authentication status..."));
      try {
        const status = await execJSON<TailscaleStatus>("tailscale", [
          "status",
          "--json",
        ]);

        if (status.BackendState === "Running" && status.Self?.TailscaleIPs?.length) {
          console.log(
            chalk.yellow(
              `   ⊘ Already authenticated: ${status.Self.TailscaleIPs[0]}`
            )
          );
          console.log(chalk.blue("\n✓ Tailscale is ready!\n"));
          return;
        }
      } catch {
        // Not authenticated, continue
      }

      // Check 3: 1Password CLI available
      console.log(chalk.gray("3️⃣  Checking 1Password CLI..."));
      const opAvailable = await checkOpAvailable();
      if (!opAvailable) {
        console.log(
          chalk.red("   ✗ op CLI not available")
        );
        console.log(
          chalk.yellow("   Install: https://developer.1password.com/docs/cli/get-started")
        );
        process.exit(1);
      }
      console.log(chalk.green("   ✓ op CLI available"));

      // Check 4: Auth key exists in vault
      console.log(chalk.gray("4️⃣  Checking TAILSCALE_AUTH_KEY..."));
      const authKeyCheck = await checkOpPathExists(
        "op://pve02/tailscale/AUTH_KEY"
      );

      let authKey: string | undefined;

      if (!authKeyCheck.exists) {
        console.log(chalk.red("   ✗ Auth key not in vault"));
        console.log(
          chalk.yellow(
            "   Run: npm run rotate:tailscale-auth-key to generate"
          )
        );
        process.exit(1);
      }

      if (!authKeyCheck.value || authKeyCheck.value.trim() === "") {
        console.log(chalk.red("   ✗ Auth key is empty"));
        console.log(
          chalk.yellow(
            "   Run: npm run rotate:tailscale-auth-key to generate"
          )
        );
        process.exit(1);
      }

      authKey = authKeyCheck.value.trim();
      console.log(chalk.green("   ✓ Auth key found in vault"));

      if (!authKey) {
        process.exit(1);
      }

      // Check 5: Connect to Tailscale
      console.log(chalk.gray("5️⃣  Connecting to Tailscale network..."));

      if (flags["dry-run"]) {
        console.log(
          chalk.yellow(
            "   ⊙ Would run: tailscale up --authkey=<key>"
          )
        );
        console.log(chalk.blue("\n✓ Dry-run complete!\n"));
        return;
      }

      try {
        await execOutput("tailscale", ["up", `--authkey=${authKey}`]);
        console.log(chalk.green("   ✓ Connected to Tailscale"));
      } catch (error) {
        console.log(
          chalk.red(
            "   ✗ Failed to connect to Tailscale"
          )
        );
        console.log(
          chalk.yellow(
            "   You may need to run: sudo tailscale up --authkey=<key>"
          )
        );
        process.exit(1);
      }

      // Verify connected
      console.log(chalk.gray("6️⃣  Verifying connection..."));
      try {
        const status = await execJSON<TailscaleStatus>("tailscale", [
          "status",
          "--json",
        ]);

        if (status.BackendState === "Running" && status.Self?.TailscaleIPs?.length) {
          console.log(
            chalk.green(`   ✓ Connected: ${status.Self.TailscaleIPs[0]}`)
          );
          console.log(chalk.blue("\n✓ Tailscale is ready!\n"));
        } else {
          throw new Error("Not fully connected yet");
        }
      } catch (error) {
        console.log(
          chalk.yellow("   ⚠ Connection status unclear, but tailscale up completed")
        );
        console.log(
          chalk.yellow("   Run: tailscale status to verify manually")
        );
      }
    } catch (error) {
      console.error(chalk.red("✗ Tailscale setup failed:"));
      console.error(
        chalk.red(error instanceof Error ? error.message : String(error))
      );
      process.exit(1);
    }
  }
}
