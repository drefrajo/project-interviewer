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
import {
  ensureIntroductoryPass,
  interviewPassState,
  releaseInterviewReservation,
  reservationKeyFor,
  reserveInterviewPass,
} from "./lib/pass_accounting";
import { clientLanguage, interviewKind } from "./schema";
import { resolveInterviewConfiguration } from "./lib/interview_kind";
import { PROMPT_VERSION } from "./lib/interview_prompts";
import { internalRefs } from "./internal_refs";
import { requirePublicCreatorIdentity } from "./lib/creator_identity";
import { deleteInterviewData } from "./lib/delete_interview";
import {
  activityRetentionPatch,
  initialActivityRetention,
} from "./lib/retention";

const activityUpdatePatch = () => {
  const now = Date.now();
  return { updatedAt: now, ...activityRetentionPatch(now) };
};

const findOwnedInterview = async (
  ctx: QueryCtx | MutationCtx,
  interviewId: Id<"interviews">,
) => {
  const creator = await requireCreatorProfile(ctx);
  const interview = await ctx.db.get("interviews", interviewId);
  return interview && interview.creatorId === creator._id
    ? { creator, interview }
    : null;
};

const ownedInterview = async (
  ctx: QueryCtx | MutationCtx,
  interviewId: Id<"interviews">,
) => {
  const result = await findOwnedInterview(ctx, interviewId);
  if (!result) {
    throw new Error("Interview not found.");
  }
  return result;
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
    const access = await findOwnedInterview(ctx, args.interviewId);
    if (!access) return null;
    const { interview } = access;
    const linkToken =
      interviewPassState(interview) === "unreserved"
        ? undefined
        : await openCapabilityToken(
            {
              ciphertext: interview.linkTokenCiphertext,
              iv: interview.linkTokenIv,
            },
            env.CAPABILITY_ENCRYPTION_SECRET,
            `interview-link:${interview.linkHash}`,
          );
    return {
      ...(await interviewDto(interview, (id) => ctx.storage.getUrl(id))),
      ...(linkToken ? { linkToken } : {}),
    };
  },
});

export const create = mutation({
  args: {
    projectName: v.string(),
    clientLanguage,
    instructions: v.string(),
    interviewKind: v.optional(interviewKind),
    includesVisualConcepts: v.optional(v.boolean()),
    builtInTemplateKey: v.optional(v.string()),
  },
  returns: v.object({
    interviewId: v.id("interviews"),
    linkVersion: v.number(),
  }),
  handler: async (ctx, args) => {
    const creator = await requireCreatorProfile(ctx);
    requirePublicCreatorIdentity(creator);
    await ensureIntroductoryPass(ctx, creator._id);
    const projectName = assertLength("Project name", args.projectName, 160);
    const instructions = assertLength(
      "Interview Instructions",
      args.instructions,
      MAX_INSTRUCTIONS_LENGTH,
    );
    const configuration = resolveInterviewConfiguration(args);
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
      ...configuration,
      model: "gpt-6.1-sol",
      instructions,
      ...(args.builtInTemplateKey?.trim()
        ? {
            builtInTemplateKey: assertLength(
              "Built-in template key",
              args.builtInTemplateKey.trim(),
              40,
            ),
          }
        : {}),
      promptVersion: PROMPT_VERSION,
      passState: "unreserved",
      createdAt: now,
      updatedAt: now,
      ...initialActivityRetention(now),
      step: "interview",
      clientMessageCount: 0,
      documentRevisionCount: 0,
      concepts: [],
      usage: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
    });
    return { interviewId, linkVersion: 1 };
  },
});

export const reserveLink = mutation({
  args: { interviewId: v.id("interviews") },
  handler: async (ctx, args) => {
    const { creator, interview } = await ownedInterview(ctx, args.interviewId);
    requirePublicCreatorIdentity(creator);
    const state = interviewPassState(interview);
    const reservationKey = `reservation:${interview._id}:${
      (interview.passReservationVersion ?? 0) + 1
    }`;
    await (state === "unreserved"
      ? reserveInterviewPass(ctx, {
          creatorId: creator._id,
          interviewId: interview._id,
          reservationKey,
        })
      : Promise.resolve(null));
    if (state === "unreserved") {
      await ctx.db.patch("interviews", interview._id, {
        passState: "reserved",
        passReservationKey: reservationKey,
        passReservationVersion: (interview.passReservationVersion ?? 0) + 1,
        ...activityUpdatePatch(),
      });
    }
    const linkToken = await openCapabilityToken(
      {
        ciphertext: interview.linkTokenCiphertext,
        iv: interview.linkTokenIv,
      },
      env.CAPABILITY_ENCRYPTION_SECRET,
      `interview-link:${interview.linkHash}`,
    );
    return {
      linkToken,
      linkVersion: interview.linkVersion,
      reserved: state === "unreserved",
      alreadyReserved: state !== "unreserved",
    };
  },
});

export const deactivate = mutation({
  args: { interviewId: v.id("interviews") },
  handler: async (ctx, args) => {
    const { creator, interview } = await ownedInterview(ctx, args.interviewId);
    if (interviewPassState(interview) !== "reserved") {
      return { released: false };
    }
    await releaseInterviewReservation(ctx, {
      creatorId: creator._id,
      interviewId: interview._id,
      reservationKey: reservationKeyFor(interview),
    });
    await ctx.db.patch("interviews", interview._id, {
      passState: "unreserved",
      ...activityUpdatePatch(),
    });
    return { released: true };
  },
});

export const updateBeforeStart = mutation({
  args: {
    interviewId: v.id("interviews"),
    projectName: v.string(),
    clientLanguage,
    instructions: v.string(),
    interviewKind: v.optional(interviewKind),
    includesVisualConcepts: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { interview } = await ownedInterview(ctx, args.interviewId);
    if (interview.frozenAt || interview.clientMessageCount > 0) {
      throw new Error("Interview configuration is frozen.");
    }
    const existingConfiguration = resolveInterviewConfiguration(interview);
    const configuration = resolveInterviewConfiguration({
      interviewKind: args.interviewKind ?? existingConfiguration.interviewKind,
      includesVisualConcepts:
        args.includesVisualConcepts ??
        (args.interviewKind !== undefined
          ? undefined
          : existingConfiguration.includesVisualConcepts),
    });
    await ctx.db.patch("interviews", interview._id, {
      projectName: assertLength("Project name", args.projectName, 160),
      clientLanguage: args.clientLanguage,
      ...configuration,
      model: "gpt-6.1-sol",
      instructions: assertLength(
        "Interview Instructions",
        args.instructions,
        MAX_INSTRUCTIONS_LENGTH,
      ),
      ...activityUpdatePatch(),
    });
    return interview._id;
  },
});

export const rotateLink = mutation({
  args: { interviewId: v.id("interviews") },
  handler: async (ctx, args) => {
    const { creator, interview } = await ownedInterview(ctx, args.interviewId);
    requirePublicCreatorIdentity(creator);
    if (interviewPassState(interview) === "unreserved") {
      throw new Error("Reserve a pass before rotating or sharing the link.");
    }
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
      ...activityUpdatePatch(),
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
    await deleteInterviewData(ctx, interview);
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
      ...activityUpdatePatch(),
    });
    await ctx.scheduler.runAfter(0, internalRefs.jobs.runPending, {
      interviewId: interview._id,
    });
    return null;
  },
});
