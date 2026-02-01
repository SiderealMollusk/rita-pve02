/**
 * Secrets.env lifecycle management
 * - Warns if stale secrets.env exists
 * - Generates fresh secrets.env via op inject
 * - Loads into process.env
 * - Cleans up on exit (best-effort)
 */

import { existsSync, unlinkSync, readFileSync } from "fs";
import { exec, execOutput } from "./exec";
import chalk from "chalk";

export interface SecretsManagerOptions {
  secretsTemplate: string;
  secretsEnv: string;
  verbose?: boolean;
}

export class SecretsManager {
  private template: string;
  private env: string;
  private verbose: boolean;

  constructor(options: SecretsManagerOptions) {
    this.template = options.secretsTemplate;
    this.env = options.secretsEnv;
    this.verbose = options.verbose || false;
  }

  /**
   * Check if stale secrets.env exists
   */
  isStale(): boolean {
    return existsSync(this.env);
  }

  /**
   * Warn if stale secrets exist
   */
  warnIfStale(): void {
    if (this.isStale()) {
      console.warn(
        chalk.yellow(
          `⚠️  Warning: stale ${this.env} exists. Deleting and regenerating...`
        )
      );
    }
  }

  /**
   * Generate secrets.env from template via op inject
   * Throws if op is not authenticated or references cannot be resolved
   */
  async generate(): Promise<void> {
    // Delete any stale secrets.env
    if (existsSync(this.env)) {
      try {
        unlinkSync(this.env);
        if (this.verbose) {
          console.log(chalk.gray(`  Cleaned up stale ${this.env}`));
        }
      } catch (error) {
        throw new Error(`Failed to delete stale ${this.env}: ${error}`);
      }
    }

    // Generate via op inject
    if (this.verbose) {
      console.log(chalk.gray(`  Generating ${this.env} via op inject...`));
    }

    try {
      await exec("op", [
        "inject",
        "-i",
        this.template,
        "-o",
        this.env,
      ]);

      if (this.verbose) {
        console.log(chalk.gray(`  ✓ Generated ${this.env}`));
      }
    } catch (error) {
      throw new Error(
        `Failed to generate secrets.env via op inject: ${error}`
      );
    }
  }

  /**
   * Load secrets from secrets.env into process.env
   */
  async load(): Promise<void> {
    if (!existsSync(this.env)) {
      throw new Error(`${this.env} not found. Did you call generate()?`);
    }

    try {
      const content = readFileSync(this.env, "utf-8");
      const lines = content.split("\n").filter((line) => line.trim());

      for (const line of lines) {
        if (line.startsWith("#")) continue; // Skip comments

        const [key, ...rest] = line.split("=");
        if (key && rest.length > 0) {
          const value = rest.join("=").trim();
          // Remove surrounding quotes if present
          const cleanValue = value.startsWith('"') && value.endsWith('"')
            ? value.slice(1, -1)
            : value;
          process.env[key.trim()] = cleanValue;
        }
      }

      if (this.verbose) {
        console.log(chalk.gray(`  ✓ Loaded secrets into process.env`));
      }
    } catch (error) {
      throw new Error(`Failed to load ${this.env}: ${error}`);
    }
  }

  /**
   * Clean up secrets.env
   * Best-effort: logs errors but doesn't throw
   */
  cleanup(): void {
    if (existsSync(this.env)) {
      try {
        unlinkSync(this.env);
        if (this.verbose) {
          console.log(chalk.gray(`  ✓ Cleaned up ${this.env}`));
        }
      } catch (error) {
        console.error(
          chalk.red(`  ✗ Failed to cleanup ${this.env}: ${error}`)
        );
      }
    }
  }

  /**
   * Register cleanup handler on process exit
   */
  registerCleanup(): void {
    process.on("exit", () => this.cleanup());
    process.on("SIGINT", () => {
      this.cleanup();
      process.exit(0);
    });
  }
}

/**
 * Convenience function to generate and load secrets in one call
 */
export async function initializeSecrets(
  options: SecretsManagerOptions
): Promise<SecretsManager> {
  const manager = new SecretsManager(options);

  manager.warnIfStale();
  await manager.generate();
  await manager.load();
  manager.registerCleanup();

  return manager;
}
