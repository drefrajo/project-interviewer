import type { Doc } from "../_generated/dataModel";

export const COMPLETED_RETENTION_MONTHS = 24;
export const INCOMPLETE_RETENTION_MONTHS = 24;
export const RETENTION_WARNING_DAYS = 30;
export const RETENTION_POLICY_VERSION = 2;

const DAY_MS = 24 * 60 * 60 * 1000;

export const addUtcCalendarMonths = (timestamp: number, months: number) => {
  const source = new Date(timestamp);
  const targetMonthStart = Date.UTC(
    source.getUTCFullYear(),
    source.getUTCMonth() + months,
    1,
    source.getUTCHours(),
    source.getUTCMinutes(),
    source.getUTCSeconds(),
    source.getUTCMilliseconds(),
  );
  const target = new Date(targetMonthStart);
  const lastDayOfTargetMonth = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(source.getUTCDate(), lastDayOfTargetMonth));
  return target.getTime();
};

export const retentionExpiresAt = (args: {
  lastActivityAt: number;
  submittedAt?: number | undefined;
}) =>
  addUtcCalendarMonths(
    args.submittedAt ?? args.lastActivityAt,
    args.submittedAt === undefined
      ? INCOMPLETE_RETENTION_MONTHS
      : COMPLETED_RETENTION_MONTHS,
  );

export const retentionWarningAt = (expiresAt: number) =>
  expiresAt - RETENTION_WARNING_DAYS * DAY_MS;

export const activityRetentionPatch = (lastActivityAt: number) => ({
  lastActivityAt,
  retentionPolicyVersion: RETENTION_POLICY_VERSION,
  retentionExpiresAt: retentionExpiresAt({ lastActivityAt }),
  retentionWarningAt: retentionWarningAt(
    retentionExpiresAt({ lastActivityAt }),
  ),
  retentionWarningAttemptedAt: undefined,
  retentionWarningSentAt: undefined,
});

export const initialActivityRetention = (lastActivityAt: number) => {
  const expiresAt = retentionExpiresAt({ lastActivityAt });
  return {
    lastActivityAt,
    retentionPolicyVersion: RETENTION_POLICY_VERSION,
    retentionExpiresAt: expiresAt,
    retentionWarningAt: retentionWarningAt(expiresAt),
  };
};

export const completedRetentionPatch = (submittedAt: number) => ({
  lastActivityAt: submittedAt,
  retentionPolicyVersion: RETENTION_POLICY_VERSION,
  retentionExpiresAt: retentionExpiresAt({
    lastActivityAt: submittedAt,
    submittedAt,
  }),
  retentionWarningAt: retentionWarningAt(
    retentionExpiresAt({ lastActivityAt: submittedAt, submittedAt }),
  ),
  retentionWarningAttemptedAt: undefined,
  retentionWarningSentAt: undefined,
});

export const initialCompletedRetention = (submittedAt: number) => {
  const expiresAt = retentionExpiresAt({
    lastActivityAt: submittedAt,
    submittedAt,
  });
  return {
    lastActivityAt: submittedAt,
    retentionPolicyVersion: RETENTION_POLICY_VERSION,
    retentionExpiresAt: expiresAt,
    retentionWarningAt: retentionWarningAt(expiresAt),
  };
};

export const legacyRetentionPatch = (interview: Doc<"interviews">) => {
  const lastActivityAt =
    interview.submission?.submittedAt ??
    interview.lastActivityAt ??
    interview.updatedAt;
  const expiresAt = retentionExpiresAt({
    lastActivityAt,
    submittedAt: interview.submission?.submittedAt,
  });
  const deadlineChanged = interview.retentionExpiresAt !== expiresAt;
  return {
    lastActivityAt,
    retentionPolicyVersion: RETENTION_POLICY_VERSION,
    retentionExpiresAt: expiresAt,
    retentionWarningAt: retentionWarningAt(expiresAt),
    ...(deadlineChanged
      ? {
          retentionWarningAttemptedAt: undefined,
          retentionWarningSentAt: undefined,
        }
      : {}),
  };
};
