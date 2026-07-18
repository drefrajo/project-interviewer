import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useRoutes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { createRoutes } from "./routes";
import {
  createProjectInterviewer,
  type ProjectInterviewerDependencies,
} from "../domain/project-interviewer";
import {
  localInterviewAgent,
  localInterviewPlanner,
  localInterviewReviewer,
} from "../local/local-interview-adapters";
import type { InterviewAgentDelta } from "../domain/discovery-interview";

const createTestApplication = (
  overrides: Partial<ProjectInterviewerDependencies> = {},
) => {
  let id = 0;
  let token = 0;
  const dependencies: ProjectInterviewerDependencies = {
    ids: {
      next: (prefix) => `${prefix}_${++id}`,
      inviteToken: () => `test-invite-${++token}`,
      deviceId: () => "browser-device",
    },
    clock: { now: () => 1_800_000_000_000 + id },
    inviteTokens: { hash: async (value) => `digest:${value}` },
    interviewPlanner: localInterviewPlanner,
    interviewAgent: localInterviewAgent,
    interviewReviewer: localInterviewReviewer,
    ...overrides,
  };
  return createProjectInterviewer(dependencies);
};

describe("File-First Discovery application shell", () => {
  it("lets a Freelancer create and open a Project Room from the Workspace", async () => {
    const user = userEvent.setup();
    const application = createTestApplication();
    const freelancer =
      await application.identities.createDevelopmentFreelancer({
        displayName: "Ada",
      });
    const routes = createRoutes(application, freelancer);
    const TestRoutes = () => useRoutes(routes);
    render(
      <MemoryRouter initialEntries={["/"]}>
        <TestRoutes />
      </MemoryRouter>,
    );
    await user.click(
      screen.getByRole("button", { name: /create project room/i }),
    );
    await user.type(screen.getByLabelText(/project title/i), "Alpine Portal");
    await user.type(screen.getByLabelText(/client name or label/i), "Alpine");
    await user.type(
      screen.getByLabelText(/project description/i),
      "A portal for client service requests.",
    );
    await user.selectOptions(screen.getByLabelText(/brief language/i), "de");
    await user.click(screen.getByRole("button", { name: /^create room$/i }));

    expect(
      await screen.findByRole("heading", { name: "Alpine Portal" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/test-invite-1/)).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: /project room/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/add project material here/i),
    ).toBeInTheDocument();
  });

  it("shows disclosure onboarding once and returns the Client to Project Home", async () => {
    const user = userEvent.setup();
    const application = createTestApplication();
    const freelancer =
      await application.identities.createDevelopmentFreelancer({
        displayName: "Ada",
      });
    await application.rooms.create(freelancer, {
      title: "Alpine Portal",
      clientLabel: "Alpine",
      projectDescription: "A portal for client service requests.",
      briefLanguage: "en",
      freelancerGuidance: "",
    });
    const routes = createRoutes(application, freelancer);
    const TestRoutes = () => useRoutes(routes);
    const rendered = render(
      <MemoryRouter initialEntries={["/invite/test-invite-1"]}>
        <TestRoutes />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", { name: /before you begin/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/third-party ai providers/i)).toHaveLength(2);
    expect(
      screen.getByText(/masked before ai processing by default/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/alpine portal · ada/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/your display name/i), "Casey");
    await user.selectOptions(
      screen.getByLabelText(/interview language/i),
      "de",
    );
    expect(
      screen.getByRole("heading", { name: /bevor sie beginnen/i }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: /ich verstehe/i }));
    await user.click(
      screen.getByRole("button", { name: /projektraum öffnen/i }),
    );

    expect(
      await screen.findByRole("heading", { name: "Alpine Portal" }),
    ).toBeInTheDocument();
    const overview = screen.getByRole("main");
    expect(
      within(overview).getByText(/willkommen, casey/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/before you begin/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /freelancer workspace/i }),
    ).not.toBeInTheDocument();

    rendered.unmount();
    render(
      <MemoryRouter initialEntries={["/"]}>
        <TestRoutes />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("heading", {
        name: /freelancer-anmeldung erforderlich/i,
      }),
    ).toBeInTheDocument();
  });

  it("shows accepted Project Material immediately and its source-linked analysis when processing finishes", async () => {
    const user = userEvent.setup();
    const bytes = new Map<string, Uint8Array>();
    const application = createProjectInterviewer({
      ids: {
        next: (() => {
          let id = 0;
          return (prefix: string) => `${prefix}_${++id}`;
        })(),
        inviteToken: () => "invite-material",
        deviceId: () => "browser-device",
      },
      clock: { now: () => 1_800_000_000_000 },
      inviteTokens: { hash: async (value) => `digest:${value}` },
      materialFiles: {
        inspect: async (_reference, scope) => ({
          size: scope.claimedSize,
          contentType: scope.declaredContentType,
        }),
        read: async (reference) => bytes.get(reference) ?? new Uint8Array(),
        remove: async (reference) => void bytes.delete(reference),
      },
      contentInspector: {
        detect: async ({ declaredContentType }) => declaredContentType,
      },
      parser: {
        extract: async ({ bytes: content }) => ({
          language: "en",
          method: "plain-text",
          segments: [
            {
              text: new TextDecoder().decode(content),
              locator: {
                kind: "paragraph",
                label: "Paragraph 1",
                paragraph: 1,
              },
            },
          ],
        }),
      },
      fileAnalyzer: {
        analyze: async () => ({
          summary: "A one-page portal brief with an October launch target.",
          summaryLanguage: "en",
          primaryCategory: "brief",
          secondaryCategories: ["timeline"],
          confidence: 0.9,
          language: "en",
          signals: [
            {
              text: "The source states an October launch target.",
              locator: {
                kind: "paragraph",
                label: "Paragraph 1",
                paragraph: 1,
              },
            },
          ],
          model: "test",
          provider: "test",
        }),
      },
      embeddings: {
        embed: async (texts) => texts.map(() => [1, 0]),
      },
    });
    const freelancer =
      await application.identities.createDevelopmentFreelancer({
        displayName: "Ada",
      });
    const { room } = await application.rooms.create(freelancer, {
      title: "Material Room",
      clientLabel: "Alpine",
      projectDescription: "A portal.",
      briefLanguage: "en",
      freelancerGuidance: "",
    });
    const routes = createRoutes(application, freelancer, {
      save: async (file) => {
        const reference = "file-ref";
        bytes.set(reference, new Uint8Array(await file.arrayBuffer()));
        return reference;
      },
      remove: async (reference) => void bytes.delete(reference),
    });
    const TestRoutes = () => useRoutes(routes);
    render(
      <MemoryRouter initialEntries={[`/rooms/${room.id}`]}>
        <TestRoutes />
      </MemoryRouter>,
    );

    await user.upload(
      await screen.findByLabelText(/add project material/i),
      new File(["Portal launch target: October."], "Brief.txt", {
        type: "text/plain",
      }),
    );

    expect(
      await screen.findByText(/one-page portal brief/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Brief.txt" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/paragraph 1/i).length).toBeGreaterThan(0);
  });

  it("runs the one-question Client interview from Project Home", async () => {
    localStorage.setItem("project-interviewer.locale", "en");
    const user = userEvent.setup();
    const application = createTestApplication();
    const freelancer =
      await application.identities.createDevelopmentFreelancer({
        displayName: "Ada",
      });
    const created = await application.rooms.create(freelancer, {
      title: "Interview Room",
      clientLabel: "Alpine",
      projectDescription: "A self-service portal.",
      briefLanguage: "en",
      freelancerGuidance: "",
    });
    await application.materials.continueWithoutFiles(
      freelancer,
      created.room.id,
    );
    const routes = createRoutes(application, freelancer);
    const TestRoutes = () => useRoutes(routes);
    render(
      <MemoryRouter initialEntries={["/invite/test-invite-1"]}>
        <TestRoutes />
      </MemoryRouter>,
    );
    await user.type(
      await screen.findByLabelText(/your display name/i),
      "Casey",
    );
    await user.click(screen.getByRole("checkbox"));
    await user.click(
      screen.getByRole("button", { name: /enter project room/i }),
    );
    await user.click(
      await screen.findByRole("button", {
        name: /start discovery interview/i,
      }),
    );

    expect(
      await screen.findByRole("heading", {
        name: /who will use this product/i,
      }),
    ).toBeInTheDocument();
    await user.type(
      screen.getByLabelText(/your answer/i),
      "Customers should submit service requests without calling support.",
    );
    await user.click(
      screen.getByRole("button", {
        name: /save answer and continue/i,
      }),
    );
    expect(
      await screen.findByRole("heading", {
        name: /what must the first useful release include/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /accepted answers/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /^coverage$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /discovery findings/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/client request:/i)).toBeInTheDocument();
  });

  it("shows the durable accepted answer while the next AI step is still running", async () => {
    localStorage.setItem("project-interviewer.locale", "en");
    let resolveAgent:
      | ((delta: InterviewAgentDelta) => void)
      | undefined;
    const agentStarted = vi.fn();
    const application = createTestApplication({
      interviewAgent: {
        advance: async ({ acceptedTurn }) => {
          agentStarted();
          return new Promise<InterviewAgentDelta>((resolve) => {
            resolveAgent = resolve;
          }).then((delta) => ({
            ...delta,
            coverageUpdates: delta.coverageUpdates.map((update) => ({
              ...update,
              evidence: [
                { type: "turn" as const, turnId: acceptedTurn.id },
              ],
            })),
          }));
        },
      },
    });
    const freelancer =
      await application.identities.createDevelopmentFreelancer({
        displayName: "Ada",
      });
    const created = await application.rooms.create(freelancer, {
      title: "Interview Room",
      clientLabel: "Alpine",
      projectDescription: "A self-service portal.",
      briefLanguage: "en",
      freelancerGuidance: "",
    });
    await application.materials.continueWithoutFiles(
      freelancer,
      created.room.id,
    );
    const routes = createRoutes(application, freelancer);
    const TestRoutes = () => useRoutes(routes);
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/invite/test-invite-1"]}>
        <TestRoutes />
      </MemoryRouter>,
    );
    await user.type(
      await screen.findByLabelText(/your display name/i),
      "Casey",
    );
    await user.click(screen.getByRole("checkbox"));
    await user.click(
      screen.getByRole("button", { name: /enter project room/i }),
    );
    await user.click(
      await screen.findByRole("button", {
        name: /start discovery interview/i,
      }),
    );

    const answer =
      "Customers should submit service requests without calling support.";
    await user.type(screen.getByLabelText(/your answer/i), answer);
    await user.click(
      screen.getByRole("button", {
        name: /save answer and continue/i,
      }),
    );

    await vi.waitFor(() => expect(agentStarted).toHaveBeenCalledOnce());
    expect(await screen.findByText(answer)).toBeInTheDocument();
    expect(
      screen.getByText(/evaluating the accepted answer/i),
    ).toBeInTheDocument();

    resolveAgent?.({
      coverageUpdates: [
        {
          id: "goals-users",
          status: "sufficient",
          evidence: [],
          rationale: "The users and desired outcome are established.",
          openQuestions: [],
        },
      ],
      findings: [],
      unresolvedTopics: [],
      nextQuestion: {
        text: "What must the first useful release include?",
        coverageAreaId: "scope",
        kind: "primary",
        reason: "Scope remains uncovered.",
      },
      completionAssessment: {
        proposeCompletion: false,
        rationale: "Required coverage remains open.",
      },
      model: "agent-fixture",
      provider: "test",
    });
    expect(
      await screen.findByRole("heading", {
        name: /what must the first useful release include/i,
      }),
    ).toBeInTheDocument();
  });
});
