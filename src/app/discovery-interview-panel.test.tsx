import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  DiscoveryInterviewView,
  InterviewTurn,
} from "../domain/discovery-interview";
import type {
  ClientActor,
  FreelancerActor,
  ProjectInterviewer,
  ProjectRoomView,
} from "../domain/project-interviewer";
import { DiscoveryInterviewPanel } from "./discovery-interview-panel";
import { I18nProvider } from "./i18n";

const client: ClientActor = {
  kind: "client",
  roomId: "room-1",
  deviceId: "device-1",
  inviteVersion: 1,
  sessionId: "client-session",
};

const freelancer: FreelancerActor = {
  kind: "freelancer",
  freelancerId: "freelancer-1",
  sessionId: "freelancer-session",
};

const room: ProjectRoomView = {
  id: "room-1",
  title: "Client portal",
  clientLabel: "Alpine",
  projectDescription: "A self-service portal.",
  briefLanguage: "en",
  discoveryProfileId: "software-project",
  phase: "discovery",
  interviewReadiness: "ready",
  lastActivityAt: 1,
  createdAt: 1,
  updatedAt: 1,
  freelancerDisplayName: "Ada",
  client: {
    displayName: "Casey",
    interviewLanguage: "en",
    acknowledgedAt: 1,
  },
};

const acceptedTurn: InterviewTurn = {
  id: "turn-1",
  roomId: room.id,
  interviewId: "interview-1",
  sequence: 1,
  question: {
    id: "question-1",
    text: "Who needs to use the portal?",
    coverageAreaId: "goals-users",
    kind: "primary",
    reason: "The users are not clear yet.",
    askedAt: 1,
  },
  answer: "Regional service managers use it every day.",
  answerKind: "answer",
  idempotencyKey: "answer-1",
  contextPackRevisionId: null,
  contextPackRevision: null,
  acceptedAt: 2,
};

const interviewView = (
  overrides: Partial<DiscoveryInterviewView> = {},
): DiscoveryInterviewView => ({
  id: "interview-1",
  roomId: room.id,
  language: "en",
  status: "active",
  respondingDevice: true,
  leaseVersion: 1,
  operationStatus: "idle",
  answerCount: 1,
  coverage: [
    {
      id: "goals-users",
      label: "Goals and users",
      status: "sufficient",
    },
  ],
  turns: [acceptedTurn],
  corrections: [],
  findings: [
    {
      id: "finding-1",
      roomId: room.id,
      interviewId: "interview-1",
      type: "candidate_requirement",
      statement: "Managers need a regional queue.",
      sources: [{ type: "turn", turnId: acceptedTurn.id }],
      status: "active",
      createdAt: 2,
    },
  ],
  events: [
    {
      id: "event-1",
      roomId: room.id,
      interviewId: "interview-1",
      type: "project_material_added",
      materialId: "material-1",
      contextPackRevisionId: "context-2",
      contextPackRevision: 2,
      createdAt: 2,
    },
  ],
  unresolvedTopics: [],
  reviewerBlockers: [],
  usageReviewTriggered: false,
  currentQuestion: {
    id: "question-2",
    text: "Thanks, that helps. What should they be able to do first?",
    coverageAreaId: "scope",
    kind: "primary",
    reason: "Scope remains open.",
    askedAt: 3,
  },
  ...overrides,
});

const applicationFor = (
  view: DiscoveryInterviewView,
  correct = vi.fn(async () => view),
): ProjectInterviewer =>
  ({
    contextPacks: {
      latest: vi.fn(async () => null),
    },
    interviews: {
      get: vi.fn(async () => view),
      heartbeat: vi.fn(async () => undefined),
      correct,
    },
  }) as unknown as ProjectInterviewer;

const renderPanel = (
  actor: ClientActor | FreelancerActor,
  view: DiscoveryInterviewView,
  application = applicationFor(view),
) => {
  localStorage.setItem("project-interviewer.locale", "en");
  return render(
    <I18nProvider>
      <DiscoveryInterviewPanel
        actor={actor}
        application={application}
        available
        readOnly={actor.kind === "freelancer"}
        room={room}
      />
    </I18nProvider>,
  );
};

describe("DiscoveryInterviewPanel conversation", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("keeps the accepted Client reply in chronological view while reasoning continues", async () => {
    const processing = interviewView({
      operationStatus: "running",
      currentQuestion: undefined,
      operation: {
        operationType: "interview_turn",
        status: "running",
        stage: "reasoning",
        attemptCount: 1,
        promptVersion: "software-project-interview-agent-v1",
        schemaVersion: "interview-agent-delta-v1",
      },
    });
    renderPanel(client, processing);

    const question = await screen.findByRole("heading", {
      name: acceptedTurn.question.text,
    });
    const reply = screen.getByText(acceptedTurn.answer);
    const status = screen.getByText(
      /considering that and preparing the next question/i,
    );

    expect(
      question.compareDocumentPosition(reply) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      reply.compareDocumentPosition(status) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.queryByText("Coverage")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Managers need a regional queue."),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: /your reply/i }),
    ).not.toBeInTheDocument();
  });

  it("keeps structured discovery state in a secondary Freelancer disclosure", async () => {
    const view = interviewView({ respondingDevice: false });
    renderPanel(freelancer, view);

    const details = await screen.findByText("Discovery details");
    expect(details.closest("details")).not.toHaveAttribute("open");
    expect(screen.getByRole("heading", { name: "Coverage" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Discovery findings" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Managers need a regional queue.")).toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: /your reply/i }),
    ).not.toBeInTheDocument();
  });

  it("opens a correction form on the Client reply it supersedes", async () => {
    const user = userEvent.setup();
    const view = interviewView();
    const correct = vi.fn(async () => ({
      ...view,
      corrections: [
        {
          id: "correction-1",
          roomId: room.id,
          interviewId: view.id,
          turnId: acceptedTurn.id,
          correctedAnswer: "Branch managers use it every day.",
          reason: "The role name changed.",
          deviceId: client.deviceId,
          createdAt: 4,
        },
      ],
    }));
    const application = applicationFor(view, correct);
    renderPanel(client, view, application);

    const reply = await screen.findByText(acceptedTurn.answer);
    const replyArticle = reply.closest("article");
    expect(replyArticle).not.toBeNull();
    await user.click(
      within(replyArticle!).getByRole("button", {
        name: /correct this reply/i,
      }),
    );

    const correctedReply = within(replyArticle!).getByRole("textbox", {
      name: /corrected reply/i,
    });
    expect(correctedReply).toHaveValue(acceptedTurn.answer);
    await user.clear(correctedReply);
    await user.type(correctedReply, "Branch managers use it every day.");
    await user.type(
      within(replyArticle!).getByRole("textbox", {
        name: /what changed/i,
      }),
      "The role name changed.",
    );
    await user.click(
      within(replyArticle!).getByRole("button", {
        name: /correct this reply/i,
      }),
    );

    expect(correct).toHaveBeenCalledWith(client, room.id, {
      turnId: acceptedTurn.id,
      correctedAnswer: "Branch managers use it every day.",
      reason: "The role name changed.",
    });
  });

  it("presents completion as a natural final conversational choice", async () => {
    renderPanel(
      client,
      interviewView({
        status: "awaiting_confirmation",
        currentQuestion: undefined,
      }),
    );

    expect(
      await screen.findByText(/i think we have enough to prepare/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /finish conversation/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /more to discuss/i }),
    ).toBeInTheDocument();
  });
});
