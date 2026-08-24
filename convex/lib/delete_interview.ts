import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { agentComponent } from "./components";
import {
  interviewPassState,
  releaseInterviewReservation,
  reservationKeyFor,
} from "./pass_accounting";

export const deleteInterviewData = async (
  ctx: MutationCtx,
  interview: Doc<"interviews">,
) => {
  if (
    interview.clientMessageCount === 0 &&
    interviewPassState(interview) === "reserved"
  ) {
    await releaseInterviewReservation(ctx, {
      creatorId: interview.creatorId,
      interviewId: interview._id,
      reservationKey: reservationKeyFor(interview),
    });
  }

  for (const concept of interview.concepts) {
    if (concept.imageId) await ctx.storage.delete(concept.imageId);
  }

  const archives = await ctx.db
    .query("exportArchives")
    .withIndex("by_interviewId", (q) => q.eq("interviewId", interview._id))
    .take(100);
  for (const archive of archives) {
    await ctx.storage.delete(archive.storageId);
    await ctx.db.delete("exportArchives", archive._id);
  }

  const feedback = await ctx.db
    .query("interviewFeedback")
    .withIndex("by_interviewId_and_target", (q) =>
      q.eq("interviewId", interview._id),
    )
    .take(4);
  for (const row of feedback) {
    await ctx.db.delete("interviewFeedback", row._id);
  }

  const revisions = await ctx.db
    .query("documentRevisions")
    .withIndex("by_interviewId", (q) => q.eq("interviewId", interview._id))
    .take(100);
  for (const row of revisions) {
    await ctx.db.delete("documentRevisions", row._id);
  }

  await ctx.runMutation(agentComponent.threads.deleteAllForThreadIdAsync, {
    threadId: interview.agentThreadId,
  });
  await ctx.db.delete("interviews", interview._id);
};
