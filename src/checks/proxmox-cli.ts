/**
 * Proxmox CLI and API checks
 */

import { Check, CheckResult, RunContext } from "../lib/types";
import { exec, execOutput } from "../lib/exec";

/**
 * Check: qm CLI is available (Proxmox management)
 */
export const qmVersionCheck: Check = {
  id: "qm-version",
  title: "Proxmox qm CLI available",
  tags: ["preflight", "proxmox"],
  async run(): Promise<CheckResult> {
    try {
      const output = await execOutput("qm", ["version"], {
        throwOnError: true,
      });
      return {
        status: "pass",
        message: output.split("\n")[0]?.trim() || "qm available",
      };
    } catch {
      return {
        status: "warn",
        message: "qm CLI not found on this host",
        details: "Note: qm is only available on Proxmox hosts. This check can be skipped in dev.",
      };
    }
  },
};

/**
 * Check: Proxmox API is reachable
 */
export const proxmoxAPICheck: Check = {
  id: "proxmox-api",
  title: "Proxmox API reachable",
  tags: ["preflight", "proxmox"],
  async run(ctx: RunContext): Promise<CheckResult> {
    const endpoint = ctx.config.proxyEndpoint;

    if (!endpoint) {
      return {
        status: "fail",
        message: "TF_VAR_proxmox_endpoint not configured",
      };
    }

    try {
      const result = await exec("curl", [
        "-kfsS",
        `${endpoint}api2/json/version`,
      ], {
        throwOnError: true,
      });

      if (result.code === 0) {
        return {
          status: "pass",
          message: endpoint,
        };
      } else {
        return {
          status: "fail",
          message: "Proxmox API returned error",
          details: result.stderr || result.stdout,
        };
      }
    } catch (error) {
      return {
        status: "fail",
        message: "Proxmox API unreachable",
        details: error instanceof Error ? error.message : String(error),
      };
    }
  },
};

/**
 * Check: Disk space available (50GB+)
 */
export const diskSpaceCheck: Check = {
  id: "disk-space",
  title: "Disk space available (50GB+)",
  tags: ["preflight", "proxmox"],
  async run(ctx: RunContext): Promise<CheckResult> {
    try {
      // Use df to check root filesystem
      const result = await exec("df", ["-BG", "/"], {
        throwOnError: true,
      });

      const lines = result.stdout.split("\n");
      const dataLine = lines[1]; // Second line is the data

      if (!dataLine) {
        return {
          status: "warn",
          message: "Could not parse disk output",
        };
      }

      const parts = dataLine.split(/\s+/);
      const available = parseInt(parts[3]); // Available column

      if (available >= 50) {
        return {
          status: "pass",
          message: `${available}GB available`,
        };
      } else {
        return {
          status: "warn",
          message: `Only ${available}GB available (need 50GB+)`,
        };
      }
    } catch (error) {
      return {
        status: "warn",
        message: "Could not check disk space",
        details: error instanceof Error ? error.message : String(error),
      };
    }
  },
};
