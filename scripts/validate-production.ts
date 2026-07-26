const requiredPublicVariables = [
  "VITE_CONVEX_URL",
  "VITE_CONVEX_SITE_URL",
] as const;

const exposedSecretPattern =
  /^VITE_.*(?:API_KEY|SECRET|TOKEN|DEPLOY_KEY)$/u;

const requireHttpsUrl = (name: string): URL => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required browser environment variable: ${name}`);
  }

  const url = new URL(value);
  if (url.protocol !== "https:") {
    throw new Error(`${name} must use https in a production build.`);
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(
      `${name} must be an origin URL without credentials, query, or fragment.`,
    );
  }
  return url;
};

try {
  const exposedSecret = Object.keys(process.env).find(
    (name) => exposedSecretPattern.test(name) && process.env[name]?.trim(),
  );
  if (exposedSecret) {
    throw new Error(
      `${exposedSecret} exposes a secret through the public VITE_ prefix.`,
    );
  }

  const [cloudUrl, siteUrl] = requiredPublicVariables.map(requireHttpsUrl);
  if (cloudUrl.hostname === siteUrl.hostname) {
    throw new Error(
      "VITE_CONVEX_URL and VITE_CONVEX_SITE_URL must use their distinct Convex cloud and site hosts.",
    );
  }

  process.stdout.write("Production browser environment is valid.\n");
} catch (error) {
  const message =
    error instanceof Error ? error.message : "Unknown configuration error.";
  process.stderr.write(`Production environment failed: ${message}\n`);
  process.exitCode = 1;
}
