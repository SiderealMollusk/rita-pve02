/**
 * Safe shell execution wrapper using execa
 */

import { execa, ExecaError, Options } from "execa";
import { RunContext } from "./types.js";

export interface ExecOptions extends Options {
  throwOnError?: boolean;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  code: number;
  failed: boolean;
}

/**
 * Execute a shell command safely
 * Throws on non-zero exit unless throwOnError is false
 */
export async function exec(
  command: string,
  args: string[] = [],
  options: ExecOptions = {}
): Promise<ExecResult> {
  const { throwOnError = true, ...execaOpts } = options;

  try {
    const result = await execa(command, args, {
      stdio: "pipe" as const,
      ...execaOpts,
    });

    return {
      stdout: String(result.stdout || ""),
      stderr: String(result.stderr || ""),
      code: result.exitCode ?? 0,
      failed: false,
    };
  } catch (error) {
    const execError = error as ExecaError;

    const result: ExecResult = {
      stdout: String(execError.stdout || ""),
      stderr: String(execError.stderr || ""),
      code: execError.exitCode ?? 1,
      failed: true,
    };

    if (throwOnError) {
      throw new Error(
        `Command failed: ${command} ${args.join(" ")}\n${result.stderr}`
      );
    }

    return result;
  }
}

/**
 * Execute a shell command and return stdout only
 */
export async function execOutput(
  command: string,
  args: string[] = [],
  options: ExecOptions = {}
): Promise<string> {
  const result = await exec(command, args, options);
  return result.stdout.trim();
}

/**
 * Execute a shell command and parse JSON output
 */
export async function execJSON<T>(
  command: string,
  args: string[] = [],
  options: ExecOptions = {}
): Promise<T> {
  const output = await execOutput(command, args, options);
  return JSON.parse(output);
}

/**
 * Check if a command exists in PATH
 */
export async function commandExists(command: string): Promise<boolean> {
  try {
    await exec("which", [command]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Run a command with environment variables injected from secrets.env
 */
export async function execWithSecrets(
  command: string,
  args: string[] = [],
  secretsEnv: string,
  options: ExecOptions = {}
): Promise<ExecResult> {
  const { throwOnError = true, ...rest } = options;

  try {
    const result = await execa(command, args, {
      stdio: "pipe" as const,
      env: {
        ...process.env,
      },
      ...rest,
    });

    return {
      stdout: String(result.stdout || ""),
      stderr: String(result.stderr || ""),
      code: result.exitCode ?? 0,
      failed: false,
    };
  } catch (error) {
    const execError = error as ExecaError;

    const result: ExecResult = {
      stdout: String(execError.stdout || ""),
      stderr: String(execError.stderr || ""),
      code: execError.exitCode ?? 1,
      failed: true,
    };

    if (throwOnError) {
      throw new Error(
        `Command failed: ${command} ${args.join(" ")}\n${result.stderr}`
      );
    }

    return result;
  }
}
