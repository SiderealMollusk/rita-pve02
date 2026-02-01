/**
 * Test: Every line in secrets.template has scripting support
 */
import { describe, it, expect } from "vitest";
import { parseSecretsTemplate } from "./secrets-template-parser";
import { getStrategy, secretNameToStrategy } from "./secret-name-mapping";
import { readFileSync } from "fs";
import { resolve } from "path";

describe("Secrets scripting support", () => {
  it("every line in secrets.template has a mapped strategy and script", () => {
    const templatePath = resolve(process.cwd(), "secrets.template");
    const lines = parseSecretsTemplate(templatePath);
    const missing: string[] = [];

    for (const line of lines) {
      const strategy = getStrategy(line.name);
      if (!strategy || !(line.name in secretNameToStrategy)) {
        missing.push(line.name);
      }
    }

    expect(missing).toEqual([]);
  });
});
