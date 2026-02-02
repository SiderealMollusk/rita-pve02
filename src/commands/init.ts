/**
 * Init command: Initialize secrets in 1Password vault
 */

import { Command, Flags } from "@oclif/core";
import chalk from "chalk";
import { parseSecretsTemplate as parseTemplate } from "../lib/secrets-template-parser.js";
import { getStrategy } from "../lib/secret-name-mapping.js";
import { orchestrateRotation, getRotationInstructions } from "../lib/rotation-orchestrator.js";
import { getActiveVault } from "../lib/vaults-config.js";
import { resolve } from "path";

export default class Init extends Command {
  static description =
    "Initialize secrets in 1Password from secrets.template";

  static flags = {
    verbose: Flags.boolean({
      description: "Verbose output",
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Init);

    try {
      const { loadSecretsConfig } = await import("../lib/secrets-config.js");
      const config = loadSecretsConfig();
      const activeVault = getActiveVault();

      console.log(
        chalk.blue(`\n📝 Found ${config.secrets.length} secret(s) to initialize`)
      );
      console.log(chalk.gray(`   Using vault: ${activeVault}\n`));

      let succeeded = 0;
      let failed = 0;

      for (const secret of config.secrets) {
        const strategy = getStrategy(secret.name);
        
        if (!strategy) {
          console.log(
            chalk.red(`  ✗ ${secret.name}: No strategy found`)
          );
          failed++;
          continue;
        }

        console.log(chalk.cyan(`\n📝 Initializing ${secret.name}`));
        console.log(chalk.gray(`   Strategy: ${strategy}`));
        console.log(chalk.gray(`   Path: ${secret.opPath}`));

        // Orchestrate the rotation/initialization
        const state = await orchestrateRotation({
          secretName: secret.name,
          opPath: secret.opPath,
          strategy,
        });

        if (!state.opAvailable) {
          console.log(chalk.red(`  ✗ op CLI not available`));
          failed++;
          continue;
        }

        if (state.pathExists && state.currentValue && state.currentValue !== "PLACEHOLDER") {
          console.log(chalk.gray(`  → Already initialized (value exists)`));
          succeeded++;
          continue;
        }

        // For secrets that were just created with placeholder, they're ready
        if (state.createdDummy) {
          console.log(chalk.green(`  ✓ Placeholder created - awaiting population`));
          succeeded++;
          continue;
        }

        // If we got here, the secret exists but is empty - show instructions
        if (state.pathExists) {
          console.log(getRotationInstructions(strategy));
          succeeded++;
        }
      }

      console.log(chalk.blue(`\n✓ Initialization complete`));
      console.log(chalk.gray(`  Succeeded: ${succeeded}`));
      console.log(chalk.gray(`  Failed: ${failed}\n`));

      if (failed > 0) {
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red("\n✗ Error:"), error);
      process.exit(1);
    }
  }
}
