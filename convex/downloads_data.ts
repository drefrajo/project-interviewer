import { listMessages } from "@convex-dev/agent";
import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { agentComponent } from "./lib/components";
import { publicCreatorIdentity } from "./lib/creator_identity";
import { dashboardStatus } from "./lib/domain";
import { agentMessageContentText } from "./lib/agent_message";
import { resolveInterviewConfiguration } from "./lib/interview_kind";

const archiveConcept = v.object({
  id: v.string(),
  name: v.string(),
  rationale: v.string(),
  prompt: v.string(),
  imageId: v.optional(v.id("_storage")),
});

const exportManifest = v.object({
  projectName: v.string(),
  projectDocument: v.optional(v.string()),
  visualDirectionJson: v.optional(v.string()),
  transcriptMarkdown: v.string(),
  transcriptJson: v.string(),
  interviewJson: v.string(),
  concepts: v.array(archiveConcept),
});

export const get = internalQuery({
  args: {
    interviewId: v.id("interviews"),
    tokenIdentifier: v.string(),
  },
  returns: v.union(exportManifest, v.null()),
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("creatorProfiles")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", args.tokenIdentifier),
      )
      .unique();
    const interview = await ctx.db.get("interviews", args.interviewId);
    if (!profile || !interview || interview.creatorId !== profile._id) {
      return null;
    }
    const transcriptPage = await listMessages(ctx, agentComponent, {
      threadId: interview.agentThreadId,
      paginationOpts: { numItems: 200, cursor: null },
      excludeToolMessages: true,
      statuses: ["success"],
    });
    const transcript = [...transcriptPage.page]
      .reverse()
      .flatMap((item) => {
        const message = item.message;
        if (
          !message ||
          (message.role !== "user" && message.role !== "assistant")
        ) {
          return [];
        }
        return [
          {
            role: message.role === "user" ? "client" : "assistant",
            content: agentMessageContentText(message.content),
            createdAt: item._creationTime,
          },
        ];
      });
    const concepts = interview.concepts.map((concept) => ({
      id: concept.id,
      name: concept.name,
      rationale: concept.rationale,
      prompt: concept.prompt,
      ...(concept.imageId ? { imageId: concept.imageId } : {}),
    }));
    const exportedAt = Date.now();
    const interviewConfiguration = resolveInterviewConfiguration(interview);
    return {
      projectName: interview.projectName,
      ...(interview.projectDocument
        ? { projectDocument: interview.projectDocument }
        : {}),
      ...(interview.visualDirection
        ? {
            visualDirectionJson: JSON.stringify(
              interview.visualDirection,
              null,
              2,
            ),
          }
        : {}),
      transcriptMarkdown: transcript
        .map(
          (message) =>
            `## ${message.role === "client" ? "Client" : "AI assistant"}\n\n${message.content}`,
        )
        .join("\n\n"),
      transcriptJson: JSON.stringify(transcript, null, 2),
      interviewJson: JSON.stringify(
        {
          exportVersion: 1,
          exportedAt,
          creator: publicCreatorIdentity(profile),
          interview: {
            id: interview._id,
            projectName: interview.projectName,
            clientLanguage: interview.clientLanguage,
            ...interviewConfiguration,
            model: "gpt-5.6-terra",
            status: dashboardStatus(interview),
            step: interview.step,
            instructions: interview.instructions,
            interviewPlan: interview.interviewPlan,
            createdAt: interview.createdAt,
            lastActivityAt: interview.lastActivityAt ?? interview.updatedAt,
            retentionExpiresAt: interview.retentionExpiresAt,
            startedAt: interview.startedAt,
            submittedAt: interview.submission?.submittedAt,
            clientMessageCount: interview.clientMessageCount,
            documentRevisionCount: interview.documentRevisionCount,
            projectDocument: interview.projectDocument,
            visualDirection: interview.visualDirection,
            concepts: interview.concepts.map((concept) => ({
              id: concept.id,
              name: concept.name,
              rationale: concept.rationale,
              prompt: concept.prompt,
              status: concept.status,
              ...(concept.errorCode ? { errorCode: concept.errorCode } : {}),
            })),
            submission: interview.submission,
            operation: interview.operation,
            usage: interview.usage,
          },
          transcript,
        },
        null,
        2,
      ),
      concepts,
    };
  },
});

export const registerArchive = internalMutation({
  args: {
    interviewId: v.id("interviews"),
    tokenIdentifier: v.string(),
    storageId: v.id("_storage"),
    expiresAt: v.number(),
  },
  returns: v.union(v.id("exportArchives"), v.null()),
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("creatorProfiles")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", args.tokenIdentifier),
      )
      .unique();
    const interview = await ctx.db.get("interviews", args.interviewId);
    if (!profile || !interview || interview.creatorId !== profile._id) {
      return null;
    }
    const previousArchives = await ctx.db
      .query("exportArchives")
      .withIndex("by_interviewId", (q) =>
        q.eq("interviewId", interview._id),
      )
      .take(10);
    for (const archive of previousArchives) {
      await ctx.storage.delete(archive.storageId);
      await ctx.db.delete("exportArchives", archive._id);
    }
    return await ctx.db.insert("exportArchives", {
      interviewId: interview._id,
      creatorId: profile._id,
      storageId: args.storageId,
      expiresAt: args.expiresAt,
      createdAt: Date.now(),
    });
  },
});

export const getArchive = internalQuery({
  args: { archiveId: v.id("exportArchives") },
  returns: v.union(
    v.object({ storageId: v.id("_storage") }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const archive = await ctx.db.get("exportArchives", args.archiveId);
    return archive ? { storageId: archive.storageId } : null;
  },
});

export const removeArchive = internalMutation({
  args: { archiveId: v.id("exportArchives") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const archive = await ctx.db.get("exportArchives", args.archiveId);
    if (archive) await ctx.db.delete("exportArchives", archive._id);
    return null;
  },
});
