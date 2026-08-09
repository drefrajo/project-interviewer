/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const responseFor = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

const seedCreator = async (t: ReturnType<typeof convexTest>, tokenIdentifier: string) =>
  await t.run(async (ctx) =>
    await ctx.db.insert("creatorProfiles", {
      authUserId: `${tokenIdentifier}-auth`,
      tokenIdentifier,
      email: "creator@example.com",
      displayName: "Creator",
      createdAt: 1,
      updatedAt: 1,
    }),
  );

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Creator legal acceptance tracking", () => {
  it("ignores future versions entries and appends only when the current documents change", async () => {
    const t = convexTest(schema, modules);
    const tokenIdentifier = "test|legal-creator";
    const creatorId = await seedCreator(t, tokenIdentifier);
    const firstVersions = {
      terms: { version: 1, sha256: "A".repeat(64), extra: "ignored" },
      dpa: { version: 1, sha256: "b".repeat(64) },
      privacy: { version: 99, sha256: "c".repeat(64) },
    };
    const fetchMock = vi.fn(async () => responseFor(firstVersions));
    vi.stubGlobal("fetch", fetchMock);

    const identity = { tokenIdentifier };
    await expect(
      t.withIdentity(identity).action(api.legal.getStatus, {}),
    ).resolves.toMatchObject({
      accepted: false,
      terms: { version: 1, sha256: "a".repeat(64) },
      dpa: { version: 1, sha256: "b".repeat(64) },
    });

    await t.withIdentity(identity).action(api.legal.acceptCurrent, {});
    const firstRecord = await t.run(async (ctx) =>
      await ctx.db
        .query("legalAcceptances")
        .withIndex("by_account_id", (q) => q.eq("account_id", creatorId))
        .unique(),
    );
    expect(firstRecord).toMatchObject({
      account_id: creatorId,
      terms_version: 1,
      dpa_version: 1,
      terms_hash: "a".repeat(64),
      dpa_hash: "b".repeat(64),
    });
    expect(firstRecord?.accepted_at).toEqual(expect.any(Number));

    await t.withIdentity(identity).action(api.legal.acceptCurrent, {});
    const unchangedRecords = await t.run(async (ctx) =>
      await ctx.db
        .query("legalAcceptances")
        .withIndex("by_account_id", (q) => q.eq("account_id", creatorId))
        .take(10),
    );
    expect(unchangedRecords).toHaveLength(1);

    const secondVersions = {
      ...firstVersions,
      terms: { version: 2, sha256: "d".repeat(64) },
    };
    fetchMock.mockImplementation(async () => responseFor(secondVersions));
    await expect(
      t.withIdentity(identity).action(api.legal.getStatus, {}),
    ).resolves.toMatchObject({
      accepted: false,
      terms: { version: 2, sha256: "d".repeat(64) },
      dpa: { version: 1, sha256: "b".repeat(64) },
    });
    await t.withIdentity(identity).action(api.legal.acceptCurrent, {});

    const records = await t.run(async (ctx) =>
      await ctx.db
        .query("legalAcceptances")
        .withIndex("by_account_id", (q) => q.eq("account_id", creatorId))
        .order("asc")
        .take(10),
    );
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      terms_version: 1,
      terms_hash: "a".repeat(64),
    });
    expect(records[1]).toMatchObject({
      terms_version: 2,
      terms_hash: "d".repeat(64),
    });
  });

  it("requires authentication", async () => {
    const t = convexTest(schema, modules);
    await expect(t.action(api.legal.getStatus, {})).rejects.toThrow(
      "Not authenticated.",
    );
  });
});
