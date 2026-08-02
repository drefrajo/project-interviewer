import { createThread } from "@convex-dev/agent";
import { env, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireCreatorProfile } from "./lib/auth";
import {
  createCapabilityToken,
  hashCapability,
  openCapabilityToken,
  sealCapabilityToken,
} from "./lib/capability_crypto";
import { agentComponent } from "./lib/components";
import {
  assertLength,
  interviewDto,
  MAX_INSTRUCTIONS_LENGTH,
} from "./lib/domain";
import { clientLanguage } from "./schema";
import { internalRefs } from "./internal_refs";

const ownedInterview = async (
  ctx: QueryCtx | MutationCtx,
  interviewId: Id<"interviews">,
) => {
  const creator = await requireCreatorProfile(ctx);
  const interview = await ctx.db.get("interviews", interviewId);
  if (!interview || interview.creatorId !== creator._id) {
    throw new Error("Interview not found.");
  }
  return { creator, interview };
};

export const list = query({
  args: {},
  handler: async (ctx) => {
    const creator = await requireCreatorProfile(ctx);
    const interviews = await ctx.db
      .query("interviews")
      .withIndex("by_creatorId_and_updatedAt", (q) =>
        q.eq("creatorId", creator._id),
      )
      .order("desc")
      .take(100);
    return await Promise.all(
      interviews.map((interview) =>
        interviewDto(interview, (id) => ctx.storage.getUrl(id)),
      ),
    );
  },
});

export const get = query({
  args: { interviewId: v.id("interviews") },
  handler: async (ctx, args) => {
    const { interview } = await ownedInterview(ctx, args.interviewId);
    const linkToken = await openCapabilityToken(
      {
        ciphertext: interview.linkTokenCiphertext,
        iv: interview.linkTokenIv,
      },
      env.CAPABILITY_ENCRYPTION_SECRET,
      `interview-link:${interview.linkHash}`,
    );
    return {
      ...(await interviewDto(interview, (id) => ctx.storage.getUrl(id))),
      linkToken,
    };
  },
});

export const create = mutation({
  args: {
    projectName: v.string(),
    clientLanguage,
    instructions: v.string(),
  },
  handler: async (ctx, args) => {
    const creator = await requireCreatorProfile(ctx);
    const projectName = assertLength("Project name", args.projectName, 160);
    const instructions = assertLength(
      "Interview Instructions",
      args.instructions,
      MAX_INSTRUCTIONS_LENGTH,
    );
    const token = createCapabilityToken();
    const linkHash = await hashCapability(token);
    const sealedToken = await sealCapabilityToken(
      token,
      env.CAPABILITY_ENCRYPTION_SECRET,
      `interview-link:${linkHash}`,
    );
    const agentThreadId = await createThread(ctx, agentComponent, {
      userId: creator._id,
      title: projectName,
    });
    const now = Date.now();
    const interviewId = await ctx.db.insert("interviews", {
      creatorId: creator._id,
      agentThreadId,
      linkHash,
      linkTokenCiphertext: sealedToken.ciphertext,
      linkTokenIv: sealedToken.iv,
      linkVersion: 1,
      projectName,
      clientLanguage: args.clientLanguage,
      model: "gpt-5.6-terra",
      instructions,
      createdAt: now,
      updatedAt: now,
      step: "interview",
      clientMessageCount: 0,
      documentRevisionCount: 0,
      concepts: [],
      usage: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
    });
    return { interviewId, linkToken: token, linkVersion: 1 };
  },
});

export const updateBeforeStart = mutation({
  args: {
    interviewId: v.id("interviews"),
    projectName: v.string(),
    clientLanguage,
    instructions: v.string(),
  },
  handler: async (ctx, args) => {
    const { interview } = await ownedInterview(ctx, args.interviewId);
    if (interview.frozenAt || interview.clientMessageCount > 0) {
      throw new Error("Interview configuration is frozen.");
    }
    await ctx.db.patch("interviews", interview._id, {
      projectName: assertLength("Project name", args.projectName, 160),
      clientLanguage: args.clientLanguage,
      model: "gpt-5.6-terra",
      instructions: assertLength(
        "Interview Instructions",
        args.instructions,
        MAX_INSTRUCTIONS_LENGTH,
      ),
      updatedAt: Date.now(),
    });
    return interview._id;
  },
});

export const rotateLink = mutation({
  args: { interviewId: v.id("interviews") },
  handler: async (ctx, args) => {
    const { interview } = await ownedInterview(ctx, args.interviewId);
    const token = createCapabilityToken();
    const linkHash = await hashCapability(token);
    const sealedToken = await sealCapabilityToken(
      token,
      env.CAPABILITY_ENCRYPTION_SECRET,
      `interview-link:${linkHash}`,
    );
    const linkVersion = interview.linkVersion + 1;
    await ctx.db.patch("interviews", interview._id, {
      linkHash,
      linkTokenCiphertext: sealedToken.ciphertext,
      linkTokenIv: sealedToken.iv,
      linkVersion,
      updatedAt: Date.now(),
    });
    return { linkToken: token, linkVersion };
  },
});

export const remove = mutation({
  args: {
    interviewId: v.id("interviews"),
    confirmation: v.string(),
  },
  handler: async (ctx, args) => {
    const { interview } = await ownedInterview(ctx, args.interviewId);
    if (args.confirmation !== interview.projectName) {
      throw new Error("Deletion confirmation does not match the project name.");
    }
    for (const concept of interview.concepts) {
      if (concept.imageId) await ctx.storage.delete(concept.imageId);
    }
    await ctx.runMutation(agentComponent.threads.deleteAllForThreadIdAsync, {
      threadId: interview.agentThreadId,
    });
    await ctx.db.delete("interviews", interview._id);
    return null;
  },
});

export const retry = mutation({
  args: { interviewId: v.id("interviews") },
  handler: async (ctx, args) => {
    const { interview } = await ownedInterview(ctx, args.interviewId);
    if (!interview.operation || interview.operation.status !== "failed") {
      throw new Error("Interview has no failed operation to retry.");
    }
    const operation = {
      kind: interview.operation.kind,
      status: "pending" as const,
      attempt: 0,
      ...(interview.operation.input
        ? { input: interview.operation.input }
        : {}),
      ...(interview.operation.startedAt
        ? { startedAt: interview.operation.startedAt }
        : {}),
    };
    await ctx.db.patch("interviews", interview._id, {
      operation,
      updatedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internalRefs.jobs.runPending, {
      interviewId: interview._id,
    });
    return null;
  },
});
