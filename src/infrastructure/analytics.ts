import type { BrowserRuntimeMode } from "./environment";

const ANALYTICS_SCRIPT_SRC = "https://data.drefrajo.dev/script.js";
const ANALYTICS_WEBSITE_ID = "4eae153d-6e6b-4d01-bbc6-482422a8fa89";
const ANALYTICS_EVENT_QUEUE_LIMIT = 100;

export type AnalyticsEventName =
  | "interview_started"
  | "interview_message_sent"
  | "interview_changes_requested"
  | "interview_document_approved"
  | "interview_submitted"
  | "creator_signin_attempted"
  | "interview_created"
  | "interview_updated"
  | "interview_link_copied"
  | "interview_link_regenerated"
  | "interview_reserved"
  | "interview_deactivated"
  | "interview_deleted"
  | "interview_exported"
  | "template_created"
  | "template_updated"
  | "template_deleted"
  | "settings_updated"
  | "passes_checkout_started";

type AnalyticsEventData = Readonly<Record<string, string | number | boolean>>;

type UmamiTracker = {
  track: (name: string, data?: AnalyticsEventData) => Promise<unknown>;
};

declare global {
  interface Window {
    umami?: UmamiTracker;
  }
}

const queuedEvents: AnalyticsEventName[] = [];

export const installAnalytics = (mode: BrowserRuntimeMode): void => {
  if (mode === "local") return;
  if (
    document.head.querySelector(
      `script[data-website-id="${ANALYTICS_WEBSITE_ID}"]`,
    )
  ) {
    return;
  }
  const script = document.createElement("script");
  script.src = ANALYTICS_SCRIPT_SRC;
  script.async = true;
  script.dataset.websiteId = ANALYTICS_WEBSITE_ID;
  script.dataset.excludeSearch = "true";
  script.dataset.doNotTrack = "true";
  document.head.appendChild(script);
};

export const trackEvent = (
  name: AnalyticsEventName,
  data?: AnalyticsEventData,
): void => {
  const tracker = window.umami?.track;
  if (!tracker) {
    if (queuedEvents.length < ANALYTICS_EVENT_QUEUE_LIMIT) {
      queuedEvents.push(name);
    }
    return;
  }
  for (const queuedName of queuedEvents.splice(0)) {
    void tracker(queuedName);
  }
  void tracker(name, data);
};