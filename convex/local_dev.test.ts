/// <reference types="vite/client" />

import { register as registerAgent } from "@convex-dev/agent/test";
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const originalEnvironment = process.env;

afterEach(() => {
  process.env = originalEnvironment;
});

describe("local development sample data", () => {
  it("seeds each dashboard state once on a local deployment", async () => {
    process.env = {
      ...originalEnvironment,
      CAPABILITY_ENCRYPTION_SECRET: "test-only-capability-secret",
      CONVEX_SITE_URL: "http://127.0.0.1:3211",
      LOCAL_DEV_AUTH_BYPASS: "true",
    };
    const t = convexTest(schema, modules);
    registerAgent(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("creatorProfiles", {
        authUserId: "local-development-creator",
        tokenIdentifier: "local-development:creator",
        email: "local@example.com",
        displayName: "Local Creator",
        createdAt: 1,
        updatedAt: 1,
      });
    });

    await expect(t.mutation(api.local_dev.seedSamples, {})).resolves.toEqual({
      created: 5,
    });
    await expect(t.mutation(api.local_dev.seedSamples, {})).resolves.toEqual({
      created: 0,
    });

    const interviews = await t.query(api.interviews.list, {});
    expect(interviews.map((interview) => interview.status).sort()).toEqual([
      "in_progress",
      "needs_attention",
      "not_started",
      "not_started",
      "submitted",
    ]);
  });

  it("rejects sample seeding outside a local deployment", async () => {
    process.env = {
      ...originalEnvironment,
      CONVEX_SITE_URL: "https://example.convex.site",
      LOCAL_DEV_AUTH_BYPASS: "true",
    };
    const t = convexTest(schema, modules);

    await expect(t.mutation(api.local_dev.seedSamples, {})).rejects.toThrow(
      "Local sample data is only available on local deployments.",
    );
  });
});
