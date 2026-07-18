import { DEFAULT_PRODUCTION_LIMITS } from "../../src/infrastructure/production-contract";

type RoomScope = Readonly<{
  roomId: string;
  freelancerAuthUserId: string;
}>;

type RoomActor =
  | Readonly<{ kind: "freelancer"; authUserId: string }>
  | Readonly<{
      kind: "client";
      expectedInviteVersion: number;
      session: Readonly<{
        roomId: string;
        sessionHash: string;
        active: boolean;
        inviteVersion: number;
      }>;
    }>;

export const assertRoomAccess = (room: RoomScope, actor: RoomActor) => {
  if (
    actor.kind === "freelancer" &&
    actor.authUserId === room.freelancerAuthUserId
  ) {
    return { kind: "freelancer" as const, actorId: actor.authUserId };
  }
  if (
    actor.kind === "client" &&
    actor.session.active &&
    actor.session.roomId === room.roomId &&
    actor.session.inviteVersion === actor.expectedInviteVersion
  ) {
    return {
      kind: "client" as const,
      actorId: actor.session.sessionHash,
    };
  }
  throw new Error("Room access denied.");
};

type UploadQuotaState = Readonly<{
  activeFileCount: number;
  activeRoomBytes: number;
  incomingFileBytes: number;
  runningFileWorkflows: number;
}>;

export const enforceUploadQuota = (state: UploadQuotaState): void => {
  if (state.activeFileCount >= DEFAULT_PRODUCTION_LIMITS.maxFilesPerRoom) {
    throw new Error("Room file count quota exceeded.");
  }
  if (state.incomingFileBytes > DEFAULT_PRODUCTION_LIMITS.maxFileBytes) {
    throw new Error("File size quota exceeded.");
  }
  if (
    state.activeRoomBytes + state.incomingFileBytes >
    DEFAULT_PRODUCTION_LIMITS.maxRoomBytes
  ) {
    throw new Error("Room storage quota exceeded.");
  }
  if (
    state.runningFileWorkflows >=
    DEFAULT_PRODUCTION_LIMITS.maxConcurrentFileWorkflows
  ) {
    throw new Error("Concurrent file workflow quota exceeded.");
  }
};

export const enforceOperationConcurrency = (
  operationType: string,
  activeCount: number,
): void => {
  const maximum = operationType === "file_processing" ? 3 : 1;
  if (activeCount >= maximum) {
    throw new Error(`${operationType} concurrency quota exceeded.`);
  }
};

type ExistingOperation = Readonly<{
  status:
    | "pending"
    | "running"
    | "retryable"
    | "succeeded"
    | "failed"
    | "cancelled";
  attemptCount: number;
}>;

export const decideIdempotentOperation = (
  existing: ExistingOperation | undefined,
):
  | Readonly<{ action: "create"; attemptCount: 1 }>
  | Readonly<{ action: "reuse" }>
  | Readonly<{ action: "retry"; attemptCount: number }> => {
  if (!existing || existing.status === "failed" || existing.status === "cancelled") {
    return { action: "create", attemptCount: 1 };
  }
  if (
    existing.status === "pending" ||
    existing.status === "running" ||
    existing.status === "succeeded"
  ) {
    return { action: "reuse" };
  }
  if (existing.attemptCount >= DEFAULT_PRODUCTION_LIMITS.maxWorkflowAttempts) {
    throw new Error("Workflow retry limit exceeded.");
  }
  return { action: "retry", attemptCount: existing.attemptCount + 1 };
};

export const canCommitOperationResult = (
  status: string,
  roomDeleted: boolean,
): boolean =>
  !roomDeleted && (status === "pending" || status === "running");

export const assertRoomWritablePhase = (phase: string): void => {
  if (phase === "archived") {
    throw new Error("Archived Project Rooms are read-only.");
  }
};

export const cancelledAggregateKind = (
  operationType: string,
): "material" | "interview" | null =>
  operationType === "file_processing"
    ? "material"
    : operationType.startsWith("interview_")
      ? "interview"
      : null;

export const canCommitBriefSnapshot = (input: {
  roomPhase: string;
  interviewStatus?: string;
  expectedContextPackId?: string;
  latestContextPackId?: string;
}): boolean =>
  input.roomPhase === "freelancer_review" &&
  (input.interviewStatus === "completed" ||
    input.interviewStatus === "completed_early") &&
  Boolean(input.expectedContextPackId) &&
  input.expectedContextPackId === input.latestContextPackId;

const supportedFileExtensions = new Set([
  "pdf",
  "docx",
  "pptx",
  "xlsx",
  "csv",
  "txt",
  "md",
  "json",
  "png",
  "jpg",
  "jpeg",
  "webp",
]);

export const validateStoredUpload = (
  intent: Readonly<{
    name: string;
    expectedBytes: number;
    declaredContentType: string;
  }>,
  stored: Readonly<{ size: number; contentType?: string }>,
):
  | Readonly<{ accepted: true }>
  | Readonly<{
      accepted: false;
      reason:
        | "size_mismatch"
        | "unsupported_type"
        | "content_type_mismatch";
    }> => {
  if (stored.size !== intent.expectedBytes) {
    return { accepted: false, reason: "size_mismatch" };
  }
  const extension = intent.name.split(".").at(-1)?.toLowerCase() ?? "";
  if (!supportedFileExtensions.has(extension)) {
    return { accepted: false, reason: "unsupported_type" };
  }
  if (
    stored.contentType &&
    stored.contentType !== "application/octet-stream" &&
    intent.declaredContentType !== "application/octet-stream" &&
    stored.contentType !== intent.declaredContentType
  ) {
    return { accepted: false, reason: "content_type_mismatch" };
  }
  return { accepted: true };
};

export const PURGE_TABLE_ORDER = [
  "auditEvents",
  "rateLimitBuckets",
  "briefChangeRequests",
  "reviewVersions",
  "briefOperations",
  "briefDrafts",
  "discoveryFindings",
  "interviewEvents",
  "interviewCorrections",
  "interviewTurns",
  "interviewOperations",
  "interviewPlans",
  "discoveryInterviews",
  "contextPackRevisions",
  "analysisFeedback",
  "materialChunks",
  "fileAnalyses",
  "uploadIntents",
  "projectMaterials",
  "sharedResources",
  "respondingDeviceLeases",
  "clientProfiles",
  "clientSessions",
  "inviteCapabilities",
  "durableOperations",
  "usageRecords",
  "deletionRecoveryRecords",
  "projectRooms",
] as const;
