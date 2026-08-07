import { afterEach, describe, expect, it, vi } from "vitest";
import worker, { type WorkerEnvironment } from "./worker";

const createEnvironment = (
  proxyOrigin?: string,
): WorkerEnvironment & { assetFetch: ReturnType<typeof vi.fn> } => {
  const assetFetch = vi.fn(async () => new Response("asset"));
  return {
    ASSETS: { fetch: assetFetch },
    ...(proxyOrigin
      ? { OAUTH_PROXY_CONVEX_SITE_URL: proxyOrigin }
      : {}),
    assetFetch,
  };
};

describe("production OAuth callback proxy", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("leaves the callback on the asset path when the proxy is not configured", async () => {
    const environment = createEnvironment();
    const response = await worker.fetch(
      new Request(
        "https://development.example/api/auth/callback/google?code=dev",
      ),
      environment,
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("asset");
    expect(environment.assetFetch).toHaveBeenCalledOnce();
  });

  it.each(["google", "github"] as const)(
    "proxies the %s callback to the configured Convex site",
    async (provider) => {
      const environment = createEnvironment(
        "https://production-deployment.convex.site",
      );
      const upstreamFetch = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(
          Response.redirect(
            "https://interview.drefrajo.dev/?ott=test-token",
            302,
          ),
        );

      const response = await worker.fetch(
        new Request(
          `https://interview.drefrajo.dev/api/auth/callback/${provider}?code=test&state=test`,
        ),
        environment,
      );

      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toBe(
        "https://interview.drefrajo.dev/?ott=test-token",
      );
      expect(upstreamFetch).toHaveBeenCalledOnce();
      const [request] = upstreamFetch.mock.calls[0] ?? [];
      expect(request).toBeInstanceOf(Request);
      expect((request as Request).url).toBe(
        `https://production-deployment.convex.site/api/auth/callback/${provider}?code=test&state=test`,
      );
      expect(environment.assetFetch).not.toHaveBeenCalled();
    },
  );

  it("does not proxy other auth routes", async () => {
    const environment = createEnvironment(
      "https://production-deployment.convex.site",
    );
    const upstreamFetch = vi.spyOn(globalThis, "fetch");

    const response = await worker.fetch(
      new Request("https://interview.drefrajo.dev/api/auth/sign-in/social"),
      environment,
    );

    expect(response.status).toBe(200);
    expect(upstreamFetch).not.toHaveBeenCalled();
    expect(environment.assetFetch).toHaveBeenCalledOnce();
  });

  it("fails closed for an invalid proxy origin", async () => {
    const environment = createEnvironment("https://auth.example.com");

    const response = await worker.fetch(
      new Request(
        "https://interview.drefrajo.dev/api/auth/callback/google?code=test",
      ),
      environment,
    );

    expect(response.status).toBe(500);
    expect(await response.text()).toBe("OAuth proxy configuration is invalid.");
    expect(environment.assetFetch).not.toHaveBeenCalled();
  });
});
