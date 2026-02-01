#!/usr/bin/env node

/**
 * CLI entry point
 */

import { execute } from "@oclif/core";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

execute({
  dir: resolve(__dirname, ".."),
}).catch((error: Error) => {
  console.error(error);
  process.exit(1);
});
