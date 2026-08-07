type EnvironmentSource = Readonly<Record<string, string | undefined>>;

const localHosts = new Set(["127.0.0.1", "localhost", "[::1]"]);

export const isLocalDevelopmentAuthBypassEnabled = (
  source: EnvironmentSource = process.env,
) => {
  if (source.LOCAL_DEV_AUTH_BYPASS?.trim().toLowerCase() !== "true") {
    return false;
  }

  const convexSiteUrl = source.CONVEX_SITE_URL?.trim();
  if (!convexSiteUrl) return false;

  try {
    const url = new URL(convexSiteUrl);
    return url.protocol === "http:" && localHosts.has(url.hostname);
  } catch {
    return false;
  }
};
