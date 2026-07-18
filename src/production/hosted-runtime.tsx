import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { ConvexReactClient } from "convex/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { createRoutes } from "../app/routes";
import {
  createProductionAuthClient,
  type ProductionAuthClient,
} from "../infrastructure/auth-client";
import { accountMethodPolicy } from "../infrastructure/auth-method-policy";
import { createHostedApplicationBundle } from "./hosted-upload";

export interface HostedRuntime {
  kind: "hosted";
  convexClient: ConvexReactClient;
  authClient: ProductionAuthClient;
}

const centeredPage =
  "flex min-h-[calc(100vh-4.5rem)] items-center justify-center px-4 py-8 sm:px-8";
const primaryButton =
  "inline-flex min-h-11 items-center justify-center rounded-md bg-forest px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#0f3d2f] disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButton =
  "inline-flex min-h-11 items-center justify-center rounded-md border border-line bg-transparent px-4 py-2 text-sm font-bold text-ink transition-colors hover:bg-[#f5f6f0] disabled:cursor-not-allowed disabled:opacity-60";
const ghostButton =
  "inline-flex min-h-9 items-center justify-center rounded-md px-3 py-1.5 text-sm font-bold text-forest transition-colors hover:bg-[#e3ede8] disabled:cursor-not-allowed disabled:opacity-60";

export const createHostedRuntime = (configuration: {
  convexUrl: string;
  convexSiteUrl: string;
}): HostedRuntime => ({
  kind: "hosted",
  convexClient: new ConvexReactClient(configuration.convexUrl),
  authClient: createProductionAuthClient(configuration.convexSiteUrl),
});

export const HostedRuntimeBoundary = ({
  runtime,
  children,
}: {
  runtime: HostedRuntime;
  children: ReactNode;
}) => (
  <ConvexBetterAuthProvider
    client={runtime.convexClient}
    authClient={
      runtime.authClient as unknown as ComponentProps<
        typeof ConvexBetterAuthProvider
      >["authClient"]
    }
  >
    <HostedAuthenticationGate authClient={runtime.authClient}>
      {children}
    </HostedAuthenticationGate>
  </ConvexBetterAuthProvider>
);

export const HostedApplicationRoot = ({
  runtime,
}: {
  runtime: HostedRuntime;
}) => {
  const session = runtime.authClient.useSession();
  const hosted = useMemo(
    () =>
      createHostedApplicationBundle(
        runtime.convexClient as unknown as Parameters<
          typeof createHostedApplicationBundle
        >[0],
      ),
    [runtime.convexClient],
  );
  const { application, materialFileStore } = hosted;
  const [ready, setReady] = useState(
    window.location.pathname.startsWith("/invite/"),
  );
  const [error, setError] = useState("");
  const freelancer = useMemo(
    () => ({
      kind: "freelancer" as const,
      freelancerId: "authenticated",
      sessionId: "better-auth",
    }),
    [],
  );

  useEffect(() => {
    if (window.location.pathname.startsWith("/invite/")) return;
    const displayName =
      session.data?.user?.name?.trim() ||
      session.data?.user?.email?.split("@")[0] ||
      "Freelancer";
    void application.identities
      .establishFreelancer({ displayName })
      .then(() => setReady(true))
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : String(cause)),
      );
  }, [application, session.data?.user?.email, session.data?.user?.name]);

  const router = useMemo(
    () =>
      createBrowserRouter(
        createRoutes(application, freelancer, materialFileStore),
      ),
    [application, freelancer, materialFileStore],
  );
  if (error) {
    return (
      <main className={centeredPage} id="main-content">
        <p className="w-full max-w-xl border-l-4 border-coral bg-[#fff1e7] p-4 font-bold text-[#852f21]" role="alert">
          {error}
        </p>
      </main>
    );
  }
  if (!ready) {
    return (
      <main className={centeredPage} id="main-content">
        <p className="font-semibold text-muted" role="status">
          Opening your hosted workspace…
        </p>
      </main>
    );
  }
  return <RouterProvider router={router} />;
};

const HostedAuthenticationGate = ({
  authClient,
  children,
}: {
  authClient: ProductionAuthClient;
  children: ReactNode;
}) => {
  const session = authClient.useSession();
  const inviteRoute = window.location.pathname.startsWith("/invite/");
  if (inviteRoute) return children;
  if (session.isPending) {
    return (
      <main className={centeredPage} id="main-content">
        <p className="font-semibold text-muted" role="status">
          Checking your secure session…
        </p>
      </main>
    );
  }
  if (!session.data) {
    return (
      <main className={centeredPage} id="main-content">
        <section
          aria-labelledby="hosted-sign-in"
          className="w-full max-w-xl border border-line bg-surface p-6 shadow-[0_1.5rem_4rem_rgb(19_34_29_/_7%)] sm:p-8"
        >
          <p className="mb-2 text-xs font-extrabold tracking-[0.14em] text-forest uppercase">
            Hosted workspace
          </p>
          <h1
            className="mb-3 font-display text-3xl leading-tight font-extrabold tracking-tight text-ink sm:text-4xl"
            id="hosted-sign-in"
          >
            Sign in as Freelancer
          </h1>
          <p className="mb-6 leading-7 text-muted">
            Use Google or GitHub to create the account. You can add independent
            passkeys after signing in.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              className={primaryButton}
              onClick={() => void authClient.signIn.passkey()}
              type="button"
            >
              Continue with a passkey
            </button>
            <button
              className={primaryButton}
              onClick={() =>
                void authClient.signIn.social({
                  provider: "google",
                  callbackURL: window.location.href,
                })
              }
              type="button"
            >
              Continue with Google
            </button>
            <button
              className={secondaryButton}
              onClick={() =>
                void authClient.signIn.social({
                  provider: "github",
                  callbackURL: window.location.href,
                })
              }
              type="button"
            >
              Continue with GitHub
            </button>
          </div>
        </section>
      </main>
    );
  }
  return (
    <>
      <HostedAccountMethods authClient={authClient} />
      {children}
    </>
  );
};

type AccountMethod = { id: string; providerId: string };
type PasskeyMethod = { id: string; name?: string | null };

const HostedAccountMethods = ({
  authClient,
}: {
  authClient: ProductionAuthClient;
}) => {
  const [accounts, setAccounts] = useState<AccountMethod[]>([]);
  const [passkeys, setPasskeys] = useState<PasskeyMethod[]>([]);
  const [status, setStatus] = useState("");
  const refresh = useCallback(async () => {
    const [accountResult, passkeyResult] = await Promise.all([
      authClient.listAccounts(),
      authClient.passkey.listUserPasskeys(),
    ]);
    setAccounts(
      (accountResult.data ?? []).flatMap((account) =>
        account.providerId === "google" || account.providerId === "github"
          ? [{ id: account.id, providerId: account.providerId }]
          : [],
      ),
    );
    setPasskeys(
      (passkeyResult.data ?? []).map((passkey) => ({
        id: passkey.id,
        name: passkey.name ?? null,
      })),
    );
  }, [authClient]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const remove = async (
    method:
      | { kind: "oauth"; id: string; accountId: string }
      | { kind: "passkey"; id: string },
  ) => {
    const decision = accountMethodPolicy.canRemove(
      {
        oauthProviders: accounts.map(({ providerId }) => providerId),
        passkeyIds: passkeys.map(({ id }) => id),
      },
      { kind: method.kind, id: method.id },
    );
    if (!decision.allowed) {
      setStatus(`Cannot remove this method: ${decision.reason}.`);
      return;
    }
    if (method.kind === "oauth") {
      await authClient.unlinkAccount({
        providerId: method.id,
        accountId: method.accountId,
      });
    } else {
      await authClient.passkey.deletePasskey({ id: method.id });
    }
    setStatus("Authentication method removed.");
    await refresh();
  };

  return (
    <aside
      aria-label="Account sign-in methods"
      className="border-b border-line bg-surface px-4 py-3 sm:px-8 lg:px-16"
    >
      <details className="mx-auto max-w-7xl">
        <summary className="cursor-pointer font-bold text-ink">
          Account and passkeys
        </summary>
        <p className="mt-3 text-sm leading-6 text-muted">
          Add at least two passkeys before removing your final OAuth provider.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            className={secondaryButton}
            onClick={async () => {
              const result = await authClient.passkey.addPasskey({
                name: "Project Interviewer passkey",
              });
              setStatus(
                result.error
                  ? result.error.message ?? "Passkey registration failed."
                  : "Passkey registered.",
              );
              await refresh();
            }}
            type="button"
          >
            Add passkey
          </button>
          {(["google", "github"] as const).map((provider) => (
            <button
              className={secondaryButton}
              key={provider}
              onClick={() =>
                void authClient.linkSocial({
                  provider,
                  callbackURL: window.location.href,
                })
              }
              type="button"
            >
              Link {provider === "google" ? "Google" : "GitHub"}
            </button>
          ))}
        </div>
        <ul className="mt-4 grid gap-2">
          {accounts.map((account) => (
            <li
              className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3 text-sm text-ink"
              key={account.id}
            >
              <span>{account.providerId}</span>
              <button
                className={ghostButton}
                onClick={() =>
                  void remove({
                    kind: "oauth",
                    id: account.providerId,
                    accountId: account.id,
                  })
                }
                type="button"
              >
                Remove
              </button>
            </li>
          ))}
          {passkeys.map((passkey) => (
            <li
              className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3 text-sm text-ink"
              key={passkey.id}
            >
              <span>{passkey.name || "Passkey"}</span>
              <button
                className={ghostButton}
                onClick={() =>
                  void remove({ kind: "passkey", id: passkey.id })
                }
                type="button"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        {status ? (
          <p aria-live="polite" className="mt-3 text-sm font-semibold text-forest">
            {status}
          </p>
        ) : null}
      </details>
    </aside>
  );
};
