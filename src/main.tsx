import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { createRoutes } from "./app/routes";
import { bootstrapApplication } from "./infrastructure/application-bootstrap";
import { readApplicationEnvironment } from "./infrastructure/environment";
import {
  HostedApplicationRoot,
  createHostedRuntime,
  HostedRuntimeBoundary,
} from "./production/hosted-runtime";
import "./styles.css";

const rootElement = document.getElementById("root");
const environment = readApplicationEnvironment(import.meta.env);
const runtime = await bootstrapApplication(environment, {
  local: async () => {
    const { createLocalApplication } = await import(
      "./local/local-application"
    );
    return {
      kind: "local" as const,
      ...(await createLocalApplication()),
    };
  },
  hosted: createHostedRuntime,
});

if (!rootElement) throw new Error("Application root element is missing.");

const applicationView =
  runtime.kind === "local" ? (
    <RouterProvider
      router={createBrowserRouter(
        createRoutes(
          runtime.application,
          runtime.freelancer,
          runtime.materialFileStore,
        ),
      )}
    />
  ) : (
    <HostedRuntimeBoundary runtime={runtime}>
      <HostedApplicationRoot runtime={runtime} />
    </HostedRuntimeBoundary>
  );

createRoot(rootElement).render(
  <StrictMode>
    {applicationView}
  </StrictMode>,
);
