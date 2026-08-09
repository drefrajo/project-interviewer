/// <reference types="vite/client" />

import { createThread } from "@convex-dev/agent";
import { register as registerAgent } from "@convex-dev/agent/test";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { agentComponent } from "./lib/components";
import {
  addUtcCalendarMonths,
  retentionExpiresAt,
  retentionWarningAt,
  RETENTION_POLICY_VERSION,
} from "./lib/retention";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const seedCreator = async (t: ReturnType<typeof convexTest>) =>
  await t.run(async (ctx) =>
    await ctx.db.insert("creatorProfiles", {
      authUserId: "retention-auth",
      tokenIdentifier: "test|retention",
      email: "private@example.test",
      displayName: "Retention Studio",
      contactEmail: "public@example.test",
      privacyPolicyUrl: "https://example.test/privacy",
      createdAt: 1,
      updatedAt: 1,
    }),
  );

const insertInterview = async (
  t: ReturnType<typeof convexTest>,
  creatorId: Id<"creatorProfiles">,
  suffix: string,
  values: {
    updatedAt: number;
    submission?: {
      id: string;
      submittedAt: number;
      projectDocument: string;
      visualDirection: {
        kind: "inspiration_links";
        inspirationLinks: string[];
        note: string;
      };
      emailDelivery: "sent";
      emailAttempts: number;
    };
  },
) =>
  await t.run(async (ctx) =>
    await ctx.db.insert("interviews", {
      creatorId,
      agentThreadId: `thread-${suffix}`,
      linkHash: `hash-${suffix}`,
      linkTokenCiphertext: "ciphertext",
      linkTokenIv: "iv",
      linkVersion: 1,
      projectName: `Project ${suffix}`,
      clientLanguage: "en",
      model: "gpt-5.6-terra",
      instructions: "Interview the Client.",
      passState: "consumed",
      createdAt: 1,
      updatedAt: values.updatedAt,
      step: values.submission ? "submitted" : "interview",
      clientMessageCount: 1,
      documentRevisionCount: 0,
      ...(values.submission ? { submission: values.submission } : {}),
      concepts: [],
      usage: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
    }),
  );

describe("automatic Interview retention", () => {
  it("backfills completed from submission and incomplete from last activity", async () => {
    const t = convexTest(schema, modules);
    const creatorId = await seedCreator(t);
    const submittedAt = Date.UTC(2025, 0, 15);
    const completedId = await insertInterview(t, creatorId, "completed", {
      updatedAt: submittedAt + 60_000,
      submission: {
        id: "submission-completed",
        submittedAt,
        projectDocument: "# Project",
        visualDirection: {
          kind: "inspiration_links",
          inspirationLinks: ["https://example.test"],
          note: "Reference",
        },
        emailDelivery: "sent",
        emailAttempts: 1,
      },
    });
    const legacyCompletedExpiresAt = addUtcCalendarMonths(submittedAt, 12);
    await t.run(async (ctx) => {
      await ctx.db.patch("interviews", completedId, {
        retentionExpiresAt: legacyCompletedExpiresAt,
        retentionWarningAt: retentionWarningAt(legacyCompletedExpiresAt),
        retentionWarningAttemptedAt: legacyCompletedExpiresAt - 31_000,
        retentionWarningSentAt: legacyCompletedExpiresAt - 31_000,
      });
    });
    const lastActivityAt = Date.UTC(2025, 2, 20);
    const incompleteId = await insertInterview(t, creatorId, "incomplete", {
      updatedAt: lastActivityAt,
    });

    expect(
      await t.query(internal.retention.getExpired, {
        now: legacyCompletedExpiresAt,
        limit: 50,
      }),
    ).toEqual([]);
    expect(
      await t.mutation(internal.retention.deleteExpired, {
        interviewId: completedId,
        now: legacyCompletedExpiresAt,
      }),
    ).toBe(false);

    expect(
      await t.mutation(internal.retention.backfillDeadlines, { limit: 50 }),
    ).toBe(2);
    const [completed, incomplete] = await t.run(async (ctx) =>
      await Promise.all([
        ctx.db.get("interviews", completedId),
        ctx.db.get("interviews", incompleteId),
      ]),
    );
    expect(completed).toMatchObject({
      lastActivityAt: submittedAt,
      retentionPolicyVersion: RETENTION_POLICY_VERSION,
      retentionExpiresAt: retentionExpiresAt({
        lastActivityAt: submittedAt,
        submittedAt,
      }),
    });
    expect(incomplete).toMatchObject({
      lastActivityAt,
      retentionPolicyVersion: RETENTION_POLICY_VERSION,
      retentionExpiresAt: retentionExpiresAt({ lastActivityAt }),
    });
    expect(completed?.retentionExpiresAt).not.toBe(legacyCompletedExpiresAt);
    expect(completed?.retentionWarningAttemptedAt).toBeUndefined();
    expect(completed?.retentionWarningSentAt).toBeUndefined();

    const completedExpiresAt = retentionExpiresAt({
      lastActivityAt: submittedAt,
      submittedAt,
    });
    expect(
      await t.query(internal.retention.getWarnings, {
        now: completedExpiresAt - 30 * 24 * 60 * 60 * 1000,
        limit: 50,
      }),
    ).toEqual([
      expect.objectContaining({ interviewId: completedId }),
    ]);
    await t.mutation(internal.retention.recordWarningAttempt, {
      interviewId: completedId,
      retentionExpiresAt: completedExpiresAt,
      attemptedAt: completedExpiresAt - 30 * 24 * 60 * 60 * 1000,
      delivered: true,
    });
    expect(
      await t.query(internal.retention.getWarnings, {
        now: completedExpiresAt - 29 * 24 * 60 * 60 * 1000,
        limit: 50,
      }),
    ).toEqual([]);
  });

  it("deletes at the deadline and revokes images and temporary exports", async () => {
    const t = convexTest(schema, modules);
    registerAgent(t);
    const creatorId = await seedCreator(t);
    const threadId = await t.run(async (ctx) =>
      await createThread(ctx, agentComponent, {
        userId: creatorId,
        title: "Expired Interview",
      }),
    );
    const { interviewId, conceptImageId, exportStorageId, archiveId } =
      await t.run(async (ctx) => {
        const conceptImageId = await ctx.storage.store(
          new Blob(["concept"], { type: "image/png" }),
        );
        const exportStorageId = await ctx.storage.store(
          new Blob(["export"], { type: "application/zip" }),
        );
        const interviewId = await ctx.db.insert("interviews", {
          creatorId,
          agentThreadId: threadId,
          linkHash: "expired-hash",
          linkTokenCiphertext: "ciphertext",
          linkTokenIv: "iv",
          linkVersion: 1,
          projectName: "Expired",
          clientLanguage: "en",
          model: "gpt-5.6-terra",
          instructions: "Interview the Client.",
          passState: "consumed",
          createdAt: 1,
          updatedAt: 1,
          lastActivityAt: 1,
          retentionPolicyVersion: RETENTION_POLICY_VERSION,
          retentionExpiresAt: 100,
          step: "interview",
          clientMessageCount: 1,
          documentRevisionCount: 0,
          concepts: [
            {
              id: "concept_1",
              name: "Concept",
              rationale: "Rationale",
              prompt: "Prompt",
              imageId: conceptImageId,
              status: "ready",
            },
          ],
          usage: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
        });
        const archiveId = await ctx.db.insert("exportArchives", {
          interviewId,
          creatorId,
          storageId: exportStorageId,
          createdAt: 1,
          expiresAt: 1_000,
        });
        return { interviewId, conceptImageId, exportStorageId, archiveId };
      });

    expect(
      await t.mutation(internal.retention.deleteExpired, {
        interviewId,
        now: 99,
      }),
    ).toBe(false);
    expect(
      await t.mutation(internal.retention.deleteExpired, {
        interviewId,
        now: 100,
      }),
    ).toBe(true);

    await t.run(async (ctx) => {
      expect(await ctx.db.get("interviews", interviewId)).toBeNull();
      expect(await ctx.db.get("exportArchives", archiveId)).toBeNull();
      expect(await ctx.storage.get(conceptImageId)).toBeNull();
      expect(await ctx.storage.get(exportStorageId)).toBeNull();
    });
  });
});
