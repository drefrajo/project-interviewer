import { afterEach, describe, expect, it, vi } from "vitest";

describe("Better Auth HTTP route registration", () => {
  const originalEnvironment = process.env;

  afterEach(() => {
    vi.resetModules();
    process.env = originalEnvironment;
  });

  it("does not initialize Better Auth while Convex analyzes modules", async () => {
    process.env = { ...originalEnvironment };
    delete process.env.SITE_URL;
    vi.resetModules();

    await expect(import("./http")).resolves.toHaveProperty("default");
  });

  it("reads auth environment when the OPTIONS request runs", async () => {
    process.env = { ...originalEnvironment };
    delete process.env.SITE_URL;
    delete process.env.CONVEX_SITE_URL;
    delete process.env.BETTER_AUTH_SECRET;
    delete process.env.CREATOR_ALLOWLIST;
    delete process.env.GITHUB_CLIENT_ID;
    delete process.env.GITHUB_CLIENT_SECRET;
    vi.resetModules();
    const { default: http } = await import("./http");

    process.env = {
      ...originalEnvironment,
      SITE_URL: "http://localhost:5173",
      CONVEX_SITE_URL: "https://example.convex.site",
      BETTER_AUTH_SECRET: "test-secret-at-least-32-characters-long",
      CREATOR_ALLOWLIST: "creator@example.com",
      GITHUB_CLIENT_ID: "github-id",
      GITHUB_CLIENT_SECRET: "github-secret",
    };

    const route = http.lookup("/api/auth/sign-in/social", "OPTIONS");
    expect(route).not.toBeNull();
    const handler = route?.[0] as unknown as {
      _handler(context: object, request: Request): Promise<Response>;
    };
    const response = await handler._handler(
      {},
      new Request(
        "https://example.convex.site/api/auth/sign-in/social",
        {
          method: "OPTIONS",
          headers: {
            Origin: "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
          },
        },
      ),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:5173",
    );
  });

  it("rejects an invalid Stripe signature before calling the billing mutation", async () => {
    process.env = {
      ...originalEnvironment,
      SITE_URL: "http://localhost:5173",
      STRIPE_MODE: "sandbox",
      STRIPE_WEBHOOK_SIGNING_SECRET: "whsec_test_secret",
    };
    vi.resetModules();
    const { default: http } = await import("./http");
    const route = http.lookup("/stripe/webhook", "POST");
    expect(route).not.toBeNull();
    const runMutation = vi.fn();
    const handler = route?.[0] as unknown as {
      _handler(context: { runMutation: typeof runMutation }, request: Request): Promise<Response>;
    };
    const response = await handler._handler(
      { runMutation },
      new Request("https://example.convex.site/stripe/webhook", {
        method: "POST",
        body: JSON.stringify({ id: "evt_invalid" }),
        headers: { "stripe-signature": "t=1,v1=00" },
      }),
    );

    expect(response.status).toBe(400);
    expect(runMutation).not.toHaveBeenCalled();
  });
});
