export type OAuthProviderId = "google" | "github";

export type OAuthProviderAvailability = Readonly<
  Record<OAuthProviderId, boolean>
>;

type EnvironmentSource = Readonly<Record<string, string | undefined>>;

export class OAuthProviderConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OAuthProviderConfigurationError";
  }
}

const optionalCredentialPair = (
  source: EnvironmentSource,
  provider: "Google" | "GitHub",
  clientIdKey: string,
  clientSecretKey: string,
) => {
  const clientId = source[clientIdKey]?.trim();
  const clientSecret = source[clientSecretKey]?.trim();
  if (Boolean(clientId) !== Boolean(clientSecret)) {
    throw new OAuthProviderConfigurationError(
      `${clientIdKey} and ${clientSecretKey} must be configured together for ${provider}.`,
    );
  }
  return clientId && clientSecret ? { clientId, clientSecret } : null;
};

export const readOAuthProviderConfiguration = (
  source: EnvironmentSource,
) => {
  const google = optionalCredentialPair(
    source,
    "Google",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
  );
  const github = optionalCredentialPair(
    source,
    "GitHub",
    "GITHUB_CLIENT_ID",
    "GITHUB_CLIENT_SECRET",
  );
  if (!google && !github) {
    throw new OAuthProviderConfigurationError(
      "Configure at least one OAuth provider (Google or GitHub) so a Freelancer can bootstrap sign-in.",
    );
  }

  return {
    availability: {
      google: Boolean(google),
      github: Boolean(github),
    } satisfies OAuthProviderAvailability,
    socialProviders: {
      ...(google ? { google } : {}),
      ...(github ? { github } : {}),
    },
  };
};
