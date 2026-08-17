import type { ClientLanguage } from "../../infrastructure/interview-api";

export const CLIENT_COPY = {
  en: {
    steps: ["Interview", "Review", "Concepts", "Submitted"],
    start: "Start interview",
    reservationRequiredTitle: "This Interview is waiting for a pass reservation",
    reservationRequiredDescription:
      "The Creator must reserve a pass before this Interview Link can be used. Viewing this page does not consume a pass.",
    send: "Send",
    retryResponse: "Retry response",
    reply: "Your reply",
    reviewTitle: "Review your Project Document",
    reviewIntro:
      "This is the current implementation direction and project information. Request a change if anything important is wrong or missing.",
    changes: "Should anything be changed?",
    continueConceptsTitle: "Continue to concepts?",
    continueConceptsWarning:
      "Once you continue, you cannot return to this Project Document review or request further changes.",
    continueConceptsConfirm: "Continue",
    cancel: "Cancel",
    reviewWorkingLabel: "Working on the Project Document",
    reviewWorkingDetail: "Reviewing the requested changes…",
    requestChanges: "Request changes",
    continueConcepts: "Continue to concepts",
    submitDocumentTitle: "Submit this Project Document?",
    submitDocumentWarning:
      "Once you submit, you cannot return to this Project Document review or request further changes.",
    submitDocumentConfirm: "Submit Project Document",
    submitDocument: "Submit Project Document",
    conceptsTitle: "Choose a visual direction",
    conceptsIntro:
      "These are rough directions, not final designs. Choose one, or provide up to three public inspiration links.",
    conceptsPending:
      "We’re creating three Visual Concepts. Please wait—this may take a moment.",
    conceptsPlanning: "Planning three concept images…",
    conceptsCreating: "Creating three concept images…",
    conceptsLongWait: "This may take a while.",
    viewImage: "View larger",
    closeImage: "Close image",
    moreOptions: "I don't like any of these — show three more options",
    retryMoreOptions: "Retry second image batch (temporary)",
    retryFirstOptions: "Retry first image batch (temporary)",
    requiredNote: "Required note",
    selectConcept: "Select this concept",
    inspiration: "None of these fit — use inspiration links",
    note: "Optional note",
    saveDirection: "Use this direction",
    submit: "Submit project",
    finalWarning:
      "Submission is final. The Project Submission becomes read-only for you and the Creator.",
    submittedTitle: "Project submitted",
    submittedIntro:
      "The Creator has received this Project Submission. They will get in touch about the next steps.",
  },
  de: {
    steps: ["Interview", "Prüfung", "Konzepte", "Übermittelt"],
    start: "Interview starten",
    reservationRequiredTitle: "Dieses Interview wartet auf eine Pass-Reservierung",
    reservationRequiredDescription:
      "Der Creator muss einen Pass reservieren, bevor dieser Interview-Link genutzt werden kann. Das Anzeigen dieser Seite verbraucht keinen Pass.",
    send: "Senden",
    retryResponse: "Antwort erneut erzeugen",
    reply: "Ihre Antwort",
    reviewTitle: "Projektdokument prüfen",
    reviewIntro:
      "Dies ist die aktuelle Umsetzungsrichtung mit den Projektinformationen. Fordern Sie eine Änderung an, falls etwas Wichtiges fehlt oder nicht stimmt.",
    changes: "Soll etwas geändert werden?",
    continueConceptsTitle: "Zu den Konzepten weitergehen?",
    continueConceptsWarning:
      "Wenn Sie fortfahren, können Sie nicht zur Prüfung des Projektdokuments zurückkehren und keine weiteren Änderungen anfordern.",
    continueConceptsConfirm: "Fortfahren",
    cancel: "Abbrechen",
    reviewWorkingLabel: "Das Projektdokument wird überarbeitet",
    reviewWorkingDetail: "Die gewünschten Änderungen werden geprüft…",
    requestChanges: "Änderungen anfordern",
    continueConcepts: "Weiter zu den Konzepten",
    submitDocumentTitle: "Dieses Projektdokument übermitteln?",
    submitDocumentWarning:
      "Nach der Übermittlung können Sie nicht zu dieser Prüfung zurückkehren und keine weiteren Änderungen anfordern.",
    submitDocumentConfirm: "Projektdokument übermitteln",
    submitDocument: "Projektdokument übermitteln",
    conceptsTitle: "Visuelle Richtung wählen",
    conceptsIntro:
      "Dies sind grobe Richtungen, keine finalen Designs. Wählen Sie eine aus oder geben Sie bis zu drei öffentliche Inspirationslinks an.",
    conceptsPending:
      "Wir erstellen drei visuelle Konzepte. Bitte warten Sie – dies kann einen Moment dauern.",
    conceptsPlanning: "Drei Konzeptbilder werden geplant…",
    conceptsCreating: "Drei Konzeptbilder werden erstellt…",
    conceptsLongWait: "Das kann etwas dauern.",
    viewImage: "Bild vergrößern",
    closeImage: "Bild schließen",
    moreOptions: "Keines passt – drei weitere Optionen zeigen",
    retryMoreOptions: "Zweiten Bild-Batch erneut starten (temporär)",
    retryFirstOptions: "Ersten Bild-Batch erneut starten (temporär)",
    requiredNote: "Erforderliche Notiz",
    selectConcept: "Dieses Konzept wählen",
    inspiration: "Keines passt – Inspirationslinks verwenden",
    note: "Optionale Notiz",
    saveDirection: "Diese Richtung verwenden",
    submit: "Projekt übermitteln",
    finalWarning:
      "Die Übermittlung ist endgültig. Danach ist die Projektübergabe für Sie und den Creator schreibgeschützt.",
    submittedTitle: "Projekt übermittelt",
    submittedIntro:
      "Der Creator hat diese Projektübergabe erhalten. Er wird sich für die nächsten Schritte melden.",
  },
} as const satisfies Record<ClientLanguage, object>;
