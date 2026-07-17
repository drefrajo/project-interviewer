import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Language } from "../domain/project-interviewer";

const copy = {
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
      "You’ll share Project Material, then answer one focused question at a time. The Freelancer can see the files and interview.",
    filesLimits: "Files and limits",
    filesLimitsBody:
      "PDF, Office files, text, and common images are supported. Up to 20 files, 25 MB each, and 100 MB total.",
    aiProcessing: "AI processing",
    aiProcessingBody:
      "Project Material and answers may be processed by third-party AI providers through OpenRouter.",
    protectAccess: "Protect access",
    protectAccessBody:
      "Anyone with this Invite Link can enter this Project Room. Suspected text secrets are masked before AI processing by default, but detection is not a guarantee. Do not upload passwords, API keys, or tokens.",
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
    material: "Project Material",
    interview: "Discovery Interview",
    brief: "Project Brief",
    resources: "Shared Resources",
    projectHome: "Project Home",
    welcome: "Welcome, {name}",
    nextStep: "Next step",
    inviteCreated: "Invite Link created",
    inviteHint: "Copy it now. The secret is only shown in this browser response.",
    available: "Available",
    notAvailable: "Not yet available",
    materialBody:
      "Add Project Material here or deliberately continue without files.",
    interviewBody:
      "Available after current Project Material reaches a terminal state.",
    briefBody:
      "Available after the interview is completed or deliberately ended.",
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
      "Sie teilen Projektmaterial und beantworten danach jeweils eine fokussierte Frage. Der Freelancer kann Dateien und Interview einsehen.",
    filesLimits: "Dateien und Limits",
    filesLimitsBody:
      "PDF, Office-Dateien, Text und gängige Bilder werden unterstützt. Bis zu 20 Dateien, je 25 MB und insgesamt 100 MB.",
    aiProcessing: "KI-Verarbeitung",
    aiProcessingBody:
      "Projektmaterial und Antworten können über OpenRouter von externen KI-Anbietern verarbeitet werden.",
    protectAccess: "Zugriff schützen",
    protectAccessBody:
      "Jede Person mit diesem Link kann den Projektraum öffnen. Verdächtige Textgeheimnisse werden standardmäßig vor der KI-Verarbeitung maskiert; die Erkennung ist keine Garantie. Laden Sie keine Passwörter, API-Schlüssel oder Tokens hoch.",
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
    material: "Projektmaterial",
    interview: "Klärungsinterview",
    brief: "Projektbrief",
    resources: "Geteilte Ressourcen",
    projectHome: "Projektübersicht",
    welcome: "Willkommen, {name}",
    nextStep: "Nächster Schritt",
    inviteCreated: "Einladungslink erstellt",
    inviteHint:
      "Kopieren Sie ihn jetzt. Das Geheimnis wird nur in dieser Browserantwort angezeigt.",
    available: "Verfügbar",
    notAvailable: "Noch nicht verfügbar",
    materialBody:
      "Fügen Sie hier Projektmaterial hinzu oder fahren Sie bewusst ohne Dateien fort.",
    interviewBody:
      "Verfügbar, sobald das aktuelle Projektmaterial einen Endzustand erreicht.",
    briefBody:
      "Verfügbar, sobald das Interview abgeschlossen oder bewusst beendet wurde.",
    resourcesBody:
      "Der Freelancer kann jederzeit nicht geheime Links und Notizen hinzufügen.",
    openingRoom: "Projektraum wird geöffnet",
    openingInvite: "Einladungslink wird geöffnet",
  },
} as const;

type CopyKey = keyof (typeof copy)["en"];

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
          copy[locale][key] as string,
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
