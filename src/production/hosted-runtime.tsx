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
      <main className="page centered" id="main-content">
        <p role="alert">{error}</p>
      </main>
    );
  }
  if (!ready) {
    return (
      <main className="page centered" id="main-content">
        <p role="status">Opening your hosted workspace…</p>
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
      <main className="page centered" id="main-content">
        <p role="status">Checking your secure session…</p>
      </main>
    );
  }
  if (!session.data) {
    return (
      <main className="page centered" id="main-content">
        <section className="panel narrow" aria-labelledby="hosted-sign-in">
          <h1 id="hosted-sign-in">Sign in as Freelancer</h1>
          <p>
            Use Google or GitHub to create the account. You can add independent
            passkeys after signing in.
          </p>
          <div className="actions">
            <button
              className="button primary"
              onClick={() => void authClient.signIn.passkey()}
              type="button"
            >
              Continue with a passkey
            </button>
            <button
              className="button primary"
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
              className="button secondary"
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
    <aside className="panel" aria-label="Account sign-in methods">
      <details>
        <summary>Account and passkeys</summary>
        <p>
          Add at least two passkeys before removing your final OAuth provider.
        </p>
        <div className="actions">
          <button
            className="button secondary"
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
              className="button secondary"
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
        <ul>
          {accounts.map((account) => (
            <li key={account.id}>
              {account.providerId}
              <button
                className="button ghost"
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
            <li key={passkey.id}>
              {passkey.name || "Passkey"}
              <button
                className="button ghost"
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
        <p aria-live="polite">{status}</p>
      </details>
    </aside>
  );
};
