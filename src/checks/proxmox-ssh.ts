/**
 * Proxmox SSH connectivity checks (keys + IPs pulled from 1Password)
 */

import { Check, CheckResult, RunContext } from "../lib/types.js";
import { exec, execOutput, commandExists } from "../lib/exec.js";
import { readFileSync, writeFileSync, mkdtempSync, rmSync, chmodSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { getActiveVault } from "../lib/vaults-config.js";

interface SecretsConfig {
  secrets: Array<{
    name: string;
    opPath: string;
  }>;
  sshTargets?: Array<{
    name: string;
    hostOpPath: string;
    user: string;
    port?: number;
    keyName: string;
  }>;
}

function loadSecretsConfig(): SecretsConfig {
  const raw = readFileSync("secrets.config.json", "utf-8");
  return JSON.parse(raw) as SecretsConfig;
}

export const proxmoxSshCheck: Check = {
  id: "proxmox-ssh",
  title: "Proxmox reachable over SSH (op keys + IPs)",
  tags: ["preflight", "proxmox", "ssh"],
  async run(ctx: RunContext): Promise<CheckResult> {
    try {
      const opAvailable = await commandExists("op");
      if (!opAvailable) {
        return {
          status: "fail",
          message: "op CLI not available",
          details: "Install: https://developer.1password.com/docs/cli/get-started",
        };
      }

      const config = loadSecretsConfig();
      const targets = config.sshTargets || [];

      if (targets.length === 0) {
        return {
          status: "skip",
          message: "No sshTargets configured in secrets.config.json",
        };
      }

      const missingKeyRefs: string[] = [];
      const failures: string[] = [];

      for (const target of targets) {
        const keyEntry = config.secrets.find((s) => s.name === target.keyName);

        if (!keyEntry) {
          missingKeyRefs.push(`${target.name}: keyName ${target.keyName} not found`);
          continue;
        }

        const host = await execOutput("op", ["read", target.hostOpPath], {
          throwOnError: true,
        });

        const privateKey = await execOutput("op", ["read", keyEntry.opPath], {
          throwOnError: true,
        });

        if (!host || host.trim() === "") {
          failures.push(`${target.name}: empty host in ${target.hostOpPath}`);
          continue;
        }

        if (!privateKey || privateKey.trim() === "") {
          failures.push(`${target.name}: empty key in ${keyEntry.opPath}`);
          continue;
        }

        if (ctx.dryRun) {
          continue;
        }

        const dir = mkdtempSync(join(tmpdir(), "proxmox-ssh-"));
        const keyPath = join(dir, "id_ed25519");

        try {
          writeFileSync(keyPath, privateKey, { mode: 0o600 });
          chmodSync(keyPath, 0o600);

          const port = target.port ?? 22;
          const user = target.user;
          const destination = `${user}@${host.trim()}`;

          const result = await exec(
            "ssh",
            [
              "-i",
              keyPath,
              "-p",
              String(port),
              "-o",
              "BatchMode=yes",
              "-o",
              "StrictHostKeyChecking=no",
              "-o",
              "ConnectTimeout=5",
              destination,
              "echo",
              "ok",
            ],
            { throwOnError: false }
          );

          if (result.failed) {
            failures.push(`${target.name}: ${result.stderr || result.stdout || "ssh failed"}`);
          }
        } finally {
          rmSync(dir, { recursive: true, force: true });
        }
      }

      if (missingKeyRefs.length > 0) {
        return {
          status: "fail",
          message: "SSH key references missing",
          details: missingKeyRefs.join("\n"),
        };
      }

      if (ctx.dryRun) {
        return {
          status: "skip",
          message: `Dry run: ${targets.length} target(s) would be checked`,
        };
      }

      if (failures.length > 0) {
        return {
          status: "fail",
          message: `${failures.length} SSH target(s) failed`,
          details: failures.join("\n"),
        };
      }

      return {
        status: "pass",
        message: `All ${targets.length} SSH target(s) reachable`,
      };
    } catch (error) {
      return {
        status: "fail",
        message: "Failed to check Proxmox SSH connectivity",
        details: error instanceof Error ? error.message : String(error),
      };
    }
  },
};
