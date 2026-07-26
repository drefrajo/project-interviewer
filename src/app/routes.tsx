import { Navigate, type RouteObject } from "react-router-dom";
import type { ProductionAuthClient } from "../infrastructure/auth-client";
import { ClientInterviewPage } from "./client/client-interview-page";
import { CreatorAuthGate } from "./creator/creator-auth-gate";
import { CreatorShell } from "./creator/creator-shell";
import { InterviewDetailPage } from "./creator/interview-detail-page";
import { InterviewForm } from "./creator/interview-form";
import { InterviewsPage } from "./creator/interviews-page";
import { SettingsPage } from "./creator/settings-page";
import { TemplatesPage } from "./creator/templates-page";

export const createRoutes = (
  authClient: ProductionAuthClient,
): RouteObject[] => [
  {
    path: "/i/:interviewToken",
    element: <ClientInterviewPage />,
  },
  {
    path: "/privacy",
    element: <PrivacyPage />,
  },
  {
    element: (
      <CreatorAuthGate authClient={authClient}>
        <CreatorShell authClient={authClient} />
      </CreatorAuthGate>
    ),
    children: [
      { index: true, element: <Navigate replace to="/interviews" /> },
      { path: "interviews", element: <InterviewsPage /> },
      { path: "interviews/new", element: <InterviewForm /> },
      { path: "interviews/:interviewId", element: <InterviewDetailPage /> },
      { path: "interviews/:interviewId/edit", element: <InterviewForm /> },
      { path: "templates", element: <TemplatesPage /> },
      { path: "settings", element: <SettingsPage /> },
    ],
  },
  { path: "*", element: <Navigate replace to="/interviews" /> },
];

const PrivacyPage = () => (
  <main className="mx-auto max-w-3xl px-4 py-12 sm:px-8" id="main-content">
    <h1 className="font-display text-4xl font-extrabold">AI processing and privacy</h1>
    <div className="mt-6 space-y-4 leading-7 text-muted">
      <p>
        Interview responses are processed through OpenRouter by the model family
        shown before an Interview starts. Requests require zero data retention,
        deny provider data collection, and disable fallback.
      </p>
      <p>
        Responses, the Project Document, Visual Concepts, and the final Project
        Submission are shared with the named Creator. Do not provide sensitive
        personal data.
      </p>
      <p>
        Interview Links are bearer capabilities. Anyone who receives the link can
        access that Interview until the Creator regenerates or deletes it.
      </p>
    </div>
  </main>
);
