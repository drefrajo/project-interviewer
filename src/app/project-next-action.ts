import {
  projectNextActionFor,
  type Language,
  type ProjectNextAction,
  type ProjectPhase,
  type RoomActor,
} from "../domain/project-interviewer";

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
