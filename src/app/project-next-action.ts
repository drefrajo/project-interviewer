import {
  projectNextActionFor,
  type Language,
  type ProjectNextAction,
  type ProjectPhase,
  type ProjectRoomView,
  type RoomActor,
} from "../domain/project-interviewer";

export const projectHomeTabs = [
  "overview",
  "material",
  "interview",
  "brief",
] as const;

export type ProjectHomeTab = (typeof projectHomeTabs)[number];

export interface ProjectAttention {
  actor: "client" | "freelancer" | "none";
  detail: string;
  label?: string;
  targetTab?: ProjectHomeTab;
  title: string;
}

const labels: Record<
  Language,
  Record<ProjectNextAction, string>
> = {
  en: {
    share_invite: "Share the Invite Link",
    continue_discovery: "Continue the Discovery Interview",
    review_brief_draft: "Review the Brief Draft",
    review_project_brief: "Review the Project Brief",
    wait_for_client_review: "Wait for Client review",
    use_project_home: "Use the approved Project Home",
    restore_project_room: "Restore the Project Room",
    view_archived_project_home: "Read-only archived Project Home",
  },
  de: {
    share_invite: "Einladungslink teilen",
    continue_discovery: "Klärungsinterview fortsetzen",
    review_brief_draft: "Briefentwurf prüfen",
    review_project_brief: "Projektbrief prüfen",
    wait_for_client_review: "Auf Client-Prüfung warten",
    use_project_home: "Freigegebene Projektübersicht nutzen",
    restore_project_room: "Projektraum wiederherstellen",
    view_archived_project_home:
      "Archivierte Projektübersicht (nur Lesen)",
  },
};

export const projectNextActionLabel = (
  action: ProjectNextAction,
  locale: Language,
): string => labels[locale][action];

export const projectNextActionLabelFor = (
  phase: ProjectPhase,
  actorKind: RoomActor["kind"],
  locale: Language,
): string =>
  projectNextActionLabel(
    projectNextActionFor(phase, actorKind),
    locale,
  );

const attentionCopy = {
  en: {
    setup: {
      client: {
        detail:
          "Add Project Material, or deliberately continue without files when there is nothing to share.",
        label: "Open Project Material",
        title: "You need to prepare the discovery context.",
      },
      freelancer: {
        detail:
          "Share the Invite Link below. The Client then prepares the discovery context.",
        title: "You need to invite the Client.",
      },
    },
    discovery: {
      client: {
        detail:
          "Answer the current question so the conversation can move forward.",
        label: "Open Discovery Interview",
        title: "You need to continue the Discovery Interview.",
      },
      freelancer: {
        detail:
          "The Client is answering the Discovery Interview. You can observe the conversation here.",
        title: "Waiting for the Client to continue discovery.",
      },
    },
    freelancer_review: {
      client: {
        detail:
          "The Freelancer is reviewing the Project Brief before sending it to you.",
        title: "Waiting for the Freelancer to review the Project Brief.",
      },
      freelancer: {
        detail:
          "Review and refine the Project Brief, then send a version to the Client.",
        label: "Open Project Brief",
        title: "You need to review the Project Brief.",
      },
    },
    client_review: {
      client: {
        detail:
          "Read the Project Brief, then approve it or request a change.",
        label: "Open Project Brief",
        title: "You need to review the Project Brief.",
      },
      freelancer: {
        detail:
          "The Client is reviewing the Project Brief. Their approval or Change Request will appear there.",
        title: "Waiting for the Client to review the Project Brief.",
      },
    },
    approved: {
      detail:
        "The Client approved the current Project Brief. There is no outstanding action in this Project Room.",
      title: "The Project Brief is approved.",
    },
    archived: {
      client: {
        detail:
          "This Project Room is read-only until the Freelancer restores it.",
          title: "Waiting for the Freelancer to restore this Project Room.",
      },
      freelancer: {
        detail:
          "This Project Room is archived. Restore it from the controls below when work resumes.",
        title: "You can restore this Project Room when work resumes.",
      },
    },
  },
  de: {
    setup: {
      client: {
        detail:
          "Fügen Sie Projektmaterial hinzu oder fahren Sie bewusst ohne Dateien fort, wenn nichts geteilt werden soll.",
        label: "Projektmaterial öffnen",
        title: "Sie müssen den Klärungskontext vorbereiten.",
      },
      freelancer: {
        detail:
          "Teilen Sie unten den Einladungslink. Danach bereitet der Client den Klärungskontext vor.",
        title: "Sie müssen den Client einladen.",
      },
    },
    discovery: {
      client: {
        detail:
          "Beantworten Sie die aktuelle Frage, damit das Gespräch weitergehen kann.",
        label: "Klärungsinterview öffnen",
        title: "Sie müssen das Klärungsinterview fortsetzen.",
      },
      freelancer: {
        detail:
          "Der Client beantwortet das Klärungsinterview. Sie können das Gespräch hier verfolgen.",
        title: "Warten auf die Fortsetzung der Klärung durch den Client.",
      },
    },
    freelancer_review: {
      client: {
        detail:
          "Der Freelancer prüft den Projektbrief, bevor er ihn Ihnen zusendet.",
        title: "Warten auf die Prüfung des Projektbriefs durch den Freelancer.",
      },
      freelancer: {
        detail:
          "Prüfen und verfeinern Sie den Projektbrief und senden Sie danach eine Version an den Client.",
        label: "Projektbrief öffnen",
        title: "Sie müssen den Projektbrief prüfen.",
      },
    },
    client_review: {
      client: {
        detail:
          "Lesen Sie den Projektbrief und stimmen Sie zu oder bitten Sie um eine Änderung.",
        label: "Projektbrief öffnen",
        title: "Sie müssen den Projektbrief prüfen.",
      },
      freelancer: {
        detail:
          "Der Client prüft den Projektbrief. Zustimmung oder Änderungswunsch erscheinen dort.",
        title: "Warten auf die Prüfung des Projektbriefs durch den Client.",
      },
    },
    approved: {
      detail:
        "Der Client hat den aktuellen Projektbrief bestätigt. In diesem Projektraum ist keine Aktion offen.",
      title: "Der Projektbrief ist bestätigt.",
    },
    archived: {
      client: {
        detail:
          "Dieser Projektraum ist schreibgeschützt, bis der Freelancer ihn wiederherstellt.",
        title: "Warten auf die Wiederherstellung durch den Freelancer.",
      },
      freelancer: {
        detail:
          "Dieser Projektraum ist archiviert. Stellen Sie ihn über die Steuerelemente unten wieder her, wenn die Arbeit weitergeht.",
        title: "Sie können diesen Projektraum wiederherstellen, wenn die Arbeit weitergeht.",
      },
    },
  },
} as const;

export const projectAttentionFor = (
  room: Pick<ProjectRoomView, "phase" | "interviewReadiness">,
  actorKind: RoomActor["kind"],
  locale: Language,
): ProjectAttention => {
  const copy = attentionCopy[locale];
  if (room.phase === "approved") {
    return { actor: "none", ...copy.approved };
  }
  if (room.phase === "archived") {
    return {
      actor: actorKind,
      ...copy.archived[actorKind],
    };
  }
  if (room.phase === "setup" && actorKind === "client") {
    if (room.interviewReadiness === "ready") {
      const ready = copy.discovery.client;
      return {
        actor: "client",
        ...ready,
        targetTab: "interview",
      };
    }
    return {
      actor: "client",
      ...copy.setup.client,
      targetTab: "material",
    };
  }
  const phaseCopy = copy[room.phase];
  const detail = phaseCopy[actorKind] as Pick<
    ProjectAttention,
    "detail" | "label" | "title"
  >;
  return {
    actor:
      phaseCopy === copy.discovery && actorKind === "freelancer"
        ? "client"
        : phaseCopy === copy.freelancer_review && actorKind === "client"
          ? "freelancer"
          : phaseCopy === copy.client_review && actorKind === "freelancer"
            ? "client"
            : actorKind,
    ...detail,
    ...(detail.label
      ? {
          targetTab:
            room.phase === "discovery"
              ? "interview"
              : room.phase === "freelancer_review" ||
                  room.phase === "client_review"
                ? "brief"
                : "overview",
        }
      : {}),
  };
};
