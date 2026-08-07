import { describe, expect, it } from "vitest";
import { isLocalDevelopmentAuthBypassEnabled } from "./environment";

describe("local development auth bypass", () => {
  it("requires the explicit marker and a loopback Convex site", () => {
    expect(
      isLocalDevelopmentAuthBypassEnabled({
        CONVEX_SITE_URL: "http://127.0.0.1:3211",
        LOCAL_DEV_AUTH_BYPASS: "true",
      }),
    ).toBe(true);
    expect(
      isLocalDevelopmentAuthBypassEnabled({
        CONVEX_SITE_URL: "https://example.convex.site",
        LOCAL_DEV_AUTH_BYPASS: "true",
      }),
    ).toBe(false);
    expect(
      isLocalDevelopmentAuthBypassEnabled({
        CONVEX_SITE_URL: "http://127.0.0.1:3211",
      }),
    ).toBe(false);
  });
});
