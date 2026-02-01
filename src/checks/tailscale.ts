/**
 * Tailscale CLI checks
 */

import { Check, CheckResult, RunContext } from "../lib/types";
import { execOutput, execJSON } from "../lib/exec";

interface TailscaleStatus {
  BackendState: string;
  Self?: {
    TailscaleIPs?: string[];
  };
  Peer?: Record<
    string,
    {
      TailscaleIPs?: string[];
      HostName?: string;
    }
  >;
}

/**
 * Check: tailscale CLI is installed
 */
export const tailscaleVersionCheck: Check = {
  id: "tailscale-version",
  title: "Tailscale version",
  tags: ["smoke", "tailscale"],
  async run(): Promise<CheckResult> {
    try {
      const output = await execOutput("tailscale", ["version"]);
      return {
        status: "pass",
        message: output.split("\n")[0].trim(),
      };
    } catch {
      return {
        status: "fail",
        message: "Tailscale CLI not found",
        details: "Install Tailscale: https://tailscale.com/download",
      };
    }
  },
};

/**
 * Check: tailscale is up and authenticated
 */
export const tailscaleUpCheck: Check = {
  id: "tailscale-up",
  title: "Tailscale is up",
  tags: ["preflight", "tailscale"],
  async run(): Promise<CheckResult> {
    try {
      const status = await execJSON<TailscaleStatus>(
        "tailscale",
        ["status", "--json"],
        { throwOnError: true }
      );

      const backendState = status.BackendState || "unknown";

      if (backendState === "Running") {
        const selfIPs = status.Self?.TailscaleIPs || [];
        return {
          status: "pass",
          message: selfIPs.length > 0 ? selfIPs[0] : "Connected",
        };
      } else {
        return {
          status: "fail",
          message: `Tailscale not running: ${backendState}`,
          details: "Run: tailscale up",
        };
      }
    } catch (error) {
      return {
        status: "fail",
        message: "Failed to check Tailscale status",
        details: error instanceof Error ? error.message : String(error),
      };
    }
  },
};

/**
 * Check: expected tailscale nodes exist with correct IPs
 * Expects ctx.config to have a targets format: "name=ip,name=ip"
 */
export const tailscaleTargetsCheck: Check = {
  id: "tailscale-targets",
  title: "Tailscale targets reachable",
  tags: ["preflight", "tailscale"],
  async run(ctx: RunContext): Promise<CheckResult> {
    // Parse targets from config (if provided)
    const targetsStr = (ctx.config as Record<string, unknown>)
      .tailscaleTargets as string | undefined;

    if (!targetsStr) {
      return {
        status: "skip",
        message: "No tailscale targets configured",
      };
    }

    try {
      const status = await execJSON<TailscaleStatus>(
        "tailscale",
        ["status", "--json"],
        { throwOnError: true }
      );

      const targets = Object.fromEntries(
        targetsStr.split(",").map((pair) => {
          const [name, ip] = pair.split("=");
          return [name.trim(), ip.trim()];
        })
      );

      const missing: string[] = [];
      const mismatch: string[] = [];

      const allPeers = status.Peer || {};

      for (const [name, expectedIP] of Object.entries(targets)) {
        const peer = Object.values(allPeers).find(
          (p) => p.HostName?.includes(name)
        );

        if (!peer) {
          missing.push(name);
        } else if (
          peer.TailscaleIPs &&
          !peer.TailscaleIPs.includes(expectedIP)
        ) {
          mismatch.push(`${name}: expected ${expectedIP}, got ${peer.TailscaleIPs[0]}`);
        }
      }

      if (missing.length > 0 || mismatch.length > 0) {
        const details = [
          ...(missing.length > 0 ? [`Missing: ${missing.join(", ")}`] : []),
          ...(mismatch.length > 0 ? [`Mismatch:\n${mismatch.join("\n")}`] : []),
        ].join("\n");

        return {
          status: "fail",
          message: `${missing.length} missing, ${mismatch.length} mismatched`,
          details,
        };
      }

      return {
        status: "pass",
        message: `All ${Object.keys(targets).length} target(s) reachable`,
      };
    } catch (error) {
      return {
        status: "fail",
        message: "Failed to check Tailscale targets",
        details: error instanceof Error ? error.message : String(error),
      };
    }
  },
};
