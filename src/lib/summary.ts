/**
 * Summary report generation and formatting
 */

import chalk from "chalk";
import { CheckReport, ChainReport } from "./types";

/**
 * Format a single check report for display
 */
export function formatCheckReport(report: CheckReport): string {
  const statusEmoji = {
    pass: chalk.green("✓"),
    fail: chalk.red("✗"),
    warn: chalk.yellow("⚠"),
    skip: chalk.gray("⊘"),
  };

  const statusText = {
    pass: chalk.green("PASS"),
    fail: chalk.red("FAIL"),
    warn: chalk.yellow("WARN"),
    skip: chalk.gray("SKIP"),
  };

  const emoji = statusEmoji[report.result.status];
  const status = statusText[report.result.status];
  const duration = report.result.duration
    ? ` (${report.result.duration.toFixed(2)}s)`
    : "";
  const message = report.result.message ? ` - ${report.result.message}` : "";

  return `${emoji} ${status}${duration}: ${report.title}${message}`;
}

/**
 * Format a chain report as a summary table
 */
export function formatChainReport(report: ChainReport): string {
  const lines: string[] = [];

  lines.push("");
  lines.push(
    chalk.bold(`╔════════════════════════════════════════════════════╗`)
  );
  lines.push(
    chalk.bold(`║ ${report.name.padEnd(50)}║`)
  );
  lines.push(
    chalk.bold(`╚════════════════════════════════════════════════════╝`)
  );
  lines.push("");

  // Summary stats
  const totalStr = `${report.total} checks`;
  const passStr = chalk.green(`${report.passed} passed`);
  const failStr = chalk.red(`${report.failed} failed`);
  const warnStr = chalk.yellow(`${report.warned} warned`);
  const skipStr = chalk.gray(`${report.skipped} skipped`);

  lines.push(`  Total: ${totalStr}`);
  lines.push(`  Results: ${passStr} | ${failStr} | ${warnStr} | ${skipStr}`);
  lines.push(`  Duration: ${report.duration.toFixed(2)}s`);
  lines.push("");

  // Individual check results
  if (report.checks.length > 0) {
    lines.push(chalk.bold("  Checks:"));
    for (const check of report.checks) {
      const formatted = formatCheckReport(check);
      lines.push(`    ${formatted}`);

      if (
        check.result.details &&
        (check.result.status === "fail" || check.result.status === "warn")
      ) {
        const detailLines = check.result.details.split("\n");
        for (const detail of detailLines) {
          lines.push(chalk.gray(`      ${detail}`));
        }
      }
    }
  }

  lines.push("");

  if (report.failed > 0) {
    lines.push(
      chalk.red(`  ✗ Failed: ${report.summary}`)
    );
  } else if (report.warned > 0) {
    lines.push(
      chalk.yellow(`  ⚠ Warnings: ${report.summary}`)
    );
  } else {
    lines.push(chalk.green(`  ✓ All checks passed!`));
  }

  lines.push("");

  return lines.join("\n");
}

/**
 * Generate a chain report from check results
 */
export function createChainReport(
  name: string,
  checks: CheckReport[]
): ChainReport {
  const passed = checks.filter((c) => c.result.status === "pass").length;
  const failed = checks.filter((c) => c.result.status === "fail").length;
  const warned = checks.filter((c) => c.result.status === "warn").length;
  const skipped = checks.filter((c) => c.result.status === "skip").length;

  const duration = checks.reduce((sum, c) => sum + (c.result.duration || 0), 0);

  const summary =
    failed > 0
      ? `${failed} check(s) failed`
      : warned > 0
        ? `${warned} check(s) warned`
        : "all checks passed";

  return {
    name,
    total: checks.length,
    passed,
    failed,
    warned,
    skipped,
    duration,
    checks,
    summary,
  };
}

/**
 * Format multiple chain reports
 */
export function formatChainReports(reports: ChainReport[]): string {
  return reports.map((r) => formatChainReport(r)).join("\n");
}
