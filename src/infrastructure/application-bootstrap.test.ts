import { describe, expect, it, vi } from "vitest";
import { bootstrapApplication } from "./application-bootstrap";

describe("application bootstrap", () => {
  it("constructs only the local application in local mode", async () => {
    const local = vi.fn(async () => ({ kind: "local" as const }));
    const hosted = vi.fn(() => ({ kind: "hosted" as const }));

    await expect(
      bootstrapApplication({ mode: "local" }, { local, hosted }),
    ).resolves.toEqual({ kind: "local" });
    expect(local).toHaveBeenCalledOnce();
    expect(hosted).not.toHaveBeenCalled();
  });

  it("never constructs or reads the browser-local application in production", async () => {
    const local = vi.fn(async () => {
      throw new Error("production touched the local application");
    });
    const hosted = vi.fn(() => ({ kind: "hosted" as const }));
    const environment = {
      mode: "production" as const,
      public: {
        convexUrl: "https://example.convex.cloud",
        convexSiteUrl: "https://example.convex.site",
        siteUrl: "https://example.test",
      },
    };

    await expect(
      bootstrapApplication(environment, { local, hosted }),
    ).resolves.toEqual({ kind: "hosted" });
    expect(hosted).toHaveBeenCalledWith(environment.public);
    expect(local).not.toHaveBeenCalled();
  });
});
