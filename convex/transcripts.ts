import { listMessages } from "@convex-dev/agent";
import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireCreatorProfile } from "./lib/auth";
import { agentComponent } from "./lib/components";
import { hashCapability } from "./lib/capability_crypto";
import { agentMessageContentText } from "./lib/agent_message";
import {
  clientFacingInterviewContent,
  isMalformedStructuredInterviewOutput,
} from "./lib/interview_output";

const transcript = async (
  ctx: Parameters<typeof listMessages>[0],
  threadId: string,
  clientLanguage: "en" | "de",
  suggestedReplies: string[] = [],
) => {
  const page = await listMessages(ctx, agentComponent, {
    threadId,
    paginationOpts: { numItems: 200, cursor: null },
    excludeToolMessages: true,
    statuses: ["success"],
  });
  const conversationalMessages = [...page.page].reverse().flatMap((item) => {
    const { message } = item;
    return message &&
      (message.role === "user" || message.role === "assistant")
      ? [{ item, message }]
      : [];
  });
  const messages = conversationalMessages.flatMap(
    ({ item, message }, index) => {
      const content = agentMessageContentText(message.content);
      const malformed =
        message.role === "assistant" &&
        isMalformedStructuredInterviewOutput(content);
      if (malformed && index < conversationalMessages.length - 1) return [];
      return [
        {
          id: item._id,
          role:
            message.role === "user"
              ? ("client" as const)
              : ("assistant" as const),
          content:
            message.role === "assistant"
              ? clientFacingInterviewContent(content, clientLanguage)
              : content,
          createdAt: item._creationTime,
          ...(malformed ? { retryable: true as const } : {}),
        },
      ];
    },
  );
  const latest = messages.at(-1);
  if (latest?.role !== "assistant" || suggestedReplies.length === 0) {
    return messages;
  }
  return [
    ...messages.slice(0, -1),
    { ...latest, suggestedReplies },
  ];
};

export const listForCreator = query({
  args: { interviewId: v.id("interviews") },
  handler: async (ctx, args) => {
    const creator = await requireCreatorProfile(ctx);
    const interview = await ctx.db.get("interviews", args.interviewId);
    if (!interview || interview.creatorId !== creator._id) {
      throw new Error("Interview not found.");
    }
    return await transcript(
      ctx,
      interview.agentThreadId,
      interview.clientLanguage,
    );
  },
});

export const listForClient = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const linkHash = await hashCapability(args.token);
    const interview = await ctx.db
      .query("interviews")
      .withIndex("by_linkHash", (q) => q.eq("linkHash", linkHash))
      .unique();
    if (!interview) throw new Error("Interview Link is invalid.");
    return await transcript(
      ctx,
      interview.agentThreadId,
      interview.clientLanguage,
      interview.step === "interview" ? interview.suggestedReplies ?? [] : [],
    );
  },
});
