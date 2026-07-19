import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
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
