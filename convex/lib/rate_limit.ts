import type {
  GenericDataModel,
  GenericMutationCtx,
} from "convex/server";
import type { GenericId } from "convex/values";
import { decideRateLimit } from "./rate_limit_policy";

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
  const decision = decideRateLimit(
    existing
      ? {
          count: Number(existing.count),
          windowStartedAt: Number(existing.windowStartedAt),
        }
      : undefined,
    {
      now,
      limit: input.limit,
      windowMs: input.windowMs,
    },
  );
  if (decision.action === "create" || decision.action === "reset") {
    if (decision.action === "reset" && existing) {
      const existingId = context.db.normalizeId(
        "rateLimitBuckets",
        String(existing._id),
      );
      if (!existingId) throw new Error("Invalid rate-limit bucket.");
      await context.db.patch(existingId, {
        windowStartedAt: decision.windowStartedAt,
        count: decision.count,
        updatedAt: now,
      });
    } else {
      await context.db.insert("rateLimitBuckets", {
        ...(input.roomId ? { roomId: input.roomId } : {}),
        scope: input.scope,
        key: input.key,
        windowStartedAt: decision.windowStartedAt,
        count: decision.count,
        updatedAt: now,
      });
    }
    return;
  }
  if (!existing) throw new Error("Rate-limit bucket disappeared.");
  const existingId = context.db.normalizeId(
    "rateLimitBuckets",
    String(existing._id),
  );
  if (!existingId) throw new Error("Invalid rate-limit bucket.");
  await context.db.patch(existingId, {
    count: decision.count,
    updatedAt: now,
  });
};
