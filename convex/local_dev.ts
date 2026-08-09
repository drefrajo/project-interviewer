import { createThread } from "@convex-dev/agent";
import { env, mutation } from "./_generated/server";
import { agentComponent } from "./lib/components";
import {
  createCapabilityToken,
  hashCapability,
  sealCapabilityToken,
} from "./lib/capability_crypto";
import { isLocalDevelopmentAuthBypassEnabled } from "./lib/environment";
import { requireCreatorProfile } from "./lib/auth";
import {
  initialActivityRetention,
  initialCompletedRetention,
} from "./lib/retention";

const sampleInterviews = [
  {
    key: "new",
    projectName: "Local sample - New draft",
    passState: "unreserved" as const,
    step: "interview" as const,
    clientMessageCount: 0,
    age: 5 * 60 * 1000,
    frozen: false,
    submitted: false,
    failed: false,
  },
  {
    key: "ready",
    projectName: "Local sample - Ready to share",
    passState: "reserved" as const,
    step: "interview" as const,
    clientMessageCount: 0,
    age: 4 * 60 * 1000,
    frozen: false,
    submitted: false,
    failed: false,
  },
  {
    key: "in-progress",
    projectName: "Local sample - In progress",
    passState: "consumed" as const,
    step: "review" as const,
    clientMessageCount: 4,
    age: 3 * 60 * 1000,
    frozen: true,
    submitted: false,
    failed: false,
  },
  {
    key: "submitted",
    projectName: "Local sample - Submitted",
    passState: "consumed" as const,
    step: "submitted" as const,
    clientMessageCount: 8,
    age: 2 * 60 * 1000,
    frozen: true,
    submitted: true,
    failed: false,
  },
  {
    key: "needs-attention",
    projectName: "Local sample - Needs attention",
    passState: "consumed" as const,
    step: "interview" as const,
    clientMessageCount: 2,
    age: 60 * 1000,
    frozen: true,
    submitted: false,
    failed: true,
  },
] as const;

export const seedSamples = mutation({
  args: {},
  handler: async (ctx) => {
    if (!isLocalDevelopmentAuthBypassEnabled()) {
      throw new Error("Local sample data is only available on local deployments.");
    }

    const creator = await requireCreatorProfile(ctx);
    const existing = await ctx.db
      .query("interviews")
      .withIndex("by_creatorId", (q) => q.eq("creatorId", creator._id))
      .take(100);
    const existingKeys = new Set(
      existing.flatMap((interview) =>
        interview.localDevSampleKey ? [interview.localDevSampleKey] : [],
      ),
    );
    let created = 0;

    for (const sample of sampleInterviews) {
      if (existingKeys.has(sample.key)) continue;

      const token = createCapabilityToken();
      const linkHash = await hashCapability(token);
      const sealedToken = await sealCapabilityToken(
        token,
        env.CAPABILITY_ENCRYPTION_SECRET,
        `interview-link:${linkHash}`,
      );
      const agentThreadId = await createThread(ctx, agentComponent, {
        userId: creator._id,
        title: sample.projectName,
      });
      const now = Date.now();
      const timestamp = now - sample.age;

      await ctx.db.insert("interviews", {
        creatorId: creator._id,
        agentThreadId,
        linkHash,
        linkTokenCiphertext: sealedToken.ciphertext,
        linkTokenIv: sealedToken.iv,
        linkVersion: 1,
        projectName: sample.projectName,
        localDevSampleKey: sample.key,
        clientLanguage: "en",
        model: "gpt-5.6-terra",
        instructions:
          "Local development sample data. This Interview is not a real client project.",
        passState: sample.passState,
        ...(sample.passState !== "unreserved"
          ? {
              passReservationKey: `local-sample-reservation:${sample.key}`,
              passReservationVersion: 1,
            }
          : {}),
        ...(sample.frozen
          ? { frozenAt: timestamp, startedAt: timestamp }
          : {}),
        ...(sample.passState === "consumed"
          ? { passConsumedAt: timestamp }
          : {}),
        createdAt: timestamp,
        updatedAt: timestamp,
        ...(sample.submitted
          ? initialCompletedRetention(timestamp)
          : initialActivityRetention(timestamp)),
        step: sample.step,
        clientMessageCount: sample.clientMessageCount,
        documentRevisionCount: sample.submitted ? 1 : 0,
        ...(sample.submitted
          ? {
              projectDocument:
                "# Local sample submission\n\nThis is placeholder project documentation for local UI development.",
              submission: {
                id: `local-sample-submission:${sample.key}`,
                submittedAt: timestamp,
                projectDocument:
                  "# Local sample submission\n\nThis is placeholder project documentation for local UI development.",
                visualDirection: {
                  kind: "inspiration_links" as const,
                  inspirationLinks: ["https://example.com/local-sample"],
                  note: "Local development sample.",
                },
                emailDelivery: "pending" as const,
                emailAttempts: 0,
              },
            }
          : {}),
        ...(sample.failed
          ? {
              operation: {
                kind: "interview_response" as const,
                status: "failed" as const,
                attempt: 1,
                errorCode: "LOCAL_SAMPLE_FAILURE",
              },
            }
          : {}),
        concepts: [],
        usage: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
      });
      created += 1;
    }

    return { created };
  },
});
