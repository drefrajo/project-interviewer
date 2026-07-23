import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
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

const onboardClientAndContinueWithoutMaterial = async (
  application: ReturnType<typeof createTestApplication>,
  input: {
    inviteToken: string;
    roomId: string;
    deviceId?: string;
    displayName?: string;
  },
) => {
  const access = await application.clientAccess.resolveInvite(
    input.inviteToken,
    { deviceId: input.deviceId ?? "client-device" },
  );
  await application.clientAccess.onboard(access.actor, {
    displayName: input.displayName ?? "Casey",
    interviewLanguage: "en",
    acknowledgedDisclosure: true,
  });
  await application.materials.continueWithoutFiles(
    access.actor,
    input.roomId,
  );
  return access;
};

describe("File-First Discovery application shell", () => {
  it("exchanges a Client Invite Link once when StrictMode replays effects", async () => {
    localStorage.setItem("project-interviewer.locale", "en");
    localStorage.setItem("project-interviewer.device-id", "browser-device");
    const application = createTestApplication();
    const freelancer = await application.identities.establishFreelancer({
      displayName: "Ada",
    });
    const created = await application.rooms.create(freelancer, {
      title: "Invite Room",
      clientLabel: "Alpine",
      projectDescription: "A client portal.",
      briefLanguage: "en",
      freelancerGuidance: "",
    });
    const resolveInvite = vi.spyOn(application.clientAccess, "resolveInvite");
    const routes = createRoutes(application, freelancer);
    const TestRoutes = () => useRoutes(routes);

    render(
      <StrictMode>
        <MemoryRouter initialEntries={[`/invite/${created.inviteToken}`]}>
          <TestRoutes />
        </MemoryRouter>
      </StrictMode>,
    );

    expect(
      await screen.findByRole("heading", { name: /before you begin/i }),
    ).toBeInTheDocument();
    expect(resolveInvite).toHaveBeenCalledOnce();
  });

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
    const tabs = screen.getByRole("tablist", { name: /project room/i });
    expect(within(tabs).getAllByRole("tab")).toHaveLength(4);
    expect(
      within(tabs).getByRole("tab", { name: /^overview$/i }),
    ).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("heading", { name: /shared resources/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/add files/i),
    ).not.toBeInTheDocument();

    await user.click(
      within(tabs).getByRole("tab", { name: /^files$/i }),
    );
    expect(
      await screen.findByLabelText(/add files/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /i have no files/i }),
    ).not.toBeInTheDocument();

    await user.click(
      within(tabs).getByRole("tab", { name: /^overview$/i }),
    );

    await user.click(
      screen.getByRole("button", { name: /rotate invite link/i }),
    );
    expect(screen.getByText(/test-invite-2/)).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: /revoke invite link/i }),
    );
    expect(screen.getByText(/invite link revoked/i)).toBeInTheDocument();
  });

  it("shows the current Invite Link when the owner opens a room directly", async () => {
    const application = createTestApplication();
    const freelancer =
      await application.identities.establishFreelancer({
        displayName: "Ada",
      });
    const created = await application.rooms.create(freelancer, {
      title: "Persistent Invite",
      clientLabel: "Alpine",
      projectDescription: "A portal for client service requests.",
      briefLanguage: "en",
      freelancerGuidance: "",
    });
    const routes = createRoutes(application, freelancer);
    const TestRoutes = () => useRoutes(routes);

    render(
      <MemoryRouter initialEntries={[`/rooms/${created.room.id}`]}>
        <TestRoutes />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText(/test-invite-1/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /copy invite link/i }),
    ).toBeInTheDocument();

    await application.clientAccess.rotateInvite(
      freelancer,
      created.room.id,
    );
    fireEvent.focus(window);

    expect(
      await screen.findByText(/test-invite-2/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/test-invite-1/)).not.toBeInTheDocument();
  });

  it("ignores an owner refresh that became stale during Invite Link rotation", async () => {
    const user = userEvent.setup();
    const application = createTestApplication();
    const freelancer =
      await application.identities.establishFreelancer({
        displayName: "Ada",
      });
    const created = await application.rooms.create(freelancer, {
      title: "Concurrent Invite",
      clientLabel: "Alpine",
      projectDescription: "A portal for client service requests.",
      briefLanguage: "en",
      freelancerGuidance: "",
    });
    const routes = createRoutes(application, freelancer);
    const TestRoutes = () => useRoutes(routes);
    render(
      <MemoryRouter initialEntries={[`/rooms/${created.room.id}`]}>
        <TestRoutes />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/test-invite-1/)).toBeInTheDocument();

    let releaseRotation: () => void = () => {};
    const rotationGate = new Promise<void>((resolve) => {
      releaseRotation = resolve;
    });
    let releaseStaleRefresh: () => void = () => {};
    const staleRefreshGate = new Promise<void>((resolve) => {
      releaseStaleRefresh = resolve;
    });
    let staleRefreshCaptured: () => void = () => {};
    const staleRefreshCapturedGate = new Promise<void>((resolve) => {
      staleRefreshCaptured = resolve;
    });
    const rotateInvite =
      application.clientAccess.rotateInvite.bind(
        application.clientAccess,
      );
    vi.spyOn(
      application.clientAccess,
      "rotateInvite",
    ).mockImplementation(async (...args) => {
      await rotationGate;
      return rotateInvite(...args);
    });
    const getInvite = application.clientAccess.getInvite.bind(
      application.clientAccess,
    );
    vi.spyOn(
      application.clientAccess,
      "getInvite",
    ).mockImplementationOnce(async (...args) => {
      const stale = await getInvite(...args);
      staleRefreshCaptured();
      await staleRefreshGate;
      return stale;
    });

    await user.click(
      screen.getByRole("button", { name: /rotate invite link/i }),
    );
    fireEvent.focus(window);
    await staleRefreshCapturedGate;
    releaseRotation();
    expect(await screen.findByText(/test-invite-2/)).toBeInTheDocument();
    releaseStaleRefresh();

    await waitFor(() => {
      expect(screen.getByText(/test-invite-2/)).toBeInTheDocument();
      expect(screen.queryByText(/test-invite-1/)).not.toBeInTheDocument();
    });
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
      screen.getByText(/sent to the configured ai provider for analysis/i),
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

    await user.click(
      await screen.findByRole("tab", { name: /^files$/i }),
    );

    await user.upload(
      await screen.findByLabelText(/add files/i),
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
    expect(screen.getByText(/based on/i).closest("details")).toBeNull();
    const sources = screen.getByText(/details we noticed/i);
    const sourcesDisclosure = sources.closest("details");
    expect(sourcesDisclosure).not.toHaveAttribute("open");
    await user.click(sources);
    expect(sourcesDisclosure).toHaveAttribute("open");
  });

  it("runs the Client interview as a conversation from Project Home", async () => {
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
    localStorage.setItem("project-interviewer.device-id", "browser-device");
    await onboardClientAndContinueWithoutMaterial(application, {
      inviteToken: created.inviteToken,
      roomId: created.room.id,
      deviceId: "browser-device",
    });
    const routes = createRoutes(application, freelancer);
    const TestRoutes = () => useRoutes(routes);
    render(
      <MemoryRouter initialEntries={["/invite/test-invite-1"]}>
        <TestRoutes />
      </MemoryRouter>,
    );
    await user.click(
      await screen.findByRole("tab", { name: /^interview$/i }),
    );
    await user.click(
      await screen.findByRole("button", {
        name: /start the conversation/i,
      }),
    );

    expect(
      await screen.findByRole("heading", {
        name: /who will use this product/i,
      }),
    ).toBeInTheDocument();
    await user.type(
      screen.getByLabelText(/who will use this product/i),
      "Customers should submit service requests without calling support.",
    );
    await user.click(
      screen.getByRole("button", {
        name: /send answers/i,
      }),
    );
    expect(
      await screen.findByRole("heading", {
        name: /what must the first useful release include/i,
      }),
    ).toBeInTheDocument();
    const conversation = screen.getByRole("list", {
      name: /^interview$/i,
    });
    expect(
      within(conversation).getByRole("article", { name: /^you$/i }),
    ).toHaveTextContent(
      "Customers should submit service requests without calling support.",
    );
    expect(
      screen.queryByRole("heading", { name: /^coverage$/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/discovery findings/i)).not.toBeInTheDocument();
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
    localStorage.setItem("project-interviewer.device-id", "browser-device");
    await onboardClientAndContinueWithoutMaterial(application, {
      inviteToken: created.inviteToken,
      roomId: created.room.id,
      deviceId: "browser-device",
    });
    const routes = createRoutes(application, freelancer);
    const TestRoutes = () => useRoutes(routes);
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/invite/test-invite-1"]}>
        <TestRoutes />
      </MemoryRouter>,
    );
    await user.click(
      await screen.findByRole("tab", { name: /^interview$/i }),
    );
    await user.click(
      await screen.findByRole("button", {
        name: /start the conversation/i,
      }),
    );

    const answer =
      "Customers should submit service requests without calling support.";
    await user.type(
      screen.getByLabelText(/who will use this product/i),
      answer,
    );
    await user.click(
      screen.getByRole("button", {
        name: /send answers/i,
      }),
    );

    await vi.waitFor(() => expect(agentStarted).toHaveBeenCalledOnce());
    expect(await screen.findByText(answer)).toBeInTheDocument();
    expect(
      screen.getByText("Working on the next questions"),
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
    const access = await application.clientAccess.resolveInvite(
      created.inviteToken,
      { deviceId: "client-device" },
    );
    await application.clientAccess.onboard(access.actor, {
      displayName: "Chris",
      interviewLanguage: "en",
      acknowledgedDisclosure: true,
    });
    await application.materials.continueWithoutFiles(
      access.actor,
      created.room.id,
    );
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
      await screen.findByRole("tab", { name: /project brief/i }),
    );
    await user.click(
      await screen.findByRole("button", {
        name: /create the project brief/i,
      }),
    );
    expect(
      await screen.findByRole("heading", { name: /^draft$/i }),
    ).toBeInTheDocument();
    const markdownEditor = screen.getByLabelText(/project brief markdown/i);
    const generatedMarkdown = (markdownEditor as HTMLTextAreaElement).value;
    expect(generatedMarkdown).toContain("# Project Brief");
    expect(generatedMarkdown).toContain("single sign-on");
    const revisedMarkdown = generatedMarkdown.replace(
      "The product must support single sign-on.",
      "The product must support single sign-on for every staff member.",
    );
    fireEvent.change(markdownEditor, {
      target: { value: revisedMarkdown },
    });
    await user.click(
      screen.getByRole("button", { name: /save changes/i }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      /^saved\.$/i,
    );
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    await user.click(
      screen.getByRole("button", { name: /copy text/i }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      /^copied\.$/i,
    );
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("## Evidence appendix"),
    );
    expect(writeText).not.toHaveBeenCalledWith(
      expect.stringContaining("project-brief:section"),
    );
    await user.click(
      screen.getByRole("tab", { name: /^preview$/i }),
    );
    expect(
      await screen.findByText(/single sign-on for every staff member/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/project brief markdown/i),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /^edit$/i }));
    while (
      screen.queryAllByRole("button", { name: /^keep as is$/i }).length
    ) {
      await user.click(
        screen.getAllByRole("button", { name: /^keep as is$/i })[0]!,
      );
    }
    await user.click(
      screen.getByRole("button", { name: /send to the client for review/i }),
    );
    expect(
      await screen.findByRole("heading", {
        name: /version for review 1/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/single sign-on for every staff member/i),
    ).toBeInTheDocument();

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
    await user.click(
      await screen.findByRole("tab", { name: /project brief/i }),
    );
    expect(
      await screen.findByRole("heading", {
        name: /version for review 1/i,
      }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/single sign-on for every staff member/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/project-brief:section/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /approve this version/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/not a signature or contract/i)).toBeInTheDocument();
    const changeRequestField = screen.getByLabelText(/^request a change$/i);
    await user.type(changeRequestField, "Clarify who administers SSO.");
    await user.click(
      screen.getByRole("button", { name: /send change request/i }),
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
    expect(changeRequestField).toHaveValue("Clarify who administers SSO.");
    await user.clear(changeRequestField);
    await user.type(
      changeRequestField,
      "Clarify who administers SSO and when access is revoked.",
    );
    await user.click(
      screen.getByRole("button", { name: /send change request/i }),
    );
    await vi.waitFor(async () =>
      expect(
        (
          await application.briefs.get(
            access.actor,
            created.room.id,
          )
        ).activeChangeRequest?.revisions,
      ).toHaveLength(2),
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
    const resourceList = screen.getByRole("region", {
      name: /shared resources/i,
    });
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
    const restoredRoom = await screen.findByRole("button", {
      name: /open archived room/i,
    });
    expect(
      within(restoredRoom).getByText("Setup", { exact: true }),
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
      screen.queryByRole("region", { name: /recently deleted/i }),
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
    const user = userEvent.setup();
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
      screen.queryByRole("button", { name: /add shared resource/i }),
    ).not.toBeInTheDocument();
    const tabs = screen.getByRole("tablist", { name: /project room/i });
    await user.click(
      within(tabs).getByRole("tab", { name: /^files$/i }),
    );
    expect(
      screen.queryByLabelText(/add files/i),
    ).not.toBeInTheDocument();
    await user.click(
      within(tabs).getByRole("tab", { name: /^interview$/i }),
    );
    expect(
      screen.queryByRole("button", { name: /start the conversation/i }),
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
