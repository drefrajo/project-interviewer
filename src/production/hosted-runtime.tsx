import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { useMemo, type ComponentProps, type ReactNode } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { createRoutes } from "../app/routes";
import {
  createProductionAuthClient,
  type ProductionAuthClient,
} from "../infrastructure/auth-client";

export interface HostedRuntime {
  kind: "hosted";
  convexClient: ConvexReactClient;
  authClient: ProductionAuthClient;
  localDevelopment: boolean;
}

export const createHostedRuntime = (configuration: {
  convexUrl: string;
  convexSiteUrl: string;
  localDevelopment?: boolean;
}): HostedRuntime => ({
  kind: "hosted",
  convexClient: new ConvexReactClient(configuration.convexUrl),
  authClient: createProductionAuthClient(configuration.convexSiteUrl),
  localDevelopment: configuration.localDevelopment ?? false,
});

export const HostedRuntimeBoundary = ({
  runtime,
  children,
}: {
  runtime: HostedRuntime;
  children: ReactNode;
}) => {
  if (runtime.localDevelopment) {
    return <ConvexProvider client={runtime.convexClient}>{children}</ConvexProvider>;
  }
  return (
    <ConvexBetterAuthProvider
      authClient={
        runtime.authClient as unknown as ComponentProps<
          typeof ConvexBetterAuthProvider
        >["authClient"]
      }
      client={runtime.convexClient}
    >
      {children}
    </ConvexBetterAuthProvider>
  );
};

export const HostedApplicationRoot = ({
  runtime,
}: {
  runtime: HostedRuntime;
}) => {
  const router = useMemo(
    () => createBrowserRouter(createRoutes(runtime.authClient, runtime.localDevelopment)),
    [runtime.authClient, runtime.localDevelopment],
  );
  return <RouterProvider router={router} />;
};
