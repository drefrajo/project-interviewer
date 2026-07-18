export interface RateLimitBucket {
  count: number;
  windowStartedAt: number;
}

export type RateLimitDecision =
  | { action: "create" | "reset"; count: 1; windowStartedAt: number }
  | { action: "increment"; count: number };

export const decideRateLimit = (
  existing: RateLimitBucket | undefined,
  input: { now: number; limit: number; windowMs: number },
): RateLimitDecision => {
  if (input.limit < 1 || input.windowMs < 1) {
    throw new Error("Invalid rate-limit policy.");
  }
  if (!existing) {
    return {
      action: "create",
      count: 1,
      windowStartedAt: input.now,
    };
  }
  if (input.now - existing.windowStartedAt >= input.windowMs) {
    return {
      action: "reset",
      count: 1,
      windowStartedAt: input.now,
    };
  }
  if (existing.count >= input.limit) {
    throw new Error("Too many attempts. Please wait and try again.");
  }
  return { action: "increment", count: existing.count + 1 };
};
