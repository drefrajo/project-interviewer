import { readFileSync, readdirSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const convexDirectory = resolve(process.cwd(), "convex");
const entryPointExtensions = new Set([
  ".js",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".jsx",
]);
const validModulePathComponent = /^[A-Za-z0-9_.]+$/;

const collectConvexEntryPoints = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "_generated"
        ? []
        : collectConvexEntryPoints(absolutePath);
    }
    if (
      !entry.isFile() ||
      !entryPointExtensions.has(extname(entry.name).toLowerCase()) ||
      entry.name === "schema.ts" ||
      entry.name === "schema.js" ||
      (entry.name.match(/\./g) ?? []).length > 1 ||
      entry.name.startsWith(".") ||
      entry.name.startsWith("#") ||
      entry.name.includes(" ")
    ) {
      return [];
    }
    return [relative(convexDirectory, absolutePath)];
  });

describe("Convex module paths", () => {
  it("uses only path components accepted by Convex deployments", () => {
    const invalidPaths = collectConvexEntryPoints(convexDirectory).filter(
      (modulePath) =>
        modulePath
          .split(/[\\/]/)
          .some((component) => !validModulePathComponent.test(component)),
    );

    expect(invalidPaths).toEqual([]);
  });

  it("keeps Invite Link encryption in Node behind rollout-safe action paths", () => {
    const actionSource = readFileSync(
      join(convexDirectory, "invite_actions.ts"),
      "utf8",
    );
    const databaseSource = readFileSync(
      join(convexDirectory, "invites.ts"),
      "utf8",
    );

    expect(actionSource.trimStart()).toMatch(/^"use node";/);
    expect(actionSource).toContain("sealCapabilityToken");
    expect(databaseSource).not.toContain("sealCapabilityToken");
    expect(databaseSource).toContain(
      '"invite_actions:createCapability"',
    );
    expect(databaseSource).toContain(
      '"invite_actions:getCapability"',
    );
    expect(databaseSource).toContain("context.runAction");
  });
});
