import { listMessages } from "@convex-dev/agent";
import { internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { agentComponent } from "./lib/components";

const messageText = (message: {
  message?: { role: string; content: unknown } | undefined;
}) => {
  const content = message.message?.content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .flatMap((part) =>
      typeof part === "object" &&
      part !== null &&
      "type" in part &&
      part.type === "text" &&
      "text" in part &&
      typeof part.text === "string"
        ? [part.text]
        : [],
    )
    .join("\n");
};

export const get = internalQuery({
  args: {
    interviewId: v.id("interviews"),
    tokenIdentifier: v.string(),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("creatorProfiles")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", args.tokenIdentifier),
      )
      .unique();
    const interview = await ctx.db.get("interviews", args.interviewId);
    if (
      !profile ||
      !interview ||
      interview.creatorId !== profile._id ||
      !interview.submission
    ) {
      return null;
    }
    const transcriptPage = await listMessages(ctx, agentComponent, {
      threadId: interview.agentThreadId,
      paginationOpts: { numItems: 1000, cursor: null },
      excludeToolMessages: true,
    });
    return {
      projectName: interview.projectName,
      projectDocument: interview.submission.projectDocument,
      visualDirection: interview.submission.visualDirection,
      transcript: transcriptPage.page
        .map(
          (message) =>
            `## ${message.message?.role ?? "message"}\n\n${messageText(message)}`,
        )
        .join("\n\n"),
      concepts: interview.concepts.map((concept) => ({
        id: concept.id,
        name: concept.name,
        rationale: concept.rationale,
        imageId: concept.imageId,
      })),
    };
  },
});
