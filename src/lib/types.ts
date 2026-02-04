/**
 * Core types for the lab CLI check/action framework
 */

export type CheckStatus = "pass" | "fail" | "warn" | "skip";

export interface CheckResult {
  status: CheckStatus;
  message?: string;
  details?: string;
  data?: unknown;
  duration?: number;
}

export interface Check<Ctx = unknown> {
  id: string;
  title: string;
  tags?: string[];
  run(ctx: Ctx): Promise<CheckResult>;
}

export interface CheckReport {
  id: string;
  title: string;
  tags?: string[];
  result: CheckResult;
  timestamp?: Date;
}

export interface ChainReport {
  name: string;
  total: number;
  passed: number;
  failed: number;
  warned: number;
  skipped: number;
  duration: number;
  checks: CheckReport[];
  summary: string;
}

export interface Config {
  envFile: string;
  secretsConfig: string;
  secretsEnv: string;
  vault: string;
  proxyEndpoint: string;
  tailscaleMagicIP: string;
  [key: string]: unknown;
}

export interface RunContext {
  config: Config;
  dryRun: boolean;
  verbose: boolean;
}
