import { describe, expect, it, vi } from "vitest";
import { pollUntil } from "./poll-until";

describe("hosted bounded polling", () => {
  it("returns at the first completed value", async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce("running")
      .mockResolvedValueOnce("complete");
    const delay = vi.fn(async () => undefined);

    expect(
      await pollUntil({
        attempts: 4,
        intervalMs: 10,
        load,
        isComplete: (value) => value === "complete",
        delay,
      }),
    ).toBe("complete");
    expect(load).toHaveBeenCalledTimes(2);
    expect(delay).toHaveBeenCalledTimes(1);
  });

  it("returns the last bounded observation without sleeping again", async () => {
    const load = vi.fn(async () => "running");
    const delay = vi.fn(async () => undefined);

    expect(
      await pollUntil({
        attempts: 3,
        intervalMs: 10,
        load,
        isComplete: () => false,
        delay,
      }),
    ).toBe("running");
    expect(load).toHaveBeenCalledTimes(3);
    expect(delay).toHaveBeenCalledTimes(2);
  });
});
