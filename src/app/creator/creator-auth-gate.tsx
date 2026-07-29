import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  interviewApi,
  type CreatorProfile,
} from "../../infrastructure/interview-api";
import type { ProductionAuthClient } from "../../infrastructure/auth-client";
import { primaryButton, secondaryButton } from "../shared/form-controls";
import { LegalFooter } from "../shared/legal-footer";
import { ThemeToggle } from "../shared/theme-toggle";

type OAuthProviderId = "google" | "github";

export const CreatorAuthGate = ({
  authClient,
  children,
}: {
  authClient: ProductionAuthClient;
  children: ReactNode;
}) => {
  const session = authClient.useSession();
  const providers = useQuery(
    interviewApi.auth.getProviderAvailability,
    session.data ? "skip" : {},
  );
  const profile = useQuery(
    interviewApi.creator_profiles.getCurrent,
    session.data ? {} : "skip",
  );
  const upsertProfile = useMutation(
    interviewApi.creator_profiles.upsertCurrent,
  );
  const attempted = useRef(false);
  const [error, setError] = useState(
    new URLSearchParams(window.location.search).get("error") ?? "",
  );
  const attemptedProvider = oauthProviderFromSearch(window.location.search);

  const signIn = (provider: OAuthProviderId) => {
    const callbackURL = new URL(window.location.href);
    callbackURL.searchParams.delete("auth_provider");
    callbackURL.searchParams.delete("error");
    callbackURL.searchParams.delete("error_description");
    const errorCallbackURL = new URL(callbackURL);
    errorCallbackURL.searchParams.set("auth_provider", provider);
    return authClient.signIn.social({
      provider,
      callbackURL: callbackURL.toString(),
      errorCallbackURL: errorCallbackURL.toString(),
    });
  };

  useEffect(() => {
    if (!session.data || profile !== null || attempted.current) return;
    attempted.current = true;
    const suggestedName =
      session.data.user.name?.trim() ||
      session.data.user.email?.split("@")[0] ||
      "Creator";
    void upsertProfile({ displayName: suggestedName }).catch((cause: unknown) => {
      attempted.current = false;
      setError(cause instanceof Error ? cause.message : String(cause));
    });
  }, [profile, session.data, upsertProfile]);

  if (session.isPending || (session.data && profile === undefined)) {
    return <AuthenticationLoading label="Opening your Creator workspace…" />;
  }
  if (!session.data) {
    return (
      <div className="flex min-h-screen flex-col bg-canvas">
        <main className="grid flex-1 place-items-center px-4" id="main-content">
          <section className="w-full max-w-xl rounded-2xl border border-line bg-surface p-6 shadow-xl sm:p-9">
            <div className="flex items-center justify-between gap-4">
              <p className="text-xs font-extrabold tracking-[0.14em] text-forest uppercase">
                Creator workspace
              </p>
              <ThemeToggle />
            </div>
            <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight">
              Sign in to Project Interviewer
            </h1>
            <p className="mt-4 leading-7 text-muted">
              Use the provider that owns your account. Google and GitHub identities
              are never silently linked, even when they share an email address.
            </p>
            {error ? (
              <p className="mt-5 rounded-lg border border-error-border bg-error-surface p-4 font-bold text-error-text" role="alert">
                {friendlyAuthError(error, attemptedProvider)}
              </p>
            ) : null}
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              {providers?.google !== false ? (
                <button
                  className={primaryButton}
                  onClick={() => void signIn("google")}
                  type="button"
                >
                  Continue with Google
                </button>
              ) : null}
              {providers?.github !== false ? (
                <button
                  className={secondaryButton}
                  onClick={() => void signIn("github")}
                  type="button"
                >
                  Continue with GitHub
                </button>
              ) : null}
            </div>
            <p className="mt-5 text-sm leading-6 text-muted">
              Registration is restricted to the deployment allowlist.
            </p>
          </section>
        </main>
        <LegalFooter />
      </div>
    );
  }
  if (profile === null) {
    return <AuthenticationLoading label="Preparing your Creator profile…" />;
  }
  return children;
};

const oauthProviderFromSearch = (
  search: string,
): OAuthProviderId | undefined => {
  const provider = new URLSearchParams(search).get("auth_provider");
  return provider === "google" || provider === "github" ? provider : undefined;
};

export const friendlyAuthError = (
  value: string,
  attemptedProvider?: OAuthProviderId,
) => {
  const normalized = value.toLowerCase().replaceAll(/[^a-z]/g, "");
  if (
    normalized.includes("accountnotlinked") ||
    normalized.includes("unabletolinkaccount") ||
    normalized.includes("oauthlinkerror")
  ) {
    if (attemptedProvider) {
      const provider = attemptedProvider === "google" ? "GitHub" : "Google";
      return `This email already belongs to an account created with ${provider}. Continue with ${provider}.`;
    }
    return "This email already belongs to an account created with the other sign-in provider. Continue with the provider you used first.";
  }
  if (/allow|registration/i.test(value)) {
    return "This identity is not on the private-launch registration allowlist.";
  }
  return value;
};

const AuthenticationLoading = ({ label }: { label: string }) => (
  <div className="flex min-h-screen flex-col bg-canvas">
    <main className="grid flex-1 place-items-center" id="main-content">
      <p className="font-bold text-muted" role="status">
        {label}
      </p>
    </main>
    <LegalFooter />
  </div>
);

export type { CreatorProfile };
