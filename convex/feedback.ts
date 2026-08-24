import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireCreatorProfile } from "./lib/auth";
import { assertLength } from "./lib/domain";

const feedbackTarget = v.union(
  v.literal("project_document"),
  v.literal("project_submission"),
);
const feedbackRating = v.union(v.literal("up"), v.literal("down"));

const MAX_FEEDBACK_COMMENT_LENGTH = 2000;

export const getForInterview = query({
  args: { interviewId: v.id("interviews") },
  returns: v.array(
    v.object({
      target: feedbackTarget,
      rating: feedbackRating,
      comment: v.optional(v.string()),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const creator = await requireCreatorProfile(ctx);
    const interview = await ctx.db.get("interviews", args.interviewId);
    if (!interview || interview.creatorId !== creator._id) return [];
    const rows = await ctx.db
      .query("interviewFeedback")
      .withIndex("by_interviewId_and_target", (q) =>
        q.eq("interviewId", args.interviewId),
      )
      .take(4);
    return rows.map((row) => ({
      target: row.target,
      rating: row.rating,
      ...(row.comment === undefined ? {} : { comment: row.comment }),
      createdAt: row.createdAt,
    }));
  },
});

export const record = mutation({
  args: {
    interviewId: v.id("interviews"),
    target: feedbackTarget,
    rating: feedbackRating,
    comment: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const creator = await requireCreatorProfile(ctx);
    const interview = await ctx.db.get("interviews", args.interviewId);
    if (!interview || interview.creatorId !== creator._id) {
      throw new Error("Interview not found.");
    }
    if (
      (args.target === "project_document" && !interview.projectDocument) ||
      (args.target === "project_submission" && !interview.submission)
    ) {
      throw new Error("Feedback target is not available yet.");
    }
    const comment = args.comment?.trim()
      ? assertLength(
          "Feedback comment",
          args.comment.trim(),
          MAX_FEEDBACK_COMMENT_LENGTH,
        )
      : undefined;
    const base = {
      rating: args.rating,
      createdAt: Date.now(),
      ...(interview.promptVersion === undefined
        ? {}
        : { promptVersion: interview.promptVersion }),
    };
    const existing = await ctx.db
      .query("interviewFeedback")
      .withIndex("by_interviewId_and_target", (q) =>
        q.eq("interviewId", args.interviewId).eq("target", args.target),
      )
      .unique();
    if (existing) {
      // Patching an explicit undefined clears a previously saved note.
      await ctx.db.patch("interviewFeedback", existing._id, {
        ...base,
        ...(comment !== undefined ? { comment } : { comment: undefined }),
      });
    } else {
      await ctx.db.insert("interviewFeedback", {
        interviewId: args.interviewId,
        creatorId: creator._id,
        target: args.target,
        ...base,
        ...(comment !== undefined ? { comment } : {}),
      });
    }
    return null;
  },
});
