/**
 * Test: Every line in secrets.template has scripting support
 */
import { describe, it, expect } from "vitest";
import { getStrategy, loadSecretsConfig } from "./secrets-config.js";

describe("Secrets scripting support", () => {
  it("every secret in config has a mapped strategy", () => {
    const config = loadSecretsConfig();
    const missing: string[] = [];

    for (const secret of config.secrets) {
      const strategy = getStrategy(secret.name);
      if (!strategy) {
        missing.push(secret.name);
      }
    }

    expect(missing).toEqual([]);
  });
});
