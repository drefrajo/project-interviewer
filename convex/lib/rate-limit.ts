import type {
  GenericDataModel,
  GenericMutationCtx,
} from "convex/server";
import type { GenericId } from "convex/values";

export const enforceRateLimit = async (
  context: GenericMutationCtx<GenericDataModel>,
  input: {
    scope: string;
    key: string;
    limit: number;
    windowMs: number;
    roomId?: GenericId<"projectRooms">;
    now?: number;
  },
) => {
  const now = input.now ?? Date.now();
  const existing = await context.db
    .query("rateLimitBuckets")
    .withIndex("by_key", (query) => query.eq("key", input.key))
    .collect()
    .then((items) => items.find((item) => item.scope === input.scope));
  if (!existing || now - Number(existing.windowStartedAt) >= input.windowMs) {
    if (existing) {
      const existingId = context.db.normalizeId(
        "rateLimitBuckets",
        String(existing._id),
      );
      if (!existingId) throw new Error("Invalid rate-limit bucket.");
      await context.db.patch(existingId, {
        windowStartedAt: now,
        count: 1,
        updatedAt: now,
      });
    } else {
      await context.db.insert("rateLimitBuckets", {
        ...(input.roomId ? { roomId: input.roomId } : {}),
        scope: input.scope,
        key: input.key,
        windowStartedAt: now,
        count: 1,
        updatedAt: now,
      });
    }
    return;
  }
  if (Number(existing.count) >= input.limit) {
    throw new Error("Too many attempts. Please wait and try again.");
  }
  const existingId = context.db.normalizeId(
    "rateLimitBuckets",
    String(existing._id),
  );
  if (!existingId) throw new Error("Invalid rate-limit bucket.");
  await context.db.patch(existingId, {
    count: Number(existing.count) + 1,
    updatedAt: now,
  });
};
