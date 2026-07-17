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

export interface RouteContext {
  application: ProjectInterviewer;
  freelancer: FreelancerActor;
}

export const createRoutes = (
  application: ProjectInterviewer,
  freelancer: FreelancerActor,
): RouteObject[] => {
  const context = { application, freelancer };
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
