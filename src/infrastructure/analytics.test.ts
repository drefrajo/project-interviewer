import { afterEach, describe, expect, it, vi } from "vitest";
import { installAnalytics, trackEvent } from "./analytics";

const analyticsScriptSelector =
  'script[src="https://data.drefrajo.dev/script.js"]';

afterEach(() => {
  document
    .querySelectorAll(analyticsScriptSelector)
    .forEach((script) => script.remove());
  delete window.umami;
});

describe("installAnalytics", () => {
  it("does not load the tracker in local mode", () => {
    installAnalytics("local");
    expect(document.querySelector(analyticsScriptSelector)).toBeNull();
  });

  it("loads the tracker in development mode with privacy attributes", () => {
    installAnalytics("development");
    const script = document.querySelector(analyticsScriptSelector);
    expect(script).not.toBeNull();
    expect(script?.getAttribute("data-website-id")).toBe(
      "4eae153d-6e6b-4d01-bbc6-482422a8fa89",
    );
    expect(script?.getAttribute("data-exclude-search")).toBe("true");
    expect(script?.getAttribute("data-do-not-track")).toBe("true");
  });

  it("loads the tracker in production mode", () => {
    installAnalytics("production");
    expect(document.querySelector(analyticsScriptSelector)).not.toBeNull();
  });

  it("injects the tracker script only once", () => {
    installAnalytics("production");
    installAnalytics("production");
    expect(document.querySelectorAll(analyticsScriptSelector)).toHaveLength(1);
  });
});

describe("trackEvent", () => {
  it("dispatches immediately when the tracker is available", () => {
    const track = vi.fn().mockResolvedValue(undefined);
    window.umami = { track };
    trackEvent("interview_submitted");
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith("interview_submitted", undefined);
  });

  it("sends event data with the event name", () => {
    const track = vi.fn().mockResolvedValue(undefined);
    window.umami = { track };
    trackEvent("passes_checkout_started", { pack: "one_pass" });
    expect(track).toHaveBeenCalledWith("passes_checkout_started", {
      pack: "one_pass",
    });
  });

  it("queues events until the tracker becomes available", () => {
    const track = vi.fn().mockResolvedValue(undefined);
    trackEvent("interview_started");
    expect(track).not.toHaveBeenCalled();
    window.umami = { track };
    trackEvent("interview_message_sent");
    expect(track).toHaveBeenCalledTimes(2);
    expect(track).toHaveBeenNthCalledWith(1, "interview_started");
    expect(track).toHaveBeenNthCalledWith(
      2,
      "interview_message_sent",
      undefined,
    );
  });
});