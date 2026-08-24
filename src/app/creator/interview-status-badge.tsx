import type { InterviewStatus } from "../../infrastructure/interview-api";
import { creatorCopy } from "./creator-copy";
import { type CreatorLanguage } from "./creator-language";

type PassState = "unreserved" | "reserved" | "consumed";

export const interviewStatusBadge = (
  language: CreatorLanguage,
  status: InterviewStatus,
  passState: PassState,
) => {
  const text = creatorCopy[language];
  const needsReservation = status === "not_started" && passState === "unreserved";
  const label = needsReservation
    ? text.interviews.reservationRequired
    : status === "not_started"
      ? text.interviews.ready
      : text.interviews.status[status];
  const className =
    needsReservation || status === "needs_attention"
      ? "bg-error-surface text-error-text"
      : status === "not_started"
        ? "bg-soft text-muted"
        : status === "in_progress"
          ? "bg-forest text-white dark:bg-forest-strong"
          : "bg-lime text-forest dark:text-forest-strong";
  return { className, label };
};

export const InterviewStatusBadge = ({
  language,
  status,
  passState,
}: {
  language: CreatorLanguage;
  status: InterviewStatus;
  passState: PassState;
}) => {
  const { className, label } = interviewStatusBadge(language, status, passState);
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${className}`}>
      {label}
    </span>
  );
};
