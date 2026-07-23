import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ClientActor,
  ProjectInterviewer,
  ProjectRoomView,
} from "../domain/project-interviewer";
import type { ProjectMaterialView } from "../domain/project-material";
import { I18nProvider } from "./i18n";
import { ProjectMaterialPanel } from "./project-material-panel";

const room = {
  id: "room-1",
  phase: "setup",
  interviewReadiness: "waiting_for_material",
} as ProjectRoomView;

const material: ProjectMaterialView = {
  id: "material-1",
  roomId: "room-1",
  name: "Client brief.txt",
  size: 12,
  declaredContentType: "text/plain",
  uploaderKind: "client",
  state: "accepted",
  stage: "checking_file",
  active: true,
  retryAvailable: false,
  analysisVersions: [],
  canRemove: true,
  createdAt: 1,
  updatedAt: 1,
};

describe("Project Material panel", () => {
  it("refreshes material added by another party while the panel is open", async () => {
    const list = vi
      .fn<() => Promise<ProjectMaterialView[]>>()
      .mockResolvedValueOnce([])
      .mockResolvedValue([material]);
    const application = {
      materials: { list },
      contextPacks: { latest: vi.fn().mockResolvedValue(null) },
    } as unknown as ProjectInterviewer;

    render(
      <I18nProvider>
        <ProjectMaterialPanel
          actor={{
            kind: "freelancer",
            freelancerId: "freelancer-1",
            sessionId: "session-1",
          }}
          application={application}
          readOnly={false}
          room={room}
        />
      </I18nProvider>,
    );

    await waitFor(
      () =>
        expect(
          screen.getByRole("heading", { name: "Client brief.txt" }),
        ).toBeInTheDocument(),
      { timeout: 2_500 },
    );
    expect(list).toHaveBeenCalledTimes(2);
  });
});

describe("Project Material panel client guidance", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("project-interviewer.locale", "en");
  });

  const client: ClientActor = {
    kind: "client",
    roomId: "room-1",
    deviceId: "device-1",
    inviteVersion: 1,
    sessionId: "client-session",
  };

  const analyzed: ProjectMaterialView = {
    ...material,
    state: "analyzed",
    stage: "complete",
    analysis: {
      id: "analysis-1",
      version: 1,
      summary: "A short portal brief.",
      summaryLanguage: "en",
      summarySources: [{ kind: "paragraph", label: "Paragraph 1" }],
      primaryCategory: "brief",
      secondaryCategories: [],
      confidence: 0.9,
      language: "en",
      signals: [],
      model: "fixture",
      provider: "test",
      processingVersion: "material-processing-v1",
      schemaVersion: "file-analysis-v1",
      promptVersion: "software-project-file-analysis-v1",
      extractionMethod: "text",
      analyzedAt: 2,
    },
  };

  const applicationFor = (addFeedback = vi.fn()) =>
    ({
      materials: {
        list: vi.fn(async () => [analyzed]),
        addFeedback,
      },
      contextPacks: { latest: vi.fn(async () => null) },
    }) as unknown as ProjectInterviewer;

  it("points the client to the interview once files are ready", async () => {
    const user = userEvent.setup();
    const onContinueToInterview = vi.fn();
    render(
      <I18nProvider>
        <ProjectMaterialPanel
          actor={client}
          application={applicationFor()}
          onContinueToInterview={onContinueToInterview}
          readOnly={false}
          room={
            {
              ...room,
              phase: "setup",
              interviewReadiness: "ready",
            } as ProjectRoomView
          }
        />
      </I18nProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: /your files are ready/i }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: /continue to the interview/i }),
    );
    expect(onContinueToInterview).toHaveBeenCalledOnce();
  });

  it("sends one general feedback for the whole document", async () => {
    const user = userEvent.setup();
    const addFeedback = vi.fn(async () => ({}));
    render(
      <I18nProvider>
        <ProjectMaterialPanel
          actor={client}
          application={applicationFor(addFeedback)}
          readOnly={false}
          room={room}
        />
      </I18nProvider>,
    );

    const input = await screen.findByLabelText(
      /something wrong or missing/i,
    );
    expect(
      screen.queryByLabelText(/affected source/i),
    ).not.toBeInTheDocument();
    await user.type(input, "The summary misses the mobile app.");
    await user.click(
      screen.getByRole("button", { name: /send feedback/i }),
    );

    expect(addFeedback).toHaveBeenCalledWith(client, "room-1", "material-1", {
      explanation: "The summary misses the mobile app.",
    });
  });
});
