/**
 * Init command: Initialize secrets in 1Password vault
 */

import { Command, Flags } from "@oclif/core";
import chalk from "chalk";
import { parseSecretsTemplate } from "../lib/secret-rotation.js";
import { rotationStrategies } from "../lib/rotation-strategies.js";
import { resolve } from "path";

export default class Init extends Command {
  static description =
    "Initialize secrets in 1Password from secrets.template";

  static flags = {
    "dry-run": Flags.boolean({
      description: "Show what would be created without writing to 1Password",
      default: false,
    }),
    verbose: Flags.boolean({
      description: "Verbose output",
      default: false,
    }),
    force: Flags.boolean({
      description: "Overwrite existing secrets",
      default: false,
    }),
    "skip-external": Flags.boolean({
      description: "Skip external secrets (Proxmox token, Tailscale key)",
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Init);

    try {
      const templatePath = resolve(process.cwd(), "secrets.template");
      const entries = parseSecretsTemplate(templatePath);

      console.log(
        chalk.blue(`\n📝 Found ${entries.length} secret(s) to initialize\n`)
      );

      if (flags["dry-run"]) {
        console.log(chalk.yellow("🔍 DRY RUN MODE - No changes will be made\n"));
      }

      let succeeded = 0;
      let failed = 0;
      let skipped = 0;

      for (const entry of entries) {
        // Skip external secrets if flag is set
        if (flags["skip-external"] && (entry.type === "proxmox-api-token" || entry.type === "tailscale-auth-key")) {
          console.log(
            chalk.gray(`  ⊘ ${entry.envVar}: Skipped (external)`)
          );
          skipped++;
          continue;
        }

        const strategy = rotationStrategies[entry.type];

        if (!strategy) {
          console.log(
            chalk.red(
              `✗ ${entry.envVar}: No strategy for type "${entry.type}"`
            )
          );
          failed++;
          continue;
        }

        try {
          console.log(chalk.gray(`  Initializing ${entry.envVar}...`));

          const result = await strategy.initialize(entry, {
            dryRun: flags["dry-run"],
            verbose: flags.verbose,
          });

          if (result.success) {
            if (result.dryRun) {
              console.log(
                chalk.yellow(
                  `  ⊙ ${entry.envVar}: Would create (${entry.type})`
                )
              );
              if (flags.verbose) {
                console.log(
                  chalk.gray(`    Value: ${result.newValue?.slice(0, 40)}...`)
                );
              }
              skipped++;
            } else {
              console.log(
                chalk.green(`  ✓ ${entry.envVar}: Created in ${entry.opRef}`)
              );
              succeeded++;
            }
          } else {
            console.log(chalk.red(`  ✗ ${entry.envVar}: ${result.error}`));
            failed++;
          }
        } catch (error) {
          console.log(
            chalk.red(
              `  ✗ ${entry.envVar}: ${error instanceof Error ? error.message : String(error)}`
            )
          );
          failed++;
        }
      }

      // Summary
      console.log("");
      console.log(chalk.bold("═".repeat(50)));
      console.log(chalk.bold(`Summary:`));
      console.log(`  Total: ${entries.length}`);
      if (flags["dry-run"]) {
        console.log(chalk.yellow(`  Would create: ${skipped}`));
      } else {
        console.log(chalk.green(`  Created: ${succeeded}`));
      }
      if (failed > 0) {
        console.log(chalk.red(`  Failed: ${failed}`));
      }
      console.log(chalk.bold("═".repeat(50)));
      console.log("");

      if (failed > 0) {
        process.exit(1);
      }

      if (flags["dry-run"]) {
        console.log(
          chalk.blue(
            "💡 Run without --dry-run to create secrets in 1Password"
          )
        );
      } else {
        console.log(
          chalk.green(
            "✓ Secrets initialized! Run 'npm run preflight' to test."
          )
        );
      }
    } catch (error) {
      console.error(chalk.red("✗ Initialization failed:"));
      console.error(
        chalk.red(error instanceof Error ? error.message : String(error))
      );
      process.exit(1);
    }
  }
}
