/**
 * Tailscale authentication command: Install and connect to Tailscale network
 */

import { Command, Flags } from "@oclif/core";
import chalk from "chalk";
import { execOutput, execJSON } from "../lib/exec";
import { loadConfig } from "../lib/config";

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

      // Check 3: Get auth key from vault
      console.log(chalk.gray("3️⃣  Reading TAILSCALE_AUTH_KEY from vault..."));
      const config = loadConfig();

      let authKey: string | undefined;
      try {
        authKey = await execOutput("op", [
          "read",
          "op://pve02/tailscale/auth-key",
        ]);
        authKey = authKey.trim();

        if (!authKey) {
          throw new Error("Auth key is empty");
        }

        console.log(chalk.green("   ✓ Auth key retrieved"));

        if (flags.verbose) {
          console.log(
            chalk.gray(`   Key preview: ${authKey.slice(0, 10)}...`)
          );
        }
      } catch (error) {
        console.log(
          chalk.red("   ✗ Failed to read TAILSCALE_AUTH_KEY from vault")
        );
        console.log(
          chalk.yellow(
            "   Run: npm run day0:secrets to initialize secrets first"
          )
        );
        process.exit(1);
      }

      // Check 4: Connect to Tailscale
      console.log(chalk.gray("4️⃣  Connecting to Tailscale network..."));

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
      console.log(chalk.gray("5️⃣  Verifying connection..."));
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
