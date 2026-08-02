import type { CreatorLanguage } from "./creator-language";

export const creatorCopy = {
  en: {
    shell: {
      skipToMain: "Skip to main content",
      tabs: { interviews: "Interviews", templates: "Templates", settings: "Settings" },
      signOut: "Sign out",
      workspace: "Creator workspace",
    },
    auth: {
      workspaceLabel: "Creator workspace",
      signInTitle: "Sign in to Project Interviewer",
      signInIntro:
        "Use the provider that owns your account. Google and GitHub identities are never silently linked, even when they share an email address.",
      continueWith: "Continue with",
      registration: "Registration is restricted to the deployment allowlist.",
      openingWorkspace: "Opening your Creator workspace…",
      preparingProfile: "Preparing your Creator profile…",
      linkedAccount: (provider: string) =>
        `This email already belongs to an account created with ${provider}. Continue with ${provider}.`,
      linkedOtherProvider:
        "This email already belongs to an account created with the other sign-in provider. Continue with the provider you used first.",
      notAllowlisted:
        "This identity is not on the private-launch registration allowlist.",
    },
    interviews: {
      workspace: "Creator workspace",
      title: "Interviews",
      intro:
        "Create one focused Interview, send one link, and receive an implementation-ready Project Submission.",
      newInterview: "New Interview",
      loading: "Loading Interviews…",
      currentStep: (step: string) => `Current step: ${step}`,
      open: "Open",
      emptyTitle: "No Interviews yet",
      emptyIntro: "Start with concise instructions for the website work you sell.",
      status: {
        not_started: "Not started",
        in_progress: "In progress",
        submitted: "Submitted",
        needs_attention: "Needs attention",
      },
      step: {
        interview: "Interview",
        review: "Document Review",
        concepts: "Visual Concepts",
        submitted: "Submitted",
      },
      language: { en: "English", de: "German" },
    },
    templates: {
      title: "Templates",
      intro:
        "Templates prefill Interview Instructions. Editing one never changes an existing Interview.",
      newPrivate: "New Private Template",
      builtInUnavailable: "Built-in templates are not available.",
      builtInTitle: "Built-in Interview Templates",
      noPrivate: "No Private Interview Templates yet.",
      privateTitle: "Private Interview Templates",
      deleteLabel: "Delete template",
      deleteTitle: "Delete Private Interview Template?",
      deleteDescription: (name: string) =>
        `${name} will be deleted immediately. Existing Interviews keep their instruction snapshot.`,
      edit: (name: string) => `Edit ${name}`,
      delete: (name: string) => `Delete ${name}`,
      sourceLanguage: "Source language",
      language: { en: "English", de: "German" },
      editPrivate: "Edit Private Interview Template",
      newPrivateForm: "New Private Interview Template",
      templateName: "Template name",
      instructions: "Interview Instructions",
      cancel: "Cancel",
      save: "Save template",
    },
    form: {
      description:
        "The Interview Link works as soon as you create it. Configuration remains editable until the Client sends their first message.",
      editPreparation: "Edit preparation",
      newInterview: "New Interview",
      editInterview: "Edit Interview",
      prepareInterview: "Prepare an Interview",
      unavailable: "Interview unavailable",
      frozenTitle: "Interview configuration is frozen",
      frozenDescription:
        "The first Client message fixed the project name, Client Language, and Interview Instructions.",
      projectName: "Project name",
      clientLanguage: "Client Language",
      templateHint:
        "A template prefills this field; it never governs the Interview after copying.",
      templateLabel: "Optional Interview Template",
      noTemplate: "No template",
      builtIn: "Built-in",
      private: "Private",
      instructions: "Interview Instructions",
      translating: "Translating Interview Instructions…",
      translateTo: (language: string) => `Translate to ${language}`,
      saveAsTemplate: "Save as template",
      saveTemplatePrompt: "Name this Private Interview Template",
      templateSaved: "Private Interview Template saved.",
      saving: "Saving…",
      saveConfiguration: "Save configuration",
      createInterview: "Create Interview",
      copiedTemplate:
        "Template copied. You can freely customize these Interview Instructions.",
      languageChanged:
        "Client Language changed. Your edited Interview Instructions were kept.",
      builtInSwitched: "Built-in template switched to match the Client Language.",
      noMatchingBuiltIn:
        "No matching built-in template is available. Existing Interview Instructions were kept.",
      translationUpdated:
        "Translation updated this Interview only. Save it separately if you want a new Private Interview Template.",
      confirmReplace:
        "Selecting this template replaces the Interview Instructions you edited. Continue?",
      confirmTranslate:
        "The current edited Interview Instructions—not the original template—will be translated. Continue?",
      characters: (count: number) => `${count.toLocaleString()} / 50,000 characters`,
      formLoading: "Opening Interview…",
    },
    detail: {
      unavailable: "Interview unavailable",
      editConfiguration: "Edit configuration",
      delete: "Delete",
      interviewLink: "Interview Link",
      linkDescription:
        "Anyone with this bearer link can start, resume, and view the final Interview. Regenerating it invalidates the old link immediately.",
      linkUnavailable: "The link is only returned when created or regenerated.",
      copied: "Copied",
      copyLink: "Copy link",
      instructions: "Interview Instructions",
      instructionsDescription:
        "These are the instructions captured for this Interview. Copy them if you want to reuse or inspect them.",
      copyInstructions: "Copy instructions",
      regenerateLink: "Regenerate link",
      confirmRegenerate:
        "Regenerate this Interview Link? The current link will stop working immediately.",
      emailNotification: "Email notification",
      emailPending:
        "Sending in the background. The Project Submission is already complete.",
      emailMissing:
        "Not configured for this deployment. The Project Submission is complete and available below.",
      emailFailed:
        "The notification could not be delivered. The Project Submission remains complete and available below.",
      retryNotification: "Retry notification",
      handoffArtifacts: "Handoff artifacts",
      handoffDescription:
        "The Interview Transcript remains secondary to the implementation direction.",
      downloadZip: "Download ZIP",
      projectDocument: "Project Document",
      downloadMarkdown: "Markdown",
      documentPending: "The Project Document will appear after the Interview is complete.",
      visualConcepts: "Visual Concepts",
      generationFailed: "Generation failed",
      generating: "Generating…",
      roughVisualDirection: "rough visual direction",
      viewImage: "View larger",
      closeImage: "Close image",
      downloadImage: "Download image",
      visualDirection: "Visual Direction",
      transcript: "Interview Transcript",
      client: "Client",
      interviewModel: "Assistant",
      deletePermanent: "Delete Interview permanently",
      confirmDelete: "Delete this Interview?",
      deleteDescription:
        "This immediately and irreversibly removes the Interview Link, Interview Transcript, Project Document, Visual Concepts, and Project Submission.",
      language: { en: "English", de: "German" },
      unavailableConcept: "Unavailable",
      additionalNote: "Additional note",
      selectedConcept: "Selected concept",
      inspirationLinks: "Inspiration links",
    },
    settings: {
      title: "Settings",
      intro:
        "This identity is shown to Clients so they can verify who invited them.",
      displayName: "Business or display name",
      emailHint: "Your verified identity cannot be changed here.",
      email: "Verified email",
      save: "Save settings",
      saved: "Settings saved.",
    },
    common: { cancel: "Cancel" },
  },
  de: {
    shell: {
      skipToMain: "Zum Hauptinhalt springen",
      tabs: { interviews: "Interviews", templates: "Vorlagen", settings: "Einstellungen" },
      signOut: "Abmelden",
      workspace: "Creator-Arbeitsbereich",
    },
    auth: {
      workspaceLabel: "Creator-Arbeitsbereich",
      signInTitle: "Bei Project Interviewer anmelden",
      signInIntro:
        "Verwenden Sie den Anbieter, mit dem Ihr Konto erstellt wurde. Google- und GitHub-Identitäten werden niemals stillschweigend verknüpft, auch nicht bei gleicher E-Mail-Adresse.",
      continueWith: "Weiter mit",
      registration:
        "Die Registrierung ist auf die Allowlist dieser Bereitstellung beschränkt.",
      openingWorkspace: "Creator-Arbeitsbereich wird geöffnet…",
      preparingProfile: "Creator-Profil wird vorbereitet…",
      linkedAccount: (provider: string) =>
        `Diese E-Mail-Adresse gehört bereits zu einem mit ${provider} erstellten Konto. Fahren Sie mit ${provider} fort.`,
      linkedOtherProvider:
        "Diese E-Mail-Adresse gehört bereits zu einem Konto des anderen Anbieters. Verwenden Sie den Anbieter, den Sie zuerst genutzt haben.",
      notAllowlisted:
        "Diese Identität steht nicht auf der Registrierungsliste für den privaten Start.",
    },
    interviews: {
      workspace: "Creator-Arbeitsbereich",
      title: "Interviews",
      intro:
        "Erstellen Sie ein fokussiertes Interview, versenden Sie einen Link und erhalten Sie eine umsetzungsbereite Projektübergabe.",
      newInterview: "Neues Interview",
      loading: "Interviews werden geladen…",
      currentStep: (step: string) => `Aktueller Schritt: ${step}`,
      open: "Öffnen",
      emptyTitle: "Noch keine Interviews",
      emptyIntro: "Beginnen Sie mit präzisen Anweisungen für Ihre Website-Leistung.",
      status: {
        not_started: "Nicht gestartet",
        in_progress: "In Bearbeitung",
        submitted: "Übermittelt",
        needs_attention: "Aufmerksamkeit erforderlich",
      },
      step: {
        interview: "Interview",
        review: "Dokumentprüfung",
        concepts: "Visuelle Konzepte",
        submitted: "Übermittelt",
      },
      language: { en: "Englisch", de: "Deutsch" },
    },
    templates: {
      title: "Vorlagen",
      intro:
        "Vorlagen füllen die Interview Instructions vor. Änderungen an einer Vorlage wirken sich nie auf ein bestehendes Interview aus.",
      newPrivate: "Neue private Vorlage",
      builtInUnavailable: "Integrierte Vorlagen sind nicht verfügbar.",
      builtInTitle: "Integrierte Interview-Vorlagen",
      noPrivate: "Noch keine privaten Interview-Vorlagen.",
      privateTitle: "Private Interview-Vorlagen",
      deleteLabel: "Vorlage löschen",
      deleteTitle: "Private Interview-Vorlage löschen?",
      deleteDescription: (name: string) =>
        `${name} wird sofort gelöscht. Bestehende Interviews behalten ihre gespeicherten Anweisungen.`,
      edit: (name: string) => `${name} bearbeiten`,
      delete: (name: string) => `${name} löschen`,
      sourceLanguage: "Quellsprache",
      language: { en: "Englisch", de: "Deutsch" },
      editPrivate: "Private Interview-Vorlage bearbeiten",
      newPrivateForm: "Neue private Interview-Vorlage",
      templateName: "Vorlagenname",
      instructions: "Interview Instructions",
      cancel: "Abbrechen",
      save: "Vorlage speichern",
    },
    form: {
      description:
        "Der Interview-Link funktioniert sofort nach dem Erstellen. Die Konfiguration bleibt bearbeitbar, bis der Client seine erste Nachricht sendet.",
      editPreparation: "Vorbereitung bearbeiten",
      newInterview: "Neues Interview",
      editInterview: "Interview bearbeiten",
      prepareInterview: "Interview vorbereiten",
      unavailable: "Interview nicht verfügbar",
      frozenTitle: "Interview-Konfiguration ist eingefroren",
      frozenDescription:
        "Die erste Client-Nachricht hat Projektname, Client Language und Interview Instructions festgelegt.",
      projectName: "Projektname",
      clientLanguage: "Client Language",
      templateHint:
        "Eine Vorlage füllt dieses Feld vor, steuert das Interview nach dem Kopieren aber nicht.",
      templateLabel: "Optionale Interview-Vorlage",
      noTemplate: "Keine Vorlage",
      builtIn: "Integriert",
      private: "Privat",
      instructions: "Interview Instructions",
      translating: "Interview Instructions werden übersetzt…",
      translateTo: (language: string) => `Ins ${language} übersetzen`,
      saveAsTemplate: "Als Vorlage speichern",
      saveTemplatePrompt: "Name dieser privaten Interview-Vorlage",
      templateSaved: "Private Interview-Vorlage gespeichert.",
      saving: "Wird gespeichert…",
      saveConfiguration: "Konfiguration speichern",
      createInterview: "Interview erstellen",
      copiedTemplate:
        "Vorlage kopiert. Sie können diese Interview Instructions frei anpassen.",
      languageChanged:
        "Client Language geändert. Ihre bearbeiteten Interview Instructions wurden beibehalten.",
      builtInSwitched: "Integrierte Vorlage an die Client Language angepasst.",
      noMatchingBuiltIn:
        "Keine passende integrierte Vorlage verfügbar. Die bisherigen Interview Instructions wurden beibehalten.",
      translationUpdated:
        "Die Übersetzung betrifft nur dieses Interview. Speichern Sie sie separat, wenn Sie eine neue private Interview-Vorlage möchten.",
      confirmReplace:
        "Die Auswahl dieser Vorlage ersetzt Ihre bearbeiteten Interview Instructions. Fortfahren?",
      confirmTranslate:
        "Die aktuell bearbeiteten Interview Instructions – nicht die ursprüngliche Vorlage – werden übersetzt. Fortfahren?",
      characters: (count: number) => `${count.toLocaleString("de-DE")} / 50.000 Zeichen`,
      formLoading: "Interview wird geöffnet…",
    },
    detail: {
      unavailable: "Interview nicht verfügbar",
      editConfiguration: "Konfiguration bearbeiten",
      delete: "Löschen",
      interviewLink: "Interview-Link",
      linkDescription:
        "Jede Person mit diesem Bearer-Link kann das Interview starten, fortsetzen und das Ergebnis ansehen. Eine Erneuerung macht den alten Link sofort ungültig.",
      linkUnavailable: "Der Link wird nur beim Erstellen oder Erneuern angezeigt.",
      copied: "Kopiert",
      copyLink: "Link kopieren",
      instructions: "Interview Instructions",
      instructionsDescription:
        "Diese Anweisungen wurden für dieses Interview gespeichert. Kopieren Sie sie, wenn Sie sie wiederverwenden oder prüfen möchten.",
      copyInstructions: "Anweisungen kopieren",
      regenerateLink: "Link erneuern",
      confirmRegenerate:
        "Diesen Interview-Link erneuern? Der aktuelle Link funktioniert danach sofort nicht mehr.",
      emailNotification: "E-Mail-Benachrichtigung",
      emailPending:
        "Wird im Hintergrund gesendet. Die Projektübergabe ist bereits abgeschlossen.",
      emailMissing:
        "Für diese Bereitstellung nicht konfiguriert. Die Projektübergabe ist abgeschlossen und unten verfügbar.",
      emailFailed:
        "Die Benachrichtigung konnte nicht zugestellt werden. Die Projektübergabe bleibt abgeschlossen und unten verfügbar.",
      retryNotification: "Benachrichtigung erneut versuchen",
      handoffArtifacts: "Übergabedateien",
      handoffDescription:
        "Das Interview-Transkript bleibt gegenüber der Umsetzungsrichtung nachgeordnet.",
      downloadZip: "ZIP herunterladen",
      projectDocument: "Projektdokument",
      downloadMarkdown: "Markdown",
      documentPending: "Das Projektdokument erscheint nach Abschluss des Interviews.",
      visualConcepts: "Visuelle Konzepte",
      generationFailed: "Erstellung fehlgeschlagen",
      generating: "Wird erstellt…",
      roughVisualDirection: "grobe visuelle Richtung",
      viewImage: "Bild vergrößern",
      closeImage: "Bild schließen",
      downloadImage: "Bild herunterladen",
      visualDirection: "Visuelle Richtung",
      transcript: "Interview-Transkript",
      client: "Client",
      interviewModel: "Assistent",
      deletePermanent: "Interview endgültig löschen",
      confirmDelete: "Dieses Interview löschen?",
      deleteDescription:
        "Dadurch werden Interview-Link, Interview-Transkript, Projektdokument, visuelle Konzepte und Projektübergabe sofort und unwiderruflich gelöscht.",
      language: { en: "Englisch", de: "Deutsch" },
      unavailableConcept: "Nicht verfügbar",
      additionalNote: "Zusätzliche Notiz",
      selectedConcept: "Ausgewähltes Konzept",
      inspirationLinks: "Inspirationslinks",
    },
    settings: {
      title: "Einstellungen",
      intro:
        "Diese Identität wird Clients angezeigt, damit sie prüfen können, wer sie eingeladen hat.",
      displayName: "Geschäfts- oder Anzeigename",
      emailHint: "Ihre verifizierte Identität kann hier nicht geändert werden.",
      email: "Verifizierte E-Mail",
      save: "Einstellungen speichern",
      saved: "Einstellungen gespeichert.",
    },
    common: { cancel: "Abbrechen" },
  },
} as const satisfies Record<CreatorLanguage, object>;
