/**
 * Secret validation checks
 * Ensures all required secrets exist and are valid in 1Password
 */

import { Check, CheckResult, RunContext } from "../lib/types.js";
import { exec, execJSON, execOutput } from "../lib/exec.js";
import { loadSecretsConfig, getStrategy } from "../lib/secrets-config.js";
import { tmpdir } from "os";
import { join } from "path";
import { writeFileSync, rmSync, chmodSync } from "fs";

/**
 * Check: all required secrets exist in 1Password
 */
export const secretsExistCheck: Check = {
  id: "secrets-exist",
  title: "Required secrets exist in 1Password",
  tags: ["preflight", "secrets"],
  async run(ctx: RunContext): Promise<CheckResult> {
    try {
      const config = loadSecretsConfig();
      const secretLines = config.secrets;

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
      const config = loadSecretsConfig();
      const secretLines = config.secrets;
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
              isValid = /^[^@\s]+@[^!\s]+![^=\s]+=[^\s]+$/.test(value.trim());
              break;
            case "tailscale-auth-key":
              isValid = value.startsWith("tskey-auth-");
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

/**
 * Check: minimal functional validation for each secret
 */
export const secretsFunctionalCheck: Check = {
  id: "secrets-functional",
  title: "Secrets pass minimal functional checks",
  tags: ["preflight", "secrets", "functional"],
  async run(ctx: RunContext): Promise<CheckResult> {
    try {
      const config = loadSecretsConfig();
      const byName = Object.fromEntries(config.secrets.map((s: { name: string, opPath: string }) => [s.name, s.opPath]));

      const failures: string[] = [];
      const passes: string[] = [];
      const skipped: string[] = [];

      // 1) Proxmox API token -> call /api2/json/version
      const proxmoxTokenPath = byName.TF_VAR_PROXMOX_API_TOKEN;
      if (proxmoxTokenPath) {
        const token = await execOutput("op", ["read", proxmoxTokenPath], { throwOnError: true });
        const endpoint = (ctx.config as Record<string, string>).proxyEndpoint || process.env.TF_VAR_proxmox_endpoint;
        if (!endpoint) {
          failures.push("TF_VAR_PROXMOX_API_TOKEN: missing TF_VAR_proxmox_endpoint");
        } else {
          const url = `${endpoint.replace(/\/$/, "")}/api2/json/version`;
          try {
            const response = await execJSON<{ data?: { version?: string } }>("curl", [
              "-sk",
              "-H",
              `Authorization: PVEAPIToken=${token.trim()}`,
              url,
            ]);

            if (response?.data?.version) {
              passes.push("TF_VAR_PROXMOX_API_TOKEN");
            } else {
              failures.push("TF_VAR_PROXMOX_API_TOKEN: invalid response from Proxmox API");
            }
          } catch (error) {
            failures.push(`TF_VAR_PROXMOX_API_TOKEN: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }

      // 2) SSH public/private key match
      const privatePath = byName.VM_INIT_SSH_PRIVATE_KEY;
      const publicPath = byName.TF_VAR_SSH_PUBLIC_KEY;
      if (privatePath && publicPath) {
        try {
          // Read without trim to preserve SSH key format (requires trailing newline)
          const privateKeyRaw = await exec("op", ["read", privatePath], { throwOnError: true });
          const publicKeyRaw = await exec("op", ["read", publicPath], { throwOnError: true });
          const privateKey = privateKeyRaw.stdout;
          const publicKey = publicKeyRaw.stdout.trim();

          if (!privateKey || privateKey === "PLACEHOLDER") {
            failures.push("SSH keys: private key is empty or placeholder (run: npm run rotate:ssh-keys)");
            return {
              status: "fail",
              message: "1 functional check failed",
              details: failures.join("\n"),
            };
          }

          if (!privateKey.includes("BEGIN OPENSSH PRIVATE KEY")) {
            failures.push("SSH keys: private key is not OpenSSH format (run: npm run rotate:ssh-keys)");
            return {
              status: "fail",
              message: "1 functional check failed",
              details: failures.join("\n"),
            };
          }

          if (!publicKey || publicKey === "PLACEHOLDER") {
            failures.push("SSH keys: public key is empty or placeholder (run: npm run rotate:ssh-keys)");
            return {
              status: "fail",
              message: "1 functional check failed",
              details: failures.join("\n"),
            };
          }

          const tmpDir = tmpdir();
          const keyFile = join(tmpDir, `vm-init-${Date.now()}`);
          // Ensure private key ends with newline (required for SSH key format)
          const privateKeyWithNewline = privateKey.endsWith("\n") ? privateKey : privateKey + "\n";
          writeFileSync(keyFile, privateKeyWithNewline, "utf-8");
          chmodSync(keyFile, 0o600);

          const deriveResult = await exec("ssh-keygen", ["-y", "-f", keyFile], { throwOnError: false });
          rmSync(keyFile, { force: true });

          if (deriveResult.failed) {
            failures.push(`SSH keys: ${deriveResult.stderr || "invalid private key"}`);
          } else {
            const normalize = (val: string) => val.trim().split(/\s+/).slice(0, 2).join(" ");
            if (normalize(deriveResult.stdout) === normalize(publicKey)) {
            passes.push("VM_INIT_SSH_PRIVATE_KEY/TF_VAR_SSH_PUBLIC_KEY");
            } else {
              failures.push("SSH keys: public key does not match private key");
            }
          }
        } catch (error) {
          failures.push(`SSH keys: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // 3) Tailscale API token -> list devices
      const tsApiPath = byName.TAILSCALE_API_TOKEN;
      if (tsApiPath) {
        try {
          const token = await execOutput("op", ["read", tsApiPath], { throwOnError: true });
          const response = await execJSON<{ devices?: unknown[] }>("curl", [
            "-s",
            "-u",
            `${token.trim()}:`,
            "https://api.tailscale.com/api/v2/tailnet/-/devices",
          ]);

          if (Array.isArray(response?.devices)) {
            passes.push("TAILSCALE_API_TOKEN");
          } else {
            failures.push("TAILSCALE_API_TOKEN: invalid response from Tailscale API");
          }
        } catch (error) {
          failures.push(`TAILSCALE_API_TOKEN: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // 4) Tailscale auth key -> minimal use (only if tailscale is not running)
      const tsAuthPath = byName.TAILSCALE_AUTH_KEY;
      if (tsAuthPath) {
        try {
          const authKey = await execOutput("op", ["read", tsAuthPath], { throwOnError: true });
          const statusResult = await exec("tailscale", ["status", "--json"], { throwOnError: false });
          let running = false;

          if (statusResult.failed) {
            skipped.push("TAILSCALE_AUTH_KEY (tailscaled not running)");
          } else if (statusResult.stdout.trim()) {
            try {
              const status = JSON.parse(statusResult.stdout.trim()) as { BackendState?: string };
              running = status?.BackendState === "Running";
            } catch {
              skipped.push("TAILSCALE_AUTH_KEY (unable to parse tailscale status)");
            }
          }

          if (running) {
            passes.push("TAILSCALE_AUTH_KEY (already connected)");
          } else if (!statusResult.failed) {
            const upResult = await exec("tailscale", ["up", "--authkey", authKey.trim()], { throwOnError: false });
            if (!upResult.failed) {
              await exec("tailscale", ["down"], { throwOnError: false });
              passes.push("TAILSCALE_AUTH_KEY");
            } else {
              failures.push(`TAILSCALE_AUTH_KEY: ${upResult.stderr || "failed to authenticate"}`);
            }
          }
        } catch (error) {
          failures.push(`TAILSCALE_AUTH_KEY: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      if (failures.length > 0) {
        return {
          status: "fail",
          message: `${failures.length} functional check(s) failed`,
          details: failures.join("\n"),
        };
      }

      if (passes.length === 0 && skipped.length > 0) {
        return {
          status: "skip",
          message: `${skipped.length} functional check(s) skipped`,
          details: skipped.join(", "),
        };
      }

      if (passes.length === 0) {
        return {
          status: "skip",
          message: "No functional checks run",
        };
      }

      return {
        status: "pass",
        message: `${passes.length} functional check(s) passed`,
        details: [
          passes.join(", "),
          skipped.length > 0 ? `Skipped: ${skipped.join(", ")}` : "",
        ].filter(Boolean).join("\n"),
      };
    } catch (error) {
      return {
        status: "fail",
        message: "Failed to run functional checks",
        details: error instanceof Error ? error.message : String(error),
      };
    }
  },
};
