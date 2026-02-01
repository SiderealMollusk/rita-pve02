/**
 * Secret management tests
 * Ensures every secret in secrets.template has:
 * - A rotation script
 * - Dry-run capabilities
 * - Can write initial values to 1Password
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { parseSecretsTemplate, SecretEntry } from "../lib/secret-rotation";
import { rotationStrategies } from "../lib/rotation-strategies";

const SECRETS_TEMPLATE_PATH = resolve(process.cwd(), "secrets.template");

describe("Secret Management", () => {
  it("should parse secrets.template", () => {
    expect(existsSync(SECRETS_TEMPLATE_PATH)).toBe(true);
    const entries = parseSecretsTemplate(SECRETS_TEMPLATE_PATH);
    expect(entries.length).toBeGreaterThan(0);
  });

  it("should have a rotation strategy for every secret", () => {
    const entries = parseSecretsTemplate(SECRETS_TEMPLATE_PATH);

    for (const entry of entries) {
      const strategy = rotationStrategies[entry.type];
      expect(
        strategy,
        `Missing rotation strategy for ${entry.envVar} (type: ${entry.type})`
      ).toBeDefined();
    }
  });

  it("should support dry-run for all rotation strategies", () => {
    for (const [type, strategy] of Object.entries(rotationStrategies)) {
      expect(strategy.rotate).toBeDefined();
      expect(strategy.rotate.length).toBeGreaterThanOrEqual(2); // (entry, options)
    }
  });

  it("should support initial value creation for all strategies", () => {
    for (const [type, strategy] of Object.entries(rotationStrategies)) {
      expect(strategy.initialize).toBeDefined();
      expect(
        strategy.initialize.length,
        `${type} initialize() should accept (entry, options)`
      ).toBeGreaterThanOrEqual(2);
    }
  });

  it("should validate all op:// references are well-formed", () => {
    const entries = parseSecretsTemplate(SECRETS_TEMPLATE_PATH);

    for (const entry of entries) {
      const parts = entry.opRef.replace("op://", "").split("/");
      expect(
        parts.length,
        `${entry.envVar}: op:// reference must have vault/item/field`
      ).toBeGreaterThanOrEqual(3);

      const [vault, item, field] = parts;
      expect(vault, `${entry.envVar}: vault is empty`).toBeTruthy();
      expect(item, `${entry.envVar}: item is empty`).toBeTruthy();
      expect(field, `${entry.envVar}: field is empty`).toBeTruthy();
    }
  });

  it("should map each secret to a type", () => {
    const entries = parseSecretsTemplate(SECRETS_TEMPLATE_PATH);

    const validTypes = [
      "proxmox-api-token",
      "ssh-public-key",
      "ssh-private-key",
      "tailscale-auth-key",
      "password",
    ];

    for (const entry of entries) {
      expect(
        validTypes,
        `${entry.envVar} has invalid type: ${entry.type}`
      ).toContain(entry.type);
    }
  });
});

describe("Secret Rotation (dry-run)", () => {
  it("should not modify 1Password when dry-run is true", async () => {
    const entries = parseSecretsTemplate(SECRETS_TEMPLATE_PATH);
    const testEntry = entries[0];

    if (!testEntry) {
      return; // Skip if no entries
    }

    const strategy = rotationStrategies[testEntry.type];
    const result = await strategy.rotate(testEntry, { dryRun: true });

    expect(result.dryRun).toBe(true);
    expect(result.newValue).toBeDefined(); // Should generate value
    expect(result.written).toBe(false); // Should NOT write
  });
});

describe("Secret Initialization", () => {
  it("should generate appropriate values for each type", async () => {
    const typeExamples: Record<string, string | null> = {
      "proxmox-api-token": null, // External - won't auto-generate
      "ssh-public-key": "-----BEGIN PUBLIC KEY-----",
      "ssh-private-key": "-----BEGIN PRIVATE KEY-----",
      "tailscale-auth-key": null, // External - won't auto-generate
      "password": "",
    };

    for (const [type, expectedPrefix] of Object.entries(typeExamples)) {
      const strategy = rotationStrategies[type];
      const mockEntry: SecretEntry = {
        envVar: `TEST_${type.toUpperCase().replace(/-/g, "_")}`,
        opRef: `op://test/test/${type}`,
        type,
      };

      const result = await strategy.initialize(mockEntry, { dryRun: true });

      if (expectedPrefix === null) {
        // External secrets should succeed in dry-run but won't generate real values
        expect(result.success).toBe(true);
        expect(result.dryRun).toBe(true);
      } else if (expectedPrefix) {
        expect(
          result.newValue,
          `${type} should start with "${expectedPrefix}"`
        ).toMatch(new RegExp(`^${expectedPrefix}`));
      } else {
        expect(result.newValue!.length).toBeGreaterThan(8);
      }
    }
  });
});
