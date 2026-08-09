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

  await ctx.runMutation(agentComponent.threads.deleteAllForThreadIdAsync, {
    threadId: interview.agentThreadId,
  });
  await ctx.db.delete("interviews", interview._id);
};
