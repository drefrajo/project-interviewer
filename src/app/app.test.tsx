import {
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
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
import { localBriefGenerator } from "../local/local-brief-adapter";

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
    briefGenerator: localBriefGenerator,
    ...overrides,
  };
  return createProjectInterviewer(dependencies);
};

describe("File-First Discovery application shell", () => {
  it("lets a Freelancer create and open a Project Room from the Workspace", async () => {
    const user = userEvent.setup();
    const application = createTestApplication();
    const freelancer =
      await application.identities.establishFreelancer({
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

    await user.click(
      screen.getByRole("button", { name: /rotate invite link/i }),
    );
    expect(screen.getByText(/test-invite-2/)).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: /revoke invite link/i }),
    );
    expect(screen.getByText(/invite link revoked/i)).toBeInTheDocument();
  });

  it("shows disclosure onboarding once and returns the Client to Project Home", async () => {
    const user = userEvent.setup();
    const application = createTestApplication();
    const freelancer =
      await application.identities.establishFreelancer({
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
      await application.identities.establishFreelancer({
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
      await application.identities.establishFreelancer({
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
      await application.identities.establishFreelancer({
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

  it("lets the Freelancer generate, inspect, clear warnings, and send a traceable Brief", async () => {
    localStorage.setItem("project-interviewer.locale", "en");
    const application = createTestApplication();
    const freelancer =
      await application.identities.establishFreelancer({
        displayName: "Ada",
      });
    const created = await application.rooms.create(freelancer, {
      title: "Brief Room",
      clientLabel: "Alpine",
      projectDescription: "A self-service portal.",
      briefLanguage: "en",
      freelancerGuidance: "",
    });
    await application.materials.continueWithoutFiles(
      freelancer,
      created.room.id,
    );
    const access = await application.clientAccess.resolveInvite(
      created.inviteToken,
      { deviceId: "client-device" },
    );
    await application.clientAccess.onboard(access.actor, {
      displayName: "Chris",
      interviewLanguage: "en",
      acknowledgedDisclosure: true,
    });
    const started = await application.interviews.start(
      access.actor,
      created.room.id,
    );
    const contextPack = await application.contextPacks.latest(
      access.actor,
      created.room.id,
    );
    await application.interviews.submitAnswer(
      access.actor,
      created.room.id,
      {
        questionId: started.currentQuestion!.id,
        answer: "The product must support single sign-on.",
        idempotencyKey: "brief-ui-answer",
        contextPackRevisionId: contextPack?.id ?? null,
      },
    );
    await application.interviews.finishEarly(
      access.actor,
      created.room.id,
      { confirmed: true },
    );

    const routes = createRoutes(application, freelancer);
    const TestRoutes = () => useRoutes(routes);
    const user = userEvent.setup();
    const rendered = render(
      <MemoryRouter initialEntries={[`/rooms/${created.room.id}`]}>
        <TestRoutes />
      </MemoryRouter>,
    );

    await user.click(
      await screen.findByRole("button", {
        name: /generate project brief/i,
      }),
    );
    expect(
      await screen.findByRole("heading", { name: /brief draft/i }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /interview turn/i })[0],
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "DE" }));
    expect(
      screen.getByRole("option", { name: "Anforderung" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByLabelText(/punkt bearbeiten/i)[0],
    ).toBeInTheDocument();
    expect(screen.queryByText("functional-requirements")).toBeNull();
    await user.click(screen.getByRole("button", { name: "EN" }));
    const summaryEditor = screen.getByLabelText(
      /content for executive summary/i,
    );
    await user.clear(summaryEditor);
    await user.click(
      within(summaryEditor.closest("section")!).getByRole("button", {
        name: /^save$/i,
      }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /section content is required/i,
    );
    const addInput = screen.getByLabelText(
      /add freelancer-authored requirement/i,
    );
    await user.type(addInput, "A single rapid-submit requirement.");
    const addForm = addInput.closest("form")!;
    fireEvent.submit(addForm);
    fireEvent.submit(addForm);
    await vi.waitFor(async () => {
      const brief = await application.briefs.get(
        freelancer,
        created.room.id,
      );
      expect(
        brief.draft!.sections
          .flatMap(({ items }) => items)
          .filter(
            ({ text }) =>
              text === "A single rapid-submit requirement.",
          ),
      ).toHaveLength(1);
      expect(addInput).toHaveValue("");
    });
    const dirtyItem = screen.getAllByLabelText(/edit item/i)[0]!;
    await user.clear(dirtyItem);
    await user.type(dirtyItem, "Unsaved sibling item text.");
    await user.click(
      screen.getAllByRole("button", {
        name: /acknowledge open warning/i,
      })[0]!,
    );
    expect(dirtyItem).toHaveValue("Unsaved sibling item text.");
    for (const button of screen.queryAllByRole("button", {
      name: /acknowledge open warning/i,
    })) {
      await user.click(button);
    }
    await user.click(
      screen.getByRole("button", { name: /send for client review/i }),
    );
    expect(
      await screen.findByRole("heading", {
        name: /review version 1/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/^Proposed$/i)[0]).toBeInTheDocument();

    rendered.unmount();
    localStorage.setItem(
      "project-interviewer.device-id",
      "client-device",
    );
    render(
      <MemoryRouter initialEntries={["/invite/test-invite-1"]}>
        <TestRoutes />
      </MemoryRouter>,
    );
    expect(
      await screen.findByRole("heading", {
        name: /review version 1/i,
      }),
    ).toBeInTheDocument();
    await user.click(
      screen.getAllByRole("button", { name: /interview turn/i })[0]!,
    );
    expect(
      (await screen.findAllByText(/what should become better/i))
        .length,
    ).toBeGreaterThan(0);
    await user.type(
      screen.getByLabelText(/^change request$/i),
      "Clarify who administers SSO.",
    );
    await user.click(
      screen.getByRole("button", { name: /save change request/i }),
    );
    await vi.waitFor(async () =>
      expect(
        (
          await application.briefs.get(
            access.actor,
            created.room.id,
          )
        ).activeChangeRequest,
      ).toMatchObject({
        revisions: [
          expect.objectContaining({
            text: "Clarify who administers SSO.",
          }),
        ],
      }),
    );
  });

  it("lets the Freelancer publish Shared Resources that the Client sees in the phase-aware Project Home", async () => {
    localStorage.setItem("project-interviewer.locale", "en");
    const application = createTestApplication();
    const freelancer =
      await application.identities.establishFreelancer({
        displayName: "Ada",
      });
    const created = await application.rooms.create(freelancer, {
      title: "Resource Room",
      clientLabel: "Alpine",
      projectDescription: "A client portal.",
      briefLanguage: "en",
      freelancerGuidance: "",
    });
    const access = await application.clientAccess.resolveInvite(
      created.inviteToken,
      { deviceId: "client-device" },
    );
    await application.clientAccess.onboard(access.actor, {
      displayName: "Casey",
      interviewLanguage: "en",
      acknowledgedDisclosure: true,
    });
    const routes = createRoutes(application, freelancer);
    const TestRoutes = () => useRoutes(routes);
    const user = userEvent.setup();
    const rendered = render(
      <MemoryRouter initialEntries={[`/rooms/${created.room.id}`]}>
        <TestRoutes />
      </MemoryRouter>,
    );

    await user.type(
      await screen.findByLabelText(/resource label/i),
      "Staging application",
    );
    await user.type(
      screen.getByLabelText(/resource url/i),
      "https://staging.example.test",
    );
    await user.type(
      screen.getByLabelText(/non-secret note/i),
      "Demo data resets nightly.",
    );
    await user.click(
      screen.getByRole("button", { name: /add shared resource/i }),
    );
    await vi.waitFor(async () =>
      expect(
        await application.projectHome.resources.list(
          freelancer,
          created.room.id,
        ),
      ).toHaveLength(1),
    );
    expect(
      await screen.findByRole("link", {
        name: /staging application/i,
      }),
    ).toHaveAttribute("href", "https://staging.example.test");
    await vi.waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: /add shared resource/i,
        }),
      ).toBeEnabled(),
    );
    await user.type(
      screen.getByLabelText(/resource label/i),
      "Project handbook",
    );
    await user.type(
      screen.getByLabelText(/non-secret note/i),
      "Read before handover.",
    );
    await user.click(
      screen.getByRole("button", { name: /add shared resource/i }),
    );
    await vi.waitFor(async () =>
      expect(
        await application.projectHome.resources.list(
          freelancer,
          created.room.id,
        ),
      ).toHaveLength(2),
    );
    expect(
      (
        await application.projectHome.resources.list(
          freelancer,
          created.room.id,
        )
      ).map(({ label }) => label),
    ).toEqual(["Staging application", "Project handbook"]);
    await user.click(
      await screen.findByRole("button", {
        name: /move up: project handbook/i,
      }),
    );
    const resourceList = document.querySelector<HTMLElement>(
      ".shared-resource-list",
    )!;
    expect(
      within(resourceList)
        .getAllByRole("article")
        .map((article) => article.textContent),
    ).toEqual([
      expect.stringContaining("Project handbook"),
      expect.stringContaining("Staging application"),
    ]);
    await user.click(
      screen.getByRole("button", {
        name: /edit: staging application/i,
      }),
    );
    const stagingEditor = screen
      .getByRole("button", { name: /save shared resource/i })
      .closest("form")!;
    const note = within(stagingEditor).getByLabelText(
      /non-secret note/i,
    );
    await user.clear(note);
    await user.type(note, "Demo data resets every morning.");
    await user.click(
      within(stagingEditor).getByRole("button", {
        name: /save shared resource/i,
      }),
    );
    await user.click(
      screen.getByRole("button", {
        name: /remove: project handbook/i,
      }),
    );
    expect(
      screen.queryByText(/read before handover/i),
    ).not.toBeInTheDocument();

    rendered.unmount();
    localStorage.setItem(
      "project-interviewer.device-id",
      "client-device",
    );
    render(
      <MemoryRouter initialEntries={["/invite/test-invite-1"]}>
        <TestRoutes />
      </MemoryRouter>,
    );
    expect(
      await screen.findByRole("link", {
        name: /staging application/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/demo data resets every morning/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /add shared resource/i }),
    ).not.toBeInTheDocument();
    await application.projectHome.resources.create(
      freelancer,
      created.room.id,
      {
        label: "Live status",
        note: "Appears while the Client home stays open.",
      },
    );
    expect(
      await screen.findByText(
        /appears while the client home stays open/i,
        {},
        { timeout: 1_500 },
      ),
    ).toBeInTheDocument();
  });

  it("supports archive restore and Recently Deleted recovery from the Freelancer Workspace", async () => {
    localStorage.setItem("project-interviewer.locale", "en");
    const application = createTestApplication();
    const freelancer =
      await application.identities.establishFreelancer({
        displayName: "Ada",
      });
    const archived = await application.rooms.create(freelancer, {
      title: "Archived room",
      clientLabel: "Alpine",
      projectDescription: "Retain this room.",
      briefLanguage: "en",
      freelancerGuidance: "",
    });
    const deleted = await application.rooms.create(freelancer, {
      title: "Deleted room",
      clientLabel: "Beacon",
      projectDescription: "Recover this room.",
      briefLanguage: "en",
      freelancerGuidance: "",
    });
    await application.projectHome.lifecycle.archive(
      freelancer,
      archived.room.id,
    );
    await application.projectHome.lifecycle.delete(
      freelancer,
      deleted.room.id,
    );
    const routes = createRoutes(application, freelancer);
    const TestRoutes = () => useRoutes(routes);
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/"]}>
        <TestRoutes />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", { name: /recently deleted/i }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", {
        name: /restore archived room/i,
      }),
    );
    expect(
      await screen.findByText("Setup", { selector: ".phase" }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: /recover deleted room/i,
      }),
    );
    expect(
      await screen.findByRole("heading", { name: "Deleted room" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/deleted room/i, {
        selector: ".recently-deleted-list *",
      }),
    ).not.toBeInTheDocument();
  });

  it("reacts to archive and deletion while the Client Project Home remains mounted", async () => {
    localStorage.setItem("project-interviewer.locale", "en");
    localStorage.setItem(
      "project-interviewer.device-id",
      "client-device",
    );
    const application = createTestApplication();
    const freelancer =
      await application.identities.establishFreelancer({
        displayName: "Ada",
      });
    const created = await application.rooms.create(freelancer, {
      title: "Archived Client Home",
      clientLabel: "Alpine",
      projectDescription: "A retained home.",
      briefLanguage: "en",
      freelancerGuidance: "",
    });
    const access = await application.clientAccess.resolveInvite(
      created.inviteToken,
      { deviceId: "client-device" },
    );
    await application.clientAccess.onboard(access.actor, {
      displayName: "Casey",
      interviewLanguage: "en",
      acknowledgedDisclosure: true,
    });
    const routes = createRoutes(application, freelancer);
    const TestRoutes = () => useRoutes(routes);
    render(
      <MemoryRouter initialEntries={["/invite/test-invite-1"]}>
        <TestRoutes />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", {
        name: /archived client home/i,
      }),
    ).toBeInTheDocument();
    await application.projectHome.lifecycle.archive(
      freelancer,
      created.room.id,
    );
    expect(
      await screen.findByText(
        /archived project home is read-only/i,
        {},
        { timeout: 1_500 },
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/add project material/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: /start discovery interview/i,
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /add shared resource/i }),
    ).not.toBeInTheDocument();
    await application.projectHome.lifecycle.delete(
      freelancer,
      created.room.id,
    );
    expect(
      await screen.findByRole(
        "heading",
        { name: /project room unavailable/i },
        { timeout: 1_500 },
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/a retained home/i),
    ).not.toBeInTheDocument();
  });
});
