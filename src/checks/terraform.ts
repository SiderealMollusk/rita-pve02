/**
 * Terraform checks
 */

import { Check, CheckResult, RunContext } from "../lib/types";
import { execOutput, exec } from "../lib/exec";

/**
 * Check: terraform CLI is installed
 */
export const terraformVersionCheck: Check = {
  id: "terraform-version",
  title: "Terraform version",
  tags: ["smoke", "terraform"],
  async run(): Promise<CheckResult> {
    try {
      const output = await execOutput("terraform", ["version"], {
        throwOnError: true,
      });
      return {
        status: "pass",
        message: output.split("\n")[0].trim(),
      };
    } catch {
      return {
        status: "fail",
        message: "Terraform CLI not found",
        details: "Install Terraform: https://www.terraform.io/downloads",
      };
    }
  },
};

/**
 * Check: terraform fmt passes
 */
export const terraformFmtCheck: Check = {
  id: "terraform-fmt",
  title: "Terraform format check",
  tags: ["terraform"],
  async run(ctx: RunContext): Promise<CheckResult> {
    try {
      const result = await exec("terraform", ["fmt", "-check", "terraform/"], {
        throwOnError: false,
      });

      if (result.failed) {
        return {
          status: "warn",
          message: "Terraform files not formatted",
          details: "Run: terraform fmt terraform/",
        };
      }

      return {
        status: "pass",
        message: "Terraform format OK",
      };
    } catch (error) {
      return {
        status: "warn",
        message: "Could not check Terraform format",
        details: error instanceof Error ? error.message : String(error),
      };
    }
  },
};

/**
 * Check: terraform init
 */
export const terraformInitCheck: Check = {
  id: "terraform-init",
  title: "Terraform workspace initialized",
  tags: ["terraform"],
  async run(ctx: RunContext): Promise<CheckResult> {
    try {
      const result = await exec("terraform", ["init"], {
        cwd: "terraform",
        throwOnError: false,
      });

      if (result.failed) {
        return {
          status: "fail",
          message: "Terraform init failed",
          details: result.stderr || result.stdout,
        };
      }

      return {
        status: "pass",
        message: "Terraform initialized",
      };
    } catch (error) {
      return {
        status: "fail",
        message: "Terraform init error",
        details: error instanceof Error ? error.message : String(error),
      };
    }
  },
};

/**
 * Check: terraform validate
 */
export const terraformValidateCheck: Check = {
  id: "terraform-validate",
  title: "Terraform configuration valid",
  tags: ["terraform"],
  async run(ctx: RunContext): Promise<CheckResult> {
    try {
      const result = await exec("terraform", ["validate"], {
        cwd: "terraform",
        throwOnError: false,
      });

      if (result.failed) {
        return {
          status: "fail",
          message: "Terraform validation failed",
          details: result.stderr || result.stdout,
        };
      }

      return {
        status: "pass",
        message: "Terraform configuration valid",
      };
    } catch (error) {
      return {
        status: "fail",
        message: "Terraform validate error",
        details: error instanceof Error ? error.message : String(error),
      };
    }
  },
};
