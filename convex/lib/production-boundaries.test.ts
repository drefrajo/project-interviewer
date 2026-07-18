import { describe, expect, it } from "vitest";
import {
  assertRoomAccess,
  assertRoomWritablePhase,
  canCommitOperationResult,
  canCommitBriefSnapshot,
  cancelledAggregateKind,
  decideIdempotentOperation,
  enforceOperationConcurrency,
  enforceUploadQuota,
  PURGE_BATCH_SIZE,
  PURGE_BATCH_TABLES,
  PURGE_TABLE_ORDER,
  validateStoredUpload,
} from "./production_boundaries";
import { decideRateLimit } from "./rate_limit_policy";

describe("Convex production boundaries", () => {
  it("throttles repeated mutations and resets only after the bounded window", () => {
    expect(
      decideRateLimit(undefined, { now: 1_000, limit: 2, windowMs: 60_000 }),
    ).toEqual({
      action: "create",
      count: 1,
      windowStartedAt: 1_000,
    });
    expect(
      decideRateLimit(
        { count: 1, windowStartedAt: 1_000 },
        { now: 2_000, limit: 2, windowMs: 60_000 },
      ),
    ).toEqual({ action: "increment", count: 2 });
    expect(() =>
      decideRateLimit(
        { count: 2, windowStartedAt: 1_000 },
        { now: 3_000, limit: 2, windowMs: 60_000 },
      ),
    ).toThrow(/too many attempts/i);
    expect(
      decideRateLimit(
        { count: 2, windowStartedAt: 1_000 },
        { now: 61_000, limit: 2, windowMs: 60_000 },
      ),
    ).toEqual({
      action: "reset",
      count: 1,
      windowStartedAt: 61_000,
    });
  });

  it("authorizes Freelancers and room-scoped Client sessions without cross-room access", () => {
    expect(
      assertRoomAccess(
        { roomId: "room-a", freelancerAuthUserId: "user-a" },
        { kind: "freelancer", authUserId: "user-a" },
      ),
    ).toEqual({ kind: "freelancer", actorId: "user-a" });
    expect(
      assertRoomAccess(
        { roomId: "room-a", freelancerAuthUserId: "user-a" },
        {
          kind: "client",
          session: {
            roomId: "room-a",
            sessionHash: "hash",
            active: true,
            inviteVersion: 2,
          },
          expectedInviteVersion: 2,
        },
      ),
    ).toEqual({ kind: "client", actorId: "hash" });
    expect(() =>
      assertRoomAccess(
        { roomId: "room-a", freelancerAuthUserId: "user-a" },
        {
          kind: "client",
          session: {
            roomId: "room-b",
            sessionHash: "hash",
            active: true,
            inviteVersion: 2,
          },
          expectedInviteVersion: 2,
        },
      ),
    ).toThrow(/room access denied/i);
  });

  it("enforces per-file, room, file-count, and concurrency quotas before work starts", () => {
    expect(() =>
      enforceUploadQuota({
        activeFileCount: 20,
        activeRoomBytes: 0,
        incomingFileBytes: 1,
        runningFileWorkflows: 0,
      }),
    ).toThrow(/file count/i);
    expect(() =>
      enforceUploadQuota({
        activeFileCount: 0,
        activeRoomBytes: 0,
        incomingFileBytes: 25 * 1024 * 1024 + 1,
        runningFileWorkflows: 0,
      }),
    ).toThrow(/file size/i);
    expect(() =>
      enforceUploadQuota({
        activeFileCount: 0,
        activeRoomBytes: 100 * 1024 * 1024,
        incomingFileBytes: 1,
        runningFileWorkflows: 0,
      }),
    ).toThrow(/room storage/i);
    expect(() =>
      enforceUploadQuota({
        activeFileCount: 0,
        activeRoomBytes: 0,
        incomingFileBytes: 1,
        runningFileWorkflows: 3,
      }),
    ).toThrow(/concurrent/i);
  });

  it("serializes interview/brief mutations and bounds file workers", () => {
    expect(() =>
      enforceOperationConcurrency("file_processing", 3),
    ).toThrow(/concurrency/i);
    expect(() =>
      enforceOperationConcurrency("interview_turn", 1),
    ).toThrow(/concurrency/i);
    expect(() =>
      enforceOperationConcurrency("brief_generation", 1),
    ).toThrow(/concurrency/i);
    expect(() =>
      enforceOperationConcurrency("file_processing", 2),
    ).not.toThrow();
  });

  it("reuses active/successful idempotent operations and bounds retries", () => {
    expect(decideIdempotentOperation(undefined)).toEqual({
      action: "create",
      attemptCount: 1,
    });
    expect(
      decideIdempotentOperation({ status: "running", attemptCount: 1 }),
    ).toEqual({ action: "reuse" });
    expect(
      decideIdempotentOperation({ status: "succeeded", attemptCount: 1 }),
    ).toEqual({ action: "reuse" });
    expect(
      decideIdempotentOperation({ status: "retryable", attemptCount: 1 }),
    ).toEqual({ action: "retry", attemptCount: 2 });
    expect(() =>
      decideIdempotentOperation({ status: "retryable", attemptCount: 2 }),
    ).toThrow(/retry limit/i);
  });

  it("never commits late workflow results after cancellation", () => {
    expect(canCommitOperationResult("running", false)).toBe(true);
    expect(canCommitOperationResult("running", true)).toBe(false);
    expect(canCommitOperationResult("cancelled", false)).toBe(false);
    expect(canCommitOperationResult("succeeded", false)).toBe(false);
  });

  it("keeps archived rooms read-only and cancelled aggregates recoverable", () => {
    expect(() => assertRoomWritablePhase("archived")).toThrow(/read-only/i);
    expect(() => assertRoomWritablePhase("discovery")).not.toThrow();
    expect(cancelledAggregateKind("file_processing")).toBe("material");
    expect(cancelledAggregateKind("interview_turn")).toBe("interview");
    expect(cancelledAggregateKind("brief_generation")).toBeNull();
  });

  it("rejects a brief result when discovery or its Context Pack changed", () => {
    const snapshot = {
      roomPhase: "freelancer_review",
      interviewStatus: "completed",
      expectedContextPackId: "context-2",
      latestContextPackId: "context-2",
    };
    expect(canCommitBriefSnapshot(snapshot)).toBe(true);
    expect(
      canCommitBriefSnapshot({
        ...snapshot,
        latestContextPackId: "context-3",
      }),
    ).toBe(false);
    expect(
      canCommitBriefSnapshot({
        ...snapshot,
        interviewStatus: "active",
      }),
    ).toBe(false);
    expect(
      canCommitBriefSnapshot({ ...snapshot, roomPhase: "archived" }),
    ).toBe(false);
    expect(
      canCommitBriefSnapshot({ ...snapshot, roomPhase: "client_review" }),
    ).toBe(false);
  });

  it("verifies uploaded storage metadata against the authorized intent", () => {
    expect(
      validateStoredUpload(
        {
          name: "brief.pdf",
          expectedBytes: 1024,
          declaredContentType: "application/pdf",
        },
        { size: 1024, contentType: "application/pdf" },
      ),
    ).toEqual({ accepted: true });
    expect(
      validateStoredUpload(
        {
          name: "brief.pdf",
          expectedBytes: 1024,
          declaredContentType: "application/pdf",
        },
        { size: 2048, contentType: "application/pdf" },
      ),
    ).toMatchObject({ accepted: false, reason: "size_mismatch" });
    expect(
      validateStoredUpload(
        {
          name: "payload.exe",
          expectedBytes: 1024,
          declaredContentType: "application/octet-stream",
        },
        { size: 1024, contentType: "application/octet-stream" },
      ),
    ).toMatchObject({ accepted: false, reason: "unsupported_type" });
  });

  it("purges dependent room data before the room itself", () => {
    expect(PURGE_TABLE_ORDER.at(-1)).toBe("projectRooms");
    expect(PURGE_TABLE_ORDER).toContain("rateLimitBuckets");
    expect(PURGE_TABLE_ORDER.indexOf("projectMaterials")).toBeLessThan(
      PURGE_TABLE_ORDER.indexOf("projectRooms"),
    );
    expect(PURGE_BATCH_SIZE).toBeLessThanOrEqual(100);
    expect(PURGE_BATCH_TABLES).not.toContain("projectRooms");
    expect(PURGE_BATCH_TABLES).toContain("deletionRecoveryRecords");
  });
});
