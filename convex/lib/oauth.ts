export type OAuthProviderId = "google" | "github";

export const isOAuthProviderId = (
  value: unknown,
): value is OAuthProviderId => value === "google" || value === "github";

export const oauthProviderFromCallbackPath = (
  path: string | null | undefined,
  routeProvider?: unknown,
): OAuthProviderId | null => {
  if (path === "/callback/:id") {
    return isOAuthProviderId(routeProvider) ? routeProvider : null;
  }
  const match = path?.match(/\/callback\/(google|github)\/?$/);
  return isOAuthProviderId(match?.[1]) ? match[1] : null;
};

type EnvironmentSource = Readonly<{
  GOOGLE_CLIENT_ID?: string | undefined;
  GOOGLE_CLIENT_SECRET?: string | undefined;
  GOOGLE_REDIRECT_URI?: string | undefined;
  GITHUB_CLIENT_ID?: string | undefined;
  GITHUB_CLIENT_SECRET?: string | undefined;
  GITHUB_REDIRECT_URI?: string | undefined;
}>;

const readOAuthRedirectUri = (
  source: EnvironmentSource,
  provider: OAuthProviderId,
) => {
  const variableName =
    provider === "google" ? "GOOGLE_REDIRECT_URI" : "GITHUB_REDIRECT_URI";
  const callbackPath = `/api/auth/callback/${provider}`;
  const raw = source[variableName]?.trim();
  if (!raw) return null;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${variableName} must be an absolute HTTPS callback URL.`);
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== callbackPath
  ) {
    throw new Error(
      `${variableName} must be an absolute HTTPS callback URL at ${callbackPath}.`,
    );
  }
  return url.toString();
};

const credentialPair = (
  source: EnvironmentSource,
  provider: "Google" | "GitHub",
  clientIdKey: keyof EnvironmentSource,
  clientSecretKey: keyof EnvironmentSource,
) => {
  const clientId = source[clientIdKey]?.trim();
  const clientSecret = source[clientSecretKey]?.trim();
  if (Boolean(clientId) !== Boolean(clientSecret)) {
    throw new Error(
      `${clientIdKey} and ${clientSecretKey} must be configured together for ${provider}.`,
    );
  }
  return clientId && clientSecret ? { clientId, clientSecret } : null;
};

export const readOAuthConfiguration = (
  source: EnvironmentSource,
  options: { allowEmpty?: boolean } = {},
) => {
  const google = credentialPair(
    source,
    "Google",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
  );
  const github = credentialPair(
    source,
    "GitHub",
    "GITHUB_CLIENT_ID",
    "GITHUB_CLIENT_SECRET",
  );
  if (!google && !github) {
    if (options.allowEmpty) {
      return {
        availability: { google: false, github: false },
        socialProviders: {},
      };
    }
    throw new Error(
      "Configure at least one OAuth provider (Google or GitHub).",
    );
  }
  const googleRedirectUri = readOAuthRedirectUri(source, "google");
  const githubRedirectUri = readOAuthRedirectUri(source, "github");
  return {
    availability: { google: Boolean(google), github: Boolean(github) },
    socialProviders: {
      ...(google
        ? {
            google: {
              ...google,
              ...(googleRedirectUri
                ? { redirectURI: googleRedirectUri }
                : {}),
            },
          }
        : {}),
      ...(github
        ? {
            github: {
              ...github,
              ...(githubRedirectUri
                ? { redirectURI: githubRedirectUri }
                : {}),
            },
          }
        : {}),
    },
  };
};

export const parseCreatorAllowlist = (raw: string | undefined) =>
  new Set(
    (raw ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
