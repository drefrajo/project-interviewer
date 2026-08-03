import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  interviewApi,
  type CreatorProfile,
} from "../../infrastructure/interview-api";
import type { ProductionAuthClient } from "../../infrastructure/auth-client";
import { primaryButton, secondaryButton } from "../shared/form-controls";
import { BrandMark } from "../shared/brand-mark";
import { LegalFooter } from "../shared/legal-footer";
import { ThemeToggle } from "../shared/theme-toggle";
import { creatorCopy } from "./creator-copy";
import {
  type CreatorLanguage,
  creatorLanguageFromCurrentBrowser,
  useSetCreatorLanguage,
  useCreatorLanguage,
} from "./creator-language";

type OAuthProviderId = "google" | "github";

export const CreatorAuthGate = ({
  authClient,
  children,
}: {
  authClient: ProductionAuthClient;
  children: ReactNode;
}) => {
  const language = useCreatorLanguage();
  const setCreatorLanguage = useSetCreatorLanguage();
  const text = creatorCopy[language];
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

  useEffect(() => {
    if (!session.data) attempted.current = false;
  }, [session.data]);

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
    if (!session.data || profile === undefined || attempted.current) return;
    attempted.current = true;
    const suggestedName =
      session.data.user.name?.trim() ||
      session.data.user.email?.split("@")[0] ||
      "Creator";
    void upsertProfile({
      displayName: suggestedName,
      language: creatorLanguageFromCurrentBrowser(),
    }).catch((cause: unknown) => {
      attempted.current = false;
      setError(cause instanceof Error ? cause.message : String(cause));
    });
  }, [profile, session.data, upsertProfile]);

  useEffect(() => {
    if (!session.data || profile === null) {
      setCreatorLanguage(creatorLanguageFromCurrentBrowser());
    } else if (profile) {
      setCreatorLanguage(profile.language ?? "en");
    }
  }, [profile, session.data, setCreatorLanguage]);

  if (session.isPending || (session.data && profile === undefined)) {
    return (
      <AuthenticationLoading
        label={text.auth.openingWorkspace}
        language={language}
      />
    );
  }
  if (!session.data) {
    return (
      <div className="flex min-h-screen flex-col bg-canvas">
        <main className="grid flex-1 place-items-center px-4" id="main-content">
          <section className="w-full max-w-xl rounded-box border border-line bg-panel p-6 shadow-xl sm:p-9">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <BrandMark />
                <p className="text-xs font-extrabold tracking-[0.14em] text-forest uppercase">
                  {text.auth.workspaceLabel}
                </p>
              </div>
              <ThemeToggle />
            </div>
            <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight">
              {text.auth.signInTitle}
            </h1>
            <p className="mt-4 leading-7 text-muted">
              {text.auth.signInIntro}
            </p>
            {error ? (
              <p className="mt-5 rounded-lg border border-error-border bg-error-surface p-4 font-bold text-error-text" role="alert">
                {friendlyAuthError(error, attemptedProvider, language)}
              </p>
            ) : null}
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              {providers?.google !== false ? (
                <button
                  className={primaryButton}
                  onClick={() => void signIn("google")}
                  type="button"
                >
                  {text.auth.continueWith} Google
                </button>
              ) : null}
              {providers?.github !== false ? (
                <button
                  className={secondaryButton}
                  onClick={() => void signIn("github")}
                  type="button"
                >
                  {text.auth.continueWith} GitHub
                </button>
              ) : null}
            </div>
            <p className="mt-5 text-sm leading-6 text-muted">
              {text.auth.registration}
            </p>
          </section>
        </main>
        <LegalFooter language={language} />
      </div>
    );
  }
  if (profile === null) {
    return (
      <AuthenticationLoading
        label={text.auth.preparingProfile}
        language={language}
      />
    );
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
  language: CreatorLanguage = "en",
) => {
  const normalized = value.toLowerCase().replaceAll(/[^a-z]/g, "");
  if (
    normalized.includes("accountnotlinked") ||
    normalized.includes("unabletolinkaccount") ||
    normalized.includes("oauthlinkerror")
  ) {
    if (attemptedProvider) {
      const provider = attemptedProvider === "google" ? "GitHub" : "Google";
      return creatorCopy[language].auth.linkedAccount(provider);
    }
    return creatorCopy[language].auth.linkedOtherProvider;
  }
  if (/allow|registration/i.test(value)) {
    return creatorCopy[language].auth.notAllowlisted;
  }
  return value;
};

const AuthenticationLoading = ({
  label,
  language,
}: {
  label: string;
  language: CreatorLanguage;
}) => (
  <div className="flex min-h-screen flex-col bg-canvas">
    <main className="grid flex-1 place-items-center" id="main-content">
      <p className="font-bold text-muted" role="status">
        {label}
      </p>
    </main>
    <LegalFooter language={language} />
  </div>
);

export type { CreatorProfile };
