/**
 * Preflight command: Run comprehensive checks before deployment
 */

import { Command, Flags } from "@oclif/core";
import chalk from "chalk";
import { loadConfig, isSecretsEnvStale } from "../lib/config";
import { initializeSecrets } from "../lib/secrets";
import { runChain } from "../lib/chains";
import { formatChainReports, createChainReport } from "../lib/summary";
import { Check, RunContext } from "../lib/types";

// Import all checks
import {
  opVersionCheck,
  opAccountCheck,
  opAuthCheck,
  opVaultCheck,
  opSecretsResolveCheck,
} from "../checks/op-cli";
import {
  tailscaleVersionCheck,
  tailscaleUpCheck,
  tailscaleTargetsCheck,
} from "../checks/tailscale";
import {
  qmVersionCheck,
  proxmoxAPICheck,
  diskSpaceCheck,
} from "../checks/proxmox-cli";
import {
  terraformVersionCheck,
  terraformFmtCheck,
  terraformInitCheck,
  terraformValidateCheck,
} from "../checks/terraform";
import { sshPrivateKeyCheck, ansibleInventoryCheck } from "../checks/ssh-keys";
import { secretsExistCheck, secretsValidateCheck } from "../checks/secrets";

export default class Preflight extends Command {
  static description = "Run comprehensive preflight checks before deployment";

  static flags = {
    vault: Flags.string({
      description: "1Password vault name",
      env: "OP_VAULT",
    }),
    json: Flags.boolean({
      description: "Output as JSON",
      default: false,
    }),
    "dry-run": Flags.boolean({
      description: "Perform checks without applying changes",
      default: true,
    }),
    verbose: Flags.boolean({
      description: "Verbose output",
      default: false,
    }),
    "only-tags": Flags.string({
      description: "Run only checks with these tags (comma-separated)",
    }),
    from: Flags.string({
      description: "Start from check ID",
    }),
    to: Flags.string({
      description: "Stop at check ID",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Preflight);

    try {
      // Load configuration
      const config = loadConfig();

      // Warn if secrets.env is stale
      if (isSecretsEnvStale(config.secretsEnv)) {
        console.warn(
          chalk.yellow(`⚠️  Warning: stale ${config.secretsEnv} exists`)
        );
      }

      const ctx: RunContext = {
        config,
        dryRun: flags["dry-run"],
        verbose: flags.verbose,
      };

      const onlyTags = flags["only-tags"]?.split(",").map((t) => t.trim());

      // Define chains
      const smokeChecks: Check[] = [
        opVersionCheck,
        opAccountCheck,
        opAuthCheck,
        terraformVersionCheck,
        tailscaleVersionCheck,
      ];

      const preflightChecks: Check[] = [
        opAuthCheck,
        opVaultCheck,
        secretsExistCheck,
        secretsValidateCheck,
        tailscaleUpCheck,
        tailscaleTargetsCheck,
        qmVersionCheck,
        proxmoxAPICheck,
        diskSpaceCheck,
        sshPrivateKeyCheck,
        ansibleInventoryCheck,
      ];

      // Run chains
      console.log("");
      console.log(chalk.bold("▶ Running preflight checks..."));

      const smokeReport = await runChain(
        {
          name: "Smoke Checks",
          checks: smokeChecks,
          dryRun: flags["dry-run"],
          verbose: flags.verbose,
          onlyTags,
          from: flags.from,
          to: flags.to,
        },
        ctx
      );

      const preflightReport = await runChain(
        {
          name: "Preflight Checks",
          checks: preflightChecks,
          dryRun: flags["dry-run"],
          verbose: flags.verbose,
          onlyTags,
          from: flags.from,
          to: flags.to,
        },
        ctx
      );

      // Format output
      if (flags.json) {
        // JSON output
        const smokeChainReport = createChainReport("smoke", smokeReport);
        const preflightChainReport = createChainReport("preflight", preflightReport);

        console.log(
          JSON.stringify(
            {
              chains: [smokeChainReport, preflightChainReport],
              summary: {
                total: smokeReport.length + preflightReport.length,
                passed: [
                  ...smokeReport,
                  ...preflightReport,
                ].filter((r) => r.result.status === "pass").length,
                failed: [
                  ...smokeReport,
                  ...preflightReport,
                ].filter((r) => r.result.status === "fail").length,
              },
            },
            null,
            2
          )
        );
      } else {
        // TUI output with summary
        const smokeChainReport = createChainReport("Smoke Checks", smokeReport);
        const preflightChainReport = createChainReport("Preflight Checks", preflightReport);

        console.log(formatChainReports([smokeChainReport, preflightChainReport]));
      }

      // Exit with error if any failed
      const hasFailed = [
        ...smokeReport,
        ...preflightReport,
      ].some((r) => r.result.status === "fail");

      if (hasFailed) {
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red("✗ Preflight failed:"));
      console.error(
        chalk.red(
          error instanceof Error ? error.message : String(error)
        )
      );
      process.exit(1);
    }
  }
}
