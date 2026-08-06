import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  interviewApi,
  type CreatorProfile,
} from "../../infrastructure/interview-api";
import type { ProductionAuthClient } from "../../infrastructure/auth-client";
import { secondaryButton } from "../shared/form-controls";
import { BrandMark } from "../shared/brand-mark";
import { LegalFooter, privacyPolicyHrefs } from "../shared/legal-footer";
import { ThemeToggle } from "../shared/theme-toggle";
import { creatorCopy } from "./creator-copy";
import {
  type CreatorLanguage,
  creatorLanguageFromCurrentBrowser,
  useSetCreatorLanguage,
  useCreatorLanguage,
} from "./creator-language";

type OAuthProviderId = "google" | "github";
type OAuthPreferenceStorage = Pick<Storage, "getItem" | "setItem">;
const oauthProviders: OAuthProviderId[] = ["github", "google"];

const lastUsedOAuthProviderStorageKey = "interview:last-used-oauth-provider";

const browserStorage = (): OAuthPreferenceStorage | undefined => {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
};

export const readLastUsedOAuthProvider = (
  storage?: OAuthPreferenceStorage,
): OAuthProviderId | undefined => {
  try {
    const value = (storage ?? browserStorage())?.getItem(
      lastUsedOAuthProviderStorageKey,
    );
    return value === "google" || value === "github" ? value : undefined;
  } catch {
    return undefined;
  }
};

export const rememberLastUsedOAuthProvider = (
  provider: OAuthProviderId,
  storage?: OAuthPreferenceStorage,
) => {
  try {
    (storage ?? browserStorage())?.setItem(
      lastUsedOAuthProviderStorageKey,
      provider,
    );
  } catch {
    // Login still works when browser storage is unavailable or disabled.
  }
};

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
  const [lastUsedProvider, setLastUsedProvider] = useState<
    OAuthProviderId | undefined
  >(() => readLastUsedOAuthProvider());
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

  useEffect(() => {
    const provider = profile?.provider;
    if (!provider) return;
    rememberLastUsedOAuthProvider(provider);
    setLastUsedProvider(provider);
  }, [profile?.provider]);

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
              {text.auth.accountCreation}
            </p>
            {error ? (
              <p className="mt-5 rounded-lg border border-error-border bg-error-surface p-4 font-bold text-error-text" role="alert">
                {friendlyAuthError(error, attemptedProvider, language)}
              </p>
            ) : null}
            <div className="mt-7">
              {lastUsedProvider ? (
                <p className="mb-3 flex items-center gap-2 text-xs font-semibold text-muted">
                  <span
                    aria-hidden="true"
                    className="size-1.5 shrink-0 rounded-full bg-action"
                  />
                  {text.auth.lastUsedProvider(
                    lastUsedProvider === "github" ? "GitHub" : "Google",
                  )}
                </p>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                {oauthProviders
                  .filter((provider) => providers?.[provider] !== false)
                  .map((provider) => {
                    const providerName =
                      provider === "github" ? "GitHub" : "Google";
                    return (
                      <button
                        className={secondaryButton}
                        key={provider}
                        onClick={() => void signIn(provider)}
                        type="button"
                      >
                        {text.auth.continueWith} {providerName}
                      </button>
                    );
                  })}
              </div>
            </div>
            <p className="mt-5 text-sm leading-6 text-muted">
              {text.auth.privacyConsentBefore}{" "}
              <a
                className="font-semibold text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
                href={privacyPolicyHrefs[language]}
                rel="noopener noreferrer"
                target="_blank"
              >
                {text.auth.privacyPolicy}
              </a>
              {text.auth.privacyConsentAfter}
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
