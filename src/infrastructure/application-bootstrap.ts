type PublicHostedEnvironment = Readonly<{
  convexUrl: string;
  convexSiteUrl: string;
  siteUrl: string;
}>;

type ApplicationEnvironment =
  | Readonly<{ mode: "local" }>
  | Readonly<{
      mode: "production";
      public: PublicHostedEnvironment;
    }>;

export const bootstrapApplication = async <Local, Hosted>(
  environment: ApplicationEnvironment,
  factories: Readonly<{
    local: () => Promise<Local>;
    hosted: (configuration: PublicHostedEnvironment) => Hosted;
  }>,
): Promise<Local | Hosted> =>
  environment.mode === "production"
    ? factories.hosted(environment.public)
    : factories.local();
