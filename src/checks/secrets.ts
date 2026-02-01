/**
 * Secret validation checks
 * Ensures all required secrets exist and are valid in 1Password
 */

import { Check, CheckResult, RunContext } from "../lib/types";
import { parseSecretsTemplate } from "../lib/secrets-template-parser";
import { getStrategy } from "../lib/secret-name-mapping";
import { execOutput } from "../lib/exec";

/**
 * Check: all required secrets exist in 1Password
 */
export const secretsExistCheck: Check = {
  id: "secrets-exist",
  title: "Required secrets exist in 1Password",
  tags: ["preflight", "secrets"],
  async run(ctx: RunContext): Promise<CheckResult> {
    try {
      const secretLines = parseSecretsTemplate(ctx.config.secretsTemplate);

      if (secretLines.length === 0) {
        return {
          status: "warn",
          message: "No secrets defined in template",
        };
      }

      const missing: string[] = [];
      const empty: string[] = [];
      const valid: string[] = [];

      for (const line of secretLines) {
        try {
          const value = await execOutput("op", ["read", line.opPath], {
            throwOnError: true,
          });

          if (!value || value.trim() === "") {
            empty.push(line.name);
          } else {
            valid.push(line.name);
          }
        } catch {
          missing.push(line.name);
        }
      }

      if (missing.length > 0) {
        return {
          status: "fail",
          message: `${missing.length} secret(s) not found`,
          details: [
            `Missing: ${missing.join(", ")}`,
            `Run: npm run dev -- init`,
          ].join("\n"),
        };
      }

      if (empty.length > 0) {
        return {
          status: "fail",
          message: `${empty.length} secret(s) are empty`,
          details: [
            `Empty: ${empty.join(", ")}`,
            `Run: npm run dev -- init --force`,
          ].join("\n"),
        };
      }

      return {
        status: "pass",
        message: `All ${valid.length} secrets valid`,
        details: valid.join(", "),
      };
    } catch (error) {
      return {
        status: "fail",
        message: "Failed to check secrets",
        details: error instanceof Error ? error.message : String(error),
      };
    }
  },
};

/**
 * Check: secret types match expected patterns
 */
export const secretsValidateCheck: Check = {
  id: "secrets-validate",
  title: "Secret values match expected format",
  tags: ["preflight", "secrets"],
  async run(ctx: RunContext): Promise<CheckResult> {
    try {
      const secretLines = parseSecretsTemplate(ctx.config.secretsTemplate);
      const invalid: string[] = [];
      const valid: string[] = [];

      for (const line of secretLines) {
        const strategy = getStrategy(line.name);
        
        if (!strategy) {
          continue; // Unknown secrets skip validation
        }

        try {
          const value = await execOutput("op", ["read", line.opPath], {
            throwOnError: true,
          });

          if (!value || value.trim() === "") {
            continue; // secretsExistCheck handles this
          }

          // Validate format based on strategy type
          let isValid = true;
          switch (strategy) {
            case "ssh-public-key":
              isValid = value.startsWith("ssh-") || value.includes("BEGIN PUBLIC KEY");
              break;
            case "ssh-private-key":
              isValid = value.includes("BEGIN PRIVATE KEY") || value.includes("BEGIN OPENSSH PRIVATE KEY");
              break;
            case "proxmox-api-token":
              isValid = /^[A-Za-z0-9-]+=[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value.trim());
              break;
            case "tailscale-auth-key":
              isValid = value.startsWith("tskey-");
              break;
            case "tailscale-api-token":
              isValid = value.startsWith("tskey-api-");
              break;
            default:
              isValid = true; // Unknown types pass
          }

          if (isValid) {
            valid.push(line.name);
          } else {
            invalid.push(`${line.name} (${strategy})`);
          }
        } catch {
          continue; // secretsExistCheck handles missing secrets
        }
      }

      if (invalid.length > 0) {
        return {
          status: "warn",
          message: `${invalid.length} secret(s) may have invalid format`,
          details: `Check: ${invalid.join(", ")}`,
        };
      }

      if (valid.length === 0) {
        return {
          status: "skip",
          message: "No secrets to validate",
        };
      }

      return {
        status: "pass",
        message: `${valid.length} secret(s) validated`,
      };
    } catch (error) {
      return {
        status: "fail",
        message: "Failed to validate secrets",
        details: error instanceof Error ? error.message : String(error),
      };
    }
  },
};
