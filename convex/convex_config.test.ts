import { describe, expect, it, vi } from "vitest";

vi.mock("@convex-dev/agent/convex.config", () => ({
  default: { componentDefinitionPath: "@convex-dev/agent/convex.config.js" },
}));
vi.mock("@convex-dev/rate-limiter/convex.config", () => ({
  default: {
    componentDefinitionPath: "@convex-dev/rate-limiter/convex.config.js",
  },
}));
vi.mock("./betterAuth/convex.config", () => ({
  default: { componentDefinitionPath: "./betterAuth/convex.config.js" },
}));

import app from "./convex.config";

describe("Convex deployment environment", () => {
  it("does not redeclare Convex-provided system environment variables", () => {
    const definition = (
      app as unknown as {
        export(): { envVars: Array<[string, unknown]> };
      }
    ).export();
    const names = definition.envVars.map(([name]) => name);

    expect(names).toContain("SITE_URL");
    expect(names).not.toContain("CONVEX_SITE_URL");
    expect(names).not.toContain("CONVEX_CLOUD_URL");
  });
});
