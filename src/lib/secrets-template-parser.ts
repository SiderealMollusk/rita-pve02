/**
 * Simple parser for secrets.template
 * Loops over each line and extracts secret definitions
 */

import { readFileSync } from "fs";
import { resolve } from "path";

export interface SecretLine {
  lineNumber: number;
  name: string;
  opPath: string;
}

/**
 * Parse secrets.template line by line
 */
export function parseSecretsTemplate(filePath?: string): SecretLine[] {
  const path = filePath || resolve(process.cwd(), "secrets.template");
  const content = readFileSync(path, "utf-8");
  const lines = content.split("\n");
  const secrets: SecretLine[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    // Skip comments and empty lines
    if (line.trim().startsWith("#") || !line.trim()) {
      continue;
    }

    // Extract: NAME="op://vault/item/field"
    const match = line.match(/^([A-Z][A-Z0-9_]*)="(op:\/\/[^"]+)"$/);
    if (match) {
      const [, name, opPath] = match;
      secrets.push({
        lineNumber,
        name,
        opPath,
      });
    }
  }

  return secrets;
}
