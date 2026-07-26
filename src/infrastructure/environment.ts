export class EnvironmentConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvironmentConfigurationError";
  }
}

type EnvironmentSource = Readonly<Record<string, string | undefined>>;

const publicRuntimeVariables = [
  "VITE_CONVEX_URL",
  "VITE_CONVEX_SITE_URL",
] as const;

const publicSecretPattern = /^VITE_.*(?:API_KEY|SECRET|TOKEN|DEPLOY_KEY)$/;

const requireValue = (source: EnvironmentSource, key: string): string => {
  const value = source[key]?.trim();
  if (!value) {
    throw new EnvironmentConfigurationError(
      `Missing required environment variable: ${key}`,
    );
  }
  return value;
};

export const readApplicationEnvironment = (source: EnvironmentSource) => {
  const exposedSecret = Object.keys(source).find(
    (key) => publicSecretPattern.test(key) && source[key]?.trim(),
  );
  if (exposedSecret) {
    throw new EnvironmentConfigurationError(
      `${exposedSecret} exposes a secret through the public VITE_ environment prefix.`,
    );
  }

  const viteMode = source.MODE;
  const mode =
    viteMode === "local-development"
      ? ("local" as const)
      : viteMode === "development" || viteMode === "production"
        ? viteMode
        : null;
  if (!mode) {
    throw new EnvironmentConfigurationError(
      "The browser runtime mode must be local-development, development, or production.",
    );
  }

  const missing = publicRuntimeVariables.filter(
    (key) => !source[key]?.trim(),
  );
  if (missing.length > 0) {
    throw new EnvironmentConfigurationError(
      `Missing required browser environment variables: ${missing.join(", ")}`,
    );
  }

  return {
    mode,
    public: {
      convexUrl: requireValue(source, "VITE_CONVEX_URL"),
      convexSiteUrl: requireValue(source, "VITE_CONVEX_SITE_URL"),
    },
  };
};

export const readDeploymentEnvironment = (source: EnvironmentSource) => {
  requireValue(source, "CONVEX_DEPLOY_KEY");
  return { deployKeyPresent: true as const };
};
