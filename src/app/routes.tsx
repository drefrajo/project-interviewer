import { Navigate, type RouteObject } from "react-router-dom";
import type { ReactNode } from "react";
import type {
  FreelancerActor,
  ProjectInterviewer,
} from "../domain/project-interviewer";
import { ApplicationShell } from "./application-shell";
import { ClientEntry, FreelancerProjectRoom } from "./project-room";
import { Workspace } from "./workspace";
import { useI18n } from "./i18n";
import type { LocalMaterialFileStore } from "../local/local-material-adapters";

export interface RouteContext {
  application: ProjectInterviewer;
  freelancer: FreelancerActor;
  materialFileStore?: Pick<LocalMaterialFileStore, "save" | "remove">;
}

export const createRoutes = (
  application: ProjectInterviewer,
  freelancer: FreelancerActor,
  materialFileStore?: Pick<LocalMaterialFileStore, "save" | "remove">,
): RouteObject[] => {
  const context: RouteContext = {
    application,
    freelancer,
    ...(materialFileStore ? { materialFileStore } : {}),
  };
  return [
    {
      element: <ApplicationShell />,
      children: [
        {
          index: true,
          element: (
            <FreelancerBoundary>
              <Workspace {...context} />
            </FreelancerBoundary>
          ),
        },
        {
          path: "rooms/:roomId",
          element: (
            <FreelancerBoundary>
              <FreelancerProjectRoom {...context} />
            </FreelancerBoundary>
          ),
        },
        { path: "invite/:inviteToken", element: <ClientEntry {...context} /> },
        { path: "*", element: <Navigate replace to="/" /> },
      ],
    },
  ];
};

const FreelancerBoundary = ({ children }: { children: ReactNode }) => {
  const { t } = useI18n();
  if (sessionStorage.getItem("project-interviewer.actor-mode") === "client") {
    return (
      <main className="page centered" id="main-content">
        <section className="panel narrow">
          <h1>{t("signInRequired")}</h1>
          <p>{t("clientBoundary")}</p>
        </section>
      </main>
    );
  }
  return children;
};
