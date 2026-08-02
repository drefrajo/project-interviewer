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
import {
  BillingCancelPage,
  BillingPage,
  BillingSuccessPage,
} from "./creator/billing-page";

export const createRoutes = (
  authClient: ProductionAuthClient,
): RouteObject[] => [
  {
    path: "/i/:interviewToken",
    element: <ClientInterviewPage />,
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
      { path: "billing", element: <BillingPage /> },
      { path: "billing/success", element: <BillingSuccessPage /> },
      { path: "billing/cancel", element: <BillingCancelPage /> },
    ],
  },
  { path: "*", element: <Navigate replace to="/interviews" /> },
];
