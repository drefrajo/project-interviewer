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
import type { MaterialUploadStore } from "../application/material-upload-store";

export interface RouteContext {
  application: ProjectInterviewer;
  freelancer: FreelancerActor;
  materialFileStore?: MaterialUploadStore;
}

export const createRoutes = (
  application: ProjectInterviewer,
  freelancer: FreelancerActor,
  materialFileStore?: MaterialUploadStore,
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
      <main
        className="flex min-h-[calc(100vh-4.5rem)] items-center justify-center px-4 py-8 sm:px-8"
        id="main-content"
      >
        <section className="w-full max-w-xl border border-line bg-surface p-6 shadow-[0_1.5rem_4rem_rgb(19_34_29_/_7%)] sm:p-8">
          <h1 className="mb-3 font-display text-3xl leading-tight font-extrabold tracking-tight text-ink sm:text-4xl">
            {t("signInRequired")}
          </h1>
          <p className="mb-0 leading-7 text-muted">{t("clientBoundary")}</p>
        </section>
      </main>
    );
  }
  return children;
};
