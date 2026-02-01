/**
 * Chain composition and filtering
 */

import { Listr, ListrTask } from "listr2";
import chalk from "chalk";
import { Check, CheckReport, CheckResult, RunContext } from "./types";
import { createChainReport } from "./summary";

export interface ChainOptions {
  name: string;
  checks: Check[];
  onlyTags?: string[];
  from?: string;
  to?: string;
  dryRun?: boolean;
  verbose?: boolean;
  json?: boolean;
}

/**
 * Filter checks by tags and id range
 */
export function filterChecks(
  checks: Check[],
  options: {
    onlyTags?: string[];
    from?: string;
    to?: string;
  }
): Check[] {
  let filtered = checks;

  // Filter by tags
  if (options.onlyTags && options.onlyTags.length > 0) {
    filtered = filtered.filter((c) =>
      c.tags?.some((tag) => options.onlyTags!.includes(tag))
    );
  }

  // Filter by id range (from/to)
  const fromIdx = options.from
    ? filtered.findIndex((c) => c.id === options.from)
    : 0;
  const toIdx = options.to
    ? filtered.findIndex((c) => c.id === options.to)
    : filtered.length - 1;

  if (fromIdx >= 0 && toIdx >= 0 && fromIdx <= toIdx) {
    filtered = filtered.slice(fromIdx, toIdx + 1);
  }

  return filtered;
}

/**
 * Run a chain of checks with Listr2 UI
 */
export async function runChain(
  options: ChainOptions,
  ctx: RunContext
): Promise<CheckReport[]> {
  const checks = filterChecks(options.checks, {
    onlyTags: options.onlyTags,
    from: options.from,
    to: options.to,
  });

  const reports: CheckReport[] = [];

  if (checks.length === 0) {
    return reports;
  }

  // Create Listr2 tasks
  const tasks: ListrTask[] = checks.map((check) => ({
    title: check.title,
    task: async () => {
      const start = Date.now();
      try {
        const result = await check.run(ctx);
        const duration = (Date.now() - start) / 1000;

        reports.push({
          id: check.id,
          title: check.title,
          tags: check.tags,
          result: { ...result, duration },
          timestamp: new Date(),
        });

        // Update Listr2 title to show result
        const statusEmoji = {
          pass: "✓",
          fail: "✗",
          warn: "⚠",
          skip: "⊘",
        };

        const msg = result.message ? ` - ${result.message}` : "";
        const durationStr = ` (${duration.toFixed(2)}s)`;

        return `${statusEmoji[result.status]}${durationStr}${msg}`;
      } catch (error) {
        const duration = (Date.now() - start) / 1000;
        const message = error instanceof Error ? error.message : String(error);

        reports.push({
          id: check.id,
          title: check.title,
          tags: check.tags,
          result: {
            status: "fail",
            message: "Exception",
            details: message,
            duration,
          },
          timestamp: new Date(),
        });

        throw error;
      }
    },
    skip: () => {
      // Skip checks can be determined in a pre-flight phase
      return false;
    },
  }));

  // Run with Listr2
  const listr = new Listr(tasks, {
    concurrent: false,
    exitOnError: false,
    collectErrors: "full",
  });

  try {
    await listr.run();
  } catch {
    // Catch all errors to allow full report generation
  }

  return reports;
}

/**
 * Run multiple chains in sequence
 */
export async function runChains(
  chains: ChainOptions[],
  ctx: RunContext
): Promise<CheckReport[][]> {
  const allReports: CheckReport[][] = [];

  for (const chain of chains) {
    const reports = await runChain(chain, ctx);
    allReports.push(reports);

    // Check for failures and stop if needed
    const hasFailed = reports.some((r) => r.result.status === "fail");
    if (hasFailed && !ctx.dryRun) {
      console.error(chalk.red(`\n✗ Chain "${chain.name}" failed. Stopping.`));
      break;
    }
  }

  return allReports;
}
