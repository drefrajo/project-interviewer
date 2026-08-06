const googleCallbackPath = "/api/auth/callback/google";

type AssetsBinding = {
  fetch: (request: Request) => Promise<Response>;
};

export type WorkerEnvironment = {
  ASSETS: AssetsBinding;
  OAUTH_PROXY_CONVEX_SITE_URL?: string | undefined;
};

const isGoogleCallback = (request: Request) => {
  const url = new URL(request.url);
  return url.pathname === googleCallbackPath;
};

const proxyTarget = (request: Request, convexSiteUrl: string) => {
  let origin: URL;
  try {
    origin = new URL(convexSiteUrl);
  } catch {
    return null;
  }
  if (
    origin.protocol !== "https:" ||
    !origin.hostname.endsWith(".convex.site") ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  ) {
    return null;
  }

  const requestUrl = new URL(request.url);
  return new URL(`${googleCallbackPath}${requestUrl.search}`, origin);
};

const worker = {
  async fetch(request: Request, env: WorkerEnvironment): Promise<Response> {
    const configuredConvexSiteUrl = env.OAUTH_PROXY_CONVEX_SITE_URL?.trim();
    if (configuredConvexSiteUrl && isGoogleCallback(request)) {
      const target = proxyTarget(request, configuredConvexSiteUrl);
      if (!target) {
        return new Response("OAuth proxy configuration is invalid.", {
          status: 500,
        });
      }
      return fetch(new Request(target, request));
    }

    return env.ASSETS.fetch(request);
  },
};

export default worker;
