import {
  convexClient,
  crossDomainClient,
} from "@convex-dev/better-auth/client/plugins";
import { passkeyClient } from "@better-auth/passkey/client";
import { createAuthClient } from "better-auth/react";

export const createProductionAuthClient = (convexSiteUrl: string) =>
  createAuthClient({
    baseURL: convexSiteUrl,
    plugins: [crossDomainClient(), convexClient(), passkeyClient()],
  });

export type ProductionAuthClient = ReturnType<
  typeof createProductionAuthClient
>;
