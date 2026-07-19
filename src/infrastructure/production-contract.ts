export const DEFAULT_PRODUCTION_LIMITS = {
  maxFilesPerRoom: 20,
  maxFileBytes: 25 * 1024 * 1024,
  maxRoomBytes: 100 * 1024 * 1024,
  maxConcurrentFileWorkflows: 3,
  maxWorkflowAttempts: 3,
  deletionRecoveryDays: 7,
} as const;

const safeMetadataKeys = [
  "operationType",
  "roomId",
  "status",
  "model",
  "provider",
  "inputTokens",
  "outputTokens",
  "latencyMs",
  "attemptCount",
  "estimatedCostUsd",
  "errorCode",
] as const;

export const safeOperationalMetadata = (
  metadata: Readonly<Record<string, unknown>>,
): Record<string, unknown> =>
  Object.fromEntries(
    safeMetadataKeys.flatMap((key) =>
      metadata[key] === undefined ? [] : [[key, metadata[key]]],
    ),
  );
