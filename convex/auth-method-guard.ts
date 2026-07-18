import type { BetterAuthPlugin } from "better-auth";
import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
} from "better-auth/api";
import { accountMethodPolicy } from "../src/infrastructure/auth-method-policy";

export const authMethodGuard = {
  id: "project-interviewer-auth-method-guard",
  hooks: {
    before: [
      {
        matcher: (context) =>
          context.path === "/unlink-account" ||
          context.path === "/passkey/delete-passkey",
        handler: createAuthMiddleware(async (context) => {
          const session = await getSessionFromCtx(context);
          if (!session) {
            throw new APIError("UNAUTHORIZED");
          }

          const accounts =
            await context.context.internalAdapter.findAccounts(session.user.id);
          const passkeys = await context.context.adapter.findMany<
            Record<string, unknown>
          >({
            model: "passkey",
            where: [{ field: "userId", value: session.user.id }],
          });
          const inventory = {
            oauthProviders: accounts
              .map((account) => account.providerId)
              .filter(
                (provider) => provider === "google" || provider === "github",
              ),
            passkeyIds: passkeys.flatMap((passkey) =>
              typeof passkey.id === "string" ? [passkey.id] : [],
            ),
          };
          const body =
            typeof context.body === "object" && context.body !== null
              ? (context.body as Record<string, unknown>)
              : {};
          const method =
            context.path === "/unlink-account"
              ? {
                  kind: "oauth" as const,
                  id: String(body.providerId ?? ""),
                }
              : {
                  kind: "passkey" as const,
                  id: String(body.id ?? ""),
                };
          const decision = accountMethodPolicy.canRemove(inventory, method);
          if (!decision.allowed) {
            throw new APIError("BAD_REQUEST", {
              code: decision.reason.toUpperCase(),
              message: `Authentication method removal denied: ${decision.reason}`,
            });
          }
        }),
      },
    ],
  },
} satisfies BetterAuthPlugin;
