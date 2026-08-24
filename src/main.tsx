import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { installAnalytics } from "./infrastructure/analytics";
import {
  isLocalConvexSiteUrl,
  readApplicationEnvironment,
} from "./infrastructure/environment";
import {
  HostedApplicationRoot,
  createHostedRuntime,
  HostedRuntimeBoundary,
} from "./production/hosted-runtime";
import { initializeTheme } from "./app/shared/theme";
import "./styles.css";

const rootElement = document.getElementById("root");
const environment = readApplicationEnvironment(import.meta.env);
installAnalytics(environment.mode);
const runtime = createHostedRuntime({
  ...environment.public,
  deploymentMode: environment.mode,
  localDevelopment:
    environment.mode === "local" &&
    isLocalConvexSiteUrl(environment.public.convexSiteUrl),
});

if (!rootElement) throw new Error("Application root element is missing.");

initializeTheme();

const applicationView = (
  <HostedRuntimeBoundary runtime={runtime}>
    <HostedApplicationRoot runtime={runtime} />
  </HostedRuntimeBoundary>
);

createRoot(rootElement).render(
  <StrictMode>
    {applicationView}
  </StrictMode>,
);
