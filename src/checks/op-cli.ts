/**
 * 1Password CLI checks
 */

import { Check, CheckResult, RunContext } from "../lib/types";
import { exec, execOutput, commandExists } from "../lib/exec";
import { validateSecretsTemplate } from "../lib/config";

/**
 * Check: op CLI is installed
 */
export const opVersionCheck: Check = {
  id: "op-installed",
  title: "1Password CLI installed",
  tags: ["smoke", "op"],
  async run(): Promise<CheckResult> {
    try {
      const output = await execOutput("op", ["--version"]);
      return {
        status: "pass",
        message: `v${output.trim()}`,
      };
    } catch {
      return {
        status: "fail",
        message: "op CLI not found",
        details: "Install 1Password CLI: https://developer.1password.com/docs/cli/get-started",
      };
    }
  },
};

/**
 * Check: op account is added
 */
export const opAccountCheck: Check = {
  id: "op-account",
  title: "1Password account added",
  tags: ["smoke", "op"],
  async run(): Promise<CheckResult> {
    try {
      const output = await execOutput("op", ["account", "list"], {
        throwOnError: true,
      });
      
      const lines = output.trim().split("\n");
      const accountCount = lines.length - 1; // Subtract header line
      
      if (accountCount === 0) {
        return {
          status: "fail",
          message: "No accounts added",
          details: "Run: op account add",
        };
      }
      
      return {
        status: "pass",
        message: `${accountCount} account(s)`,
      };
    } catch {
      return {
        status: "fail",
        message: "Failed to list accounts",
        details: "Run: op account add",
      };
    }
  },
};

/**
 * Check: op is signed in
 */
export const opAuthCheck: Check = {
  id: "op-signed-in",
  title: "1Password signed in",
  tags: ["smoke", "op"],
  async run(): Promise<CheckResult> {
    try {
      const output = await execOutput("op", ["whoami"]);
      return {
        status: "pass",
        message: output.trim(),
      };
    } catch {
      return {
        status: "fail",
        message: "Not signed in",
        details: "Run: eval $(op signin)",
      };
    }
  },
};

/**
 * Check: vault exists
 */
export const opVaultCheck: Check = {
  id: "op-vault",
  title: "1Password vault exists",
  tags: ["preflight", "op"],
  async run(ctx: RunContext): Promise<CheckResult> {
    const vault = ctx.config.vault;

    if (!vault) {
      return {
        status: "fail",
        message: "OP_VAULT not configured",
      };
    }

    try {
      await execOutput("op", ["vault", "get", vault]);
      return {
        status: "pass",
        message: vault,
      };
    } catch {
      return {
        status: "fail",
        message: `Vault not found: ${vault}`,
        details: `Run: op vault list`,
      };
    }
  },
};

/**
 * Check: secret references resolve
 */
export const opSecretsResolveCheck: Check = {
  id: "op-secrets-resolve",
  title: "1Password secret references resolve",
  tags: ["preflight", "op"],
  async run(ctx: RunContext): Promise<CheckResult> {
    try {
      const refs = validateSecretsTemplate(ctx.config.secretsTemplate);

      if (refs.length === 0) {
        return {
          status: "warn",
          message: "No secret references found in template",
        };
      }

      const failed: string[] = [];

      for (const ref of refs) {
        try {
          const value = await execOutput("op", ["read", ref], {
            throwOnError: true,
          });

          if (!value || value.trim() === "") {
            failed.push(`${ref} (empty)`);
          }
        } catch {
          failed.push(ref);
        }
      }

      if (failed.length > 0) {
        return {
          status: "fail",
          message: `${failed.length} secret(s) failed to resolve`,
          details: failed.join("\n"),
        };
      }

      return {
        status: "pass",
        message: `${refs.length} reference(s) resolved`,
      };
    } catch (error) {
      return {
        status: "fail",
        message: "Error validating secrets",
        details: error instanceof Error ? error.message : String(error),
      };
    }
  },
};
