import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Language } from "../domain/project-interviewer";

export const UI_COPY = {
  en: {
    skip: "Skip to main content",
    languages: "Interface language",
    workspace: "Freelancer Workspace",
    rooms: "Your Project Rooms",
    tagline:
      "Turn Client material and focused discovery into a shared, reviewable Project Brief.",
    createProjectRoom: "Create Project Room",
    newProjectRoom: "New Project Room",
    startingPoint: "Set the discovery starting point",
    cancel: "Cancel",
    projectTitle: "Project title",
    clientLabel: "Client name or label",
    projectDescription: "Project Description",
    descriptionHint: "Client-visible initial evidence, not settled truth.",
    descriptionPlaceholder:
      "What you currently understand about the project…",
    briefLanguage: "Brief Language",
    discoveryProfile: "Discovery Profile",
    softwareProject: "Software project",
    guidance: "Freelancer Guidance",
    privateOptional: "Private · optional",
    guidancePlaceholder:
      "Services, exclusions, availability, commercial ranges…",
    createRoom: "Create room",
    searchRooms: "Search Project Rooms",
    searchPlaceholder: "Search rooms or Clients",
    filterPhase: "Filter by phase",
    roomFilters: "Project Room filters",
    allPhases: "All phases",
    noRooms: "No Project Rooms here yet",
    noRoomsHint: "Create one to prepare a focused discovery.",
    unavailable: "Project Room unavailable",
    invalidInvite: "This Invite Link is invalid or has been revoked.",
    signInRequired: "Freelancer sign-in required",
    clientBoundary:
      "This browser session entered through a Client Invite Link and has access only to that Project Room.",
    beforeBegin: "Before you begin",
    process:
      "You can share files about your project, then answer a few short questions in small batches. The Freelancer can see your files and your answers.",
    filesLimits: "Files and limits",
    filesLimitsBody:
      "PDF, Office files, text, and common images are supported. Up to 20 files, 25 MB each, and 100 MB total.",
    aiProcessing: "AI processing",
    aiProcessingBody:
      "Your files and answers may be processed by third-party AI providers through OpenRouter.",
    protectAccess: "Protect access",
    protectAccessBody:
      "Anyone with this Invite Link can enter this Project Room. Files are sent to the configured AI provider for analysis, so share only what belongs in this Project Room.",
    yourName: "Your display name",
    interviewLanguage: "Interview Language",
    acknowledgement:
      "I understand who can view this Project Room and that third-party AI providers may process its content.",
    enterRoom: "Enter Project Room",
    entering: "Entering…",
    clientProjectHome: "Client Project Home",
    backWorkspace: "← Freelancer Workspace",
    roomNavigation: "Project Room",
    overview: "Overview",
    material: "Files",
    interview: "Interview",
    brief: "Project brief",
    resources: "Shared Resources",
    projectHome: "Project Home",
    welcome: "Welcome, {name}",
    nextStep: "Next step",
    inviteCreated: "Invite Link created",
    inviteHint:
      "This link remains available here until you rotate or revoke it.",
    inviteControls: "Invite Link access",
    copyInvite: "Copy Invite Link",
    inviteCopied: "Invite Link copied",
    inviteUnavailable:
      "This older Invite Link cannot be displayed again. Rotate it once to create a persistent link.",
    rotateInvite: "Rotate Invite Link",
    revokeInvite: "Revoke Invite Link",
    inviteRevoked: "Invite Link revoked. Existing Client sessions no longer have access.",
    available: "Available",
    notAvailable: "Not yet available",
    materialBody:
      "Add files about the project here, or continue without files if there is nothing to share.",
    evidenceFirst: "Your documents",
    materialPanelIntro:
      "Add any documents that describe the project. We read them and use them to ask better questions in the interview.",
    addMaterial: "Add files",
    materialLimits:
      "PDF, DOCX, PPTX, XLSX, CSV, TXT, Markdown, PNG, JPG, and WebP · 25 MB per file · 20 files · 100 MB total.",
    imageProviderDisclosure:
      "Images are sent to our AI provider so their content can be read.",
    materialUploadFailed: "The file could not be added.",
    uploadedByFreelancer: "Added by the Freelancer",
    uploadedByClient: "Added by you",
    uploadingMaterial: "Uploading",
    confidence: "certainty",
    summarySources: "Based on",
    identifiedSources: "Details we noticed",
    analysisFeedback: "Something wrong or missing?",
    feedbackPlaceholder: "Tell us in your own words…",
    addFeedback: "Send feedback",
    retry: "Retry",
    reanalyze: "Read again",
    remove: "Remove",
    noMaterialYet: "No files yet.",
    continueWithoutFiles: "I have no files — continue",
    continueToInterview: "Continue to the interview",
    filesReadyTitle: "Your files are ready",
    filesReadyBody:
      "Everything has been read. Next, answer a few questions so we understand what you need.",
    contextPackRevision: "What we know so far · version",
    minimalContextWarning:
      "You have not shared any files, so the interview starts with a blank slate.",
    materialFailed: "Couldn’t read this file",
    materialUnsupported: "Can’t read this file type",
    materialAnalyzed: "Read",
    checkingFile: "Checking…",
    extractingContent: "Reading…",
    analyzingMaterial: "Taking a closer look…",
    indexingMaterial: "Almost done…",
    interviewBody:
      "Available once your files have been read — or right away if you continue without files.",
    briefBody: "Available once the interview is finished.",
    resourcesBody:
      "The Freelancer can add non-secret links and notes at any time.",
    openingRoom: "Opening Project Room",
    openingInvite: "Opening Invite Link",
  },
  de: {
    skip: "Zum Hauptinhalt springen",
    languages: "Sprache der Oberfläche",
    workspace: "Arbeitsbereich für Freelancer",
    rooms: "Ihre Projekträume",
    tagline:
      "Machen Sie aus Projektmaterial und fokussierter Klärung einen gemeinsamen, prüfbaren Projektbrief.",
    createProjectRoom: "Projektraum erstellen",
    newProjectRoom: "Neuer Projektraum",
    startingPoint: "Ausgangspunkt für die Klärung festlegen",
    cancel: "Abbrechen",
    projectTitle: "Projekttitel",
    clientLabel: "Name oder Bezeichnung des Clients",
    projectDescription: "Projektbeschreibung",
    descriptionHint:
      "Für den Client sichtbare Ausgangslage, keine feststehende Wahrheit.",
    descriptionPlaceholder: "Was Sie derzeit über das Projekt verstehen…",
    briefLanguage: "Sprache des Projektbriefs",
    discoveryProfile: "Klärungsprofil",
    softwareProject: "Softwareprojekt",
    guidance: "Freelancer-Hinweise",
    privateOptional: "Privat · optional",
    guidancePlaceholder:
      "Leistungen, Ausschlüsse, Verfügbarkeit, Preisrahmen…",
    createRoom: "Raum erstellen",
    searchRooms: "Projekträume suchen",
    searchPlaceholder: "Räume oder Clients suchen",
    filterPhase: "Nach Phase filtern",
    roomFilters: "Filter für Projekträume",
    allPhases: "Alle Phasen",
    noRooms: "Noch keine Projekträume",
    noRoomsHint: "Erstellen Sie einen Raum für eine fokussierte Klärung.",
    unavailable: "Projektraum nicht verfügbar",
    invalidInvite: "Dieser Einladungslink ist ungültig oder wurde widerrufen.",
    signInRequired: "Freelancer-Anmeldung erforderlich",
    clientBoundary:
      "Diese Browsersitzung wurde über einen Client-Einladungslink geöffnet und hat nur Zugriff auf diesen Projektraum.",
    beforeBegin: "Bevor Sie beginnen",
    process:
      "Sie können Dateien zu Ihrem Projekt teilen und danach ein paar kurze Fragen in kleinen Gruppen beantworten. Der Freelancer kann Ihre Dateien und Antworten sehen.",
    filesLimits: "Dateien und Limits",
    filesLimitsBody:
      "PDF, Office-Dateien, Text und gängige Bilder werden unterstützt. Bis zu 20 Dateien, je 25 MB und insgesamt 100 MB.",
    aiProcessing: "KI-Verarbeitung",
    aiProcessingBody:
      "Ihre Dateien und Antworten können über OpenRouter von externen KI-Anbietern verarbeitet werden.",
    protectAccess: "Zugriff schützen",
    protectAccessBody:
      "Jede Person mit diesem Link kann den Projektraum öffnen. Dateien werden zur Analyse an den konfigurierten KI-Anbieter gesendet. Teilen Sie daher nur Inhalte, die in diesen Projektraum gehören.",
    yourName: "Ihr Anzeigename",
    interviewLanguage: "Interviewsprache",
    acknowledgement:
      "Ich verstehe, wer diesen Projektraum sehen kann und dass externe KI-Anbieter Inhalte verarbeiten können.",
    enterRoom: "Projektraum öffnen",
    entering: "Wird geöffnet…",
    clientProjectHome: "Projektübersicht für Clients",
    backWorkspace: "← Freelancer-Arbeitsbereich",
    roomNavigation: "Projektraum",
    overview: "Übersicht",
    material: "Dateien",
    interview: "Interview",
    brief: "Projektbrief",
    resources: "Geteilte Ressourcen",
    projectHome: "Projektübersicht",
    welcome: "Willkommen, {name}",
    nextStep: "Nächster Schritt",
    inviteCreated: "Einladungslink erstellt",
    inviteHint:
      "Dieser Link bleibt hier verfügbar, bis Sie ihn erneuern oder widerrufen.",
    inviteControls: "Zugriff über Einladungslink",
    copyInvite: "Einladungslink kopieren",
    inviteCopied: "Einladungslink kopiert",
    inviteUnavailable:
      "Dieser ältere Einladungslink kann nicht erneut angezeigt werden. Erneuern Sie ihn einmal, um einen dauerhaft sichtbaren Link zu erstellen.",
    rotateInvite: "Einladungslink erneuern",
    revokeInvite: "Einladungslink widerrufen",
    inviteRevoked:
      "Einladungslink widerrufen. Bestehende Client-Sitzungen haben keinen Zugriff mehr.",
    available: "Verfügbar",
    notAvailable: "Noch nicht verfügbar",
    materialBody:
      "Fügen Sie hier Dateien zum Projekt hinzu oder fahren Sie ohne Dateien fort, wenn es nichts zu teilen gibt.",
    evidenceFirst: "Ihre Unterlagen",
    materialPanelIntro:
      "Fügen Sie Dokumente hinzu, die das Projekt beschreiben. Wir lesen sie und nutzen sie, um im Interview bessere Fragen zu stellen.",
    addMaterial: "Dateien hinzufügen",
    materialLimits:
      "PDF, DOCX, PPTX, XLSX, CSV, TXT, Markdown, PNG, JPG und WebP · 25 MB je Datei · 20 Dateien · 100 MB gesamt.",
    imageProviderDisclosure:
      "Bilder werden an unseren KI-Anbieter gesendet, damit ihr Inhalt gelesen werden kann.",
    materialUploadFailed: "Die Datei konnte nicht hinzugefügt werden.",
    uploadedByFreelancer: "Vom Freelancer hinzugefügt",
    uploadedByClient: "Von Ihnen hinzugefügt",
    uploadingMaterial: "Wird hochgeladen",
    confidence: "Sicherheit",
    summarySources: "Basiert auf",
    identifiedSources: "Aufgefallene Details",
    analysisFeedback: "Stimmt etwas nicht oder fehlt etwas?",
    feedbackPlaceholder: "Schreiben Sie es in Ihren eigenen Worten…",
    addFeedback: "Feedback senden",
    retry: "Erneut versuchen",
    reanalyze: "Erneut lesen",
    remove: "Entfernen",
    noMaterialYet: "Noch keine Dateien.",
    continueWithoutFiles: "Ich habe keine Dateien — weiter",
    continueToInterview: "Weiter zum Interview",
    filesReadyTitle: "Ihre Dateien sind bereit",
    filesReadyBody:
      "Alles wurde gelesen. Beantworten Sie als Nächstes ein paar Fragen, damit wir verstehen, was Sie brauchen.",
    contextPackRevision: "Was wir bisher wissen · Version",
    minimalContextWarning:
      "Sie haben keine Dateien geteilt, daher startet das Interview ohne Vorwissen.",
    materialFailed: "Datei konnte nicht gelesen werden",
    materialUnsupported: "Dateityp nicht lesbar",
    materialAnalyzed: "Gelesen",
    checkingFile: "Wird geprüft…",
    extractingContent: "Wird gelesen…",
    analyzingMaterial: "Wird genauer angesehen…",
    indexingMaterial: "Fast fertig…",
    interviewBody:
      "Verfügbar, sobald Ihre Dateien gelesen wurden — oder sofort, wenn Sie ohne Dateien fortfahren.",
    briefBody: "Verfügbar, sobald das Interview abgeschlossen ist.",
    resourcesBody:
      "Der Freelancer kann jederzeit nicht geheime Links und Notizen hinzufügen.",
    openingRoom: "Projektraum wird geöffnet",
    openingInvite: "Einladungslink wird geöffnet",
  },
} as const;

type CopyKey = keyof (typeof UI_COPY)["en"];

interface I18nValue {
  locale: Language;
  setLocale(locale: Language): void;
  t(key: CopyKey, variables?: Record<string, string>): string;
}

const I18nContext = createContext<I18nValue | undefined>(undefined);

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [locale, setLocaleState] = useState<Language>(() => {
    const stored = localStorage.getItem("project-interviewer.locale");
    return stored === "de" ? "de" : "en";
  });
  useEffect(() => {
    document.documentElement.lang = locale;
    localStorage.setItem("project-interviewer.locale", locale);
  }, [locale]);
  const value = useMemo<I18nValue>(
    () => ({
      locale,
      setLocale: setLocaleState,
      t: (key, variables = {}) =>
        Object.entries(variables).reduce(
          (text, [name, replacement]) =>
            text.replace(`{${name}}`, replacement),
          UI_COPY[locale][key] as string,
        ),
    }),
    [locale],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = (): I18nValue => {
  const value = useContext(I18nContext);
  if (!value) throw new Error("I18nProvider is missing.");
  return value;
};
