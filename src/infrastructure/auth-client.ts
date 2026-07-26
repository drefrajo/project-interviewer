import {
  convexClient,
  crossDomainClient,
} from "@convex-dev/better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const createProductionAuthClient = (convexSiteUrl: string) =>
  createAuthClient({
    baseURL: convexSiteUrl,
    plugins: [crossDomainClient(), convexClient()],
  });

export type ProductionAuthClient = ReturnType<
  typeof createProductionAuthClient
>;
