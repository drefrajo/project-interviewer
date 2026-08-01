import type { ClientLanguage } from "../../infrastructure/interview-api";

export const CLIENT_COPY = {
  en: {
    steps: ["Interview", "Review", "Concepts", "Submitted"],
    start: "Start interview",
    send: "Send",
    retryResponse: "Retry response",
    reply: "Your reply",
    reviewTitle: "Review your Project Document",
    reviewIntro:
      "This is the current implementation direction and first-draft website copy. Request a change if anything important is wrong or missing.",
    changes: "What should change?",
    requestChanges: "Request changes",
    continueConcepts: "Continue to concepts",
    conceptsTitle: "Choose a visual direction",
    conceptsIntro:
      "These are rough directions, not final designs. Choose one, or provide up to three public inspiration links.",
    conceptsPending:
      "We’re creating three Visual Concepts. Please wait—this may take a moment.",
    conceptsPlanning: "Planning three concept images…",
    conceptsCreating: "Creating three concept images…",
    moreOptions: "I don't like any of these — show three more options",
    retryMoreOptions: "Retry second image batch (temporary)",
    retryFirstOptions: "Retry first image batch (temporary)",
    selectConcept: "Select this concept",
    inspiration: "None of these fit — use inspiration links",
    note: "Optional note",
    saveDirection: "Use this direction",
    submit: "Submit project",
    finalWarning:
      "Submission is final. The Project Submission becomes read-only for you and the Creator.",
    submittedTitle: "Project submitted",
    submittedIntro:
      "The Creator has received this immutable Project Submission.",
  },
  de: {
    steps: ["Interview", "Prüfung", "Konzepte", "Übermittelt"],
    start: "Interview starten",
    send: "Senden",
    retryResponse: "Antwort erneut erzeugen",
    reply: "Ihre Antwort",
    reviewTitle: "Projektdokument prüfen",
    reviewIntro:
      "Dies ist die aktuelle Umsetzungsrichtung mit ersten Website-Texten. Fordern Sie eine Änderung an, falls etwas Wichtiges fehlt oder nicht stimmt.",
    changes: "Was soll geändert werden?",
    requestChanges: "Änderungen anfordern",
    continueConcepts: "Weiter zu den Konzepten",
    conceptsTitle: "Visuelle Richtung wählen",
    conceptsIntro:
      "Dies sind grobe Richtungen, keine finalen Designs. Wählen Sie eine aus oder geben Sie bis zu drei öffentliche Inspirationslinks an.",
    conceptsPending:
      "Wir erstellen drei visuelle Konzepte. Bitte warten Sie – dies kann einen Moment dauern.",
    conceptsPlanning: "Drei Konzeptbilder werden geplant…",
    conceptsCreating: "Drei Konzeptbilder werden erstellt…",
    moreOptions: "Keines passt – drei weitere Optionen zeigen",
    retryMoreOptions: "Zweiten Bild-Batch erneut starten (temporär)",
    retryFirstOptions: "Ersten Bild-Batch erneut starten (temporär)",
    selectConcept: "Dieses Konzept wählen",
    inspiration: "Keines passt – Inspirationslinks verwenden",
    note: "Optionale Notiz",
    saveDirection: "Diese Richtung verwenden",
    submit: "Projekt übermitteln",
    finalWarning:
      "Die Übermittlung ist endgültig. Danach ist die Projektübergabe für Sie und den Creator schreibgeschützt.",
    submittedTitle: "Projekt übermittelt",
    submittedIntro:
      "Der Creator hat diese unveränderliche Projektübergabe erhalten.",
  },
} as const satisfies Record<ClientLanguage, object>;
