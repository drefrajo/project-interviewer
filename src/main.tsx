import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { createRoutes } from "./app/routes";
import { createLocalApplication } from "./local/local-application";
import "./styles.css";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Application root element is missing.");

const { application, freelancer, materialFileStore } =
  await createLocalApplication();
const router = createBrowserRouter(
  createRoutes(application, freelancer, materialFileStore),
);

createRoot(rootElement).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
