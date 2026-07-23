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
    continue_discovery: "Continue the interview",
    review_brief_draft: "Review the draft",
    review_project_brief: "Review the project brief",
    wait_for_client_review: "Wait for Client review",
    use_project_home: "Use the approved Project Home",
    restore_project_room: "Restore the Project Room",
    view_archived_project_home: "Read-only archived Project Home",
  },
  de: {
    share_invite: "Einladungslink teilen",
    continue_discovery: "Interview fortsetzen",
    review_brief_draft: "Entwurf prüfen",
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
          "Add files about your project — or simply continue without files if there is nothing to share.",
        label: "Add files",
        title: "First, let’s gather your project files.",
      },
      freelancer: {
        detail:
          "Share the Invite Link below. The Client then adds their files.",
        title: "You need to invite the Client.",
      },
    },
    material_waiting: {
      freelancer: {
        detail:
          "The Client still needs to add files or deliberately continue without files.",
        title: "Waiting for the Client to share their files.",
      },
    },
    discovery: {
      client: {
        detail:
          "A few short questions are waiting for you — answer them in your own words.",
        label: "Answer questions",
        title: "A few questions are waiting for you.",
      },
      freelancer: {
        detail:
          "The Client is answering the interview. You can observe the conversation here.",
        title: "Waiting for the Client to continue the interview.",
      },
    },
    freelancer_review: {
      client: {
        detail:
          "The Freelancer is reviewing the project brief before sending it to you.",
        title: "Waiting for the Freelancer to review the project brief.",
      },
      freelancer: {
        detail:
          "Review and refine the project brief, then send a version to the Client.",
        label: "Open project brief",
        title: "You need to review the project brief.",
      },
    },
    client_review: {
      client: {
        detail:
          "Read the project brief, then approve it or ask for a change.",
        label: "Read the project brief",
        title: "The project brief is ready for you.",
      },
      freelancer: {
        detail:
          "The Client is reviewing the project brief. Their approval or change request will appear there.",
        title: "Waiting for the Client to review the project brief.",
      },
    },
    approved: {
      detail:
        "The Client approved the current project brief. There is no outstanding action in this Project Room.",
      title: "The project brief is approved.",
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
          "Fügen Sie Dateien zu Ihrem Projekt hinzu — oder fahren Sie einfach ohne Dateien fort, wenn es nichts zu teilen gibt.",
        label: "Dateien hinzufügen",
        title: "Sammeln wir zuerst Ihre Projektdateien.",
      },
      freelancer: {
        detail:
          "Teilen Sie unten den Einladungslink. Danach fügt der Client seine Dateien hinzu.",
        title: "Sie müssen den Client einladen.",
      },
    },
    material_waiting: {
      freelancer: {
        detail:
          "Der Client muss noch Dateien hinzufügen oder bewusst ohne Dateien fortfahren.",
        title: "Warten auf die Dateien des Clients.",
      },
    },
    discovery: {
      client: {
        detail:
          "Ein paar kurze Fragen warten auf Sie — beantworten Sie sie in Ihren eigenen Worten.",
        label: "Fragen beantworten",
        title: "Ein paar Fragen warten auf Sie.",
      },
      freelancer: {
        detail:
          "Der Client beantwortet das Interview. Sie können das Gespräch hier verfolgen.",
        title: "Warten auf die Fortsetzung des Interviews durch den Client.",
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
        label: "Projektbrief lesen",
        title: "Der Projektbrief ist für Sie bereit.",
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
  if (
    (room.phase === "setup" || room.phase === "discovery") &&
    room.interviewReadiness === "waiting_for_material"
  ) {
    if (actorKind === "freelancer" && room.phase === "discovery") {
      return {
        actor: "client",
        ...copy.material_waiting.freelancer,
      };
    }
    if (actorKind === "client") {
      return {
        actor: "client",
        ...copy.setup.client,
        targetTab: "material",
      };
    }
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
