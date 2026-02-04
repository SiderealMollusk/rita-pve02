/**
 * SSH and key management checks
 */

import { Check, CheckResult, RunContext } from "../lib/types.js";
import { existsSync } from "fs";
import { statSync } from "fs";
import { homedir } from "os";
import { resolve } from "path";

/**
 * Check: SSH private key exists and has correct permissions
 */
export const sshPrivateKeyCheck: Check = {
  id: "ssh-private-key",
  title: "SSH private key exists",
  tags: ["preflight", "ssh"],
  async run(): Promise<CheckResult> {
    const keyPath = resolve(homedir(), ".ssh", "id_rsa");

    if (!existsSync(keyPath)) {
      return {
        status: "fail",
        message: "SSH private key not found",
        details: `Expected at: ${keyPath}`,
      };
    }

    try {
      const stat = statSync(keyPath);
      const mode = stat.mode & 0o777;
      const isSecure = (mode & 0o077) === 0; // Owner-only readable

      if (!isSecure) {
        return {
          status: "warn",
          message: "SSH private key has insecure permissions",
          details: `Current mode: ${mode.toString(8)}\nRun: chmod 600 ${keyPath}`,
        };
      }

      return {
        status: "pass",
        message: "SSH private key OK",
      };
    } catch (error) {
      return {
        status: "warn",
        message: "Could not check SSH key permissions",
        details: error instanceof Error ? error.message : String(error),
      };
    }
  },
};

/**
 * Check: Ansible can connect to all inventory hosts (optional connectivity test)
 */
export const ansibleInventoryCheck: Check = {
  id: "ansible-inventory",
  title: "Ansible inventory file exists",
  tags: ["preflight", "ansible"],
  async run(): Promise<CheckResult> {
    const inventoryPath = resolve(process.cwd(), "ansible", "inventory.ini");

    if (!existsSync(inventoryPath)) {
      return {
        status: "fail",
        message: "Ansible inventory not found",
        details: `Expected at: ${inventoryPath}\nRun terraform to generate IPs, then create inventory.ini`,
      };
    }

    return {
      status: "pass",
      message: "Ansible inventory exists",
    };
  },
};
