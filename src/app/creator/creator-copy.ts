import type { CreatorLanguage } from "./creator-language";

export const creatorCopy = {
  en: {
    shell: {
      skipToMain: "Skip to main content",
      tabs: { interviews: "Interviews", templates: "Templates", settings: "Settings" },
      signOut: "Sign out",
      workspace: "Creator workspace",
      passBalance: (count: number) =>
        `${count} ${count === 1 ? "Interview Pass" : "Interview Passes"}`,
      buyPasses: "Buy passes",
      profileIncompleteTitle: "Complete Settings before creating Interviews",
      profileIncompleteDescription:
        "Add your public display name and contact email. These details are shown to Clients and are required before you can create an Interview.",
      completeSettings: "Complete Settings",
    },
    legal: {
      label: "Legal information",
      loading: "Checking the current legal documents…",
      errorTitle: "Legal documents unavailable",
      errorDescription:
        "We couldn't check the current legal documents. Please try again.",
      retry: "Try again",
      title: "Updated legal documents",
      description:
        "Some parts of the terms have changed. Please review them carefully and agree to them to continue using this service.",
      terms: "Terms",
      termsDescription: "Review the current Terms before continuing.",
      dpa: "Data Processing Agreement",
      dpaDescription: "Review the current Data Processing Agreement before continuing.",
      checkbox:
        "I have reviewed and agree to the current Terms and Data Processing Agreement.",
      continue: "Agree and continue",
      accepting: "Saving…",
    },
    onboarding: {
      eyebrow: "A quick setup",
      steps: {
        welcome: "Welcome",
        legal: "Terms",
        profile: "Your profile",
        passes: "Interview passes",
      },
      progress: (current: number, total: number) => `Step ${current} of ${total}`,
      back: "Back",
      welcome: {
        eyebrow: "Welcome",
        title: "Welcome to Interview",
        description:
          "Let's get your Creator workspace ready in a few calm steps. You'll set what Clients see, review the terms, and learn how Interview Passes work.",
        highlights: {
          legal: "Review the terms that guide your workspace.",
          profile: "Choose the name and contact email Clients should see.",
          firstPass: "Use your free Introductory Pass to start your first Interview.",
        },
        start: "Let's get started",
      },
      legal: {
        eyebrow: "Terms and data",
        title: "A quick look at the terms",
        description:
          "Please review the current Terms and Data Processing Agreement, then confirm that you agree.",
        terms: "Terms",
        termsDescription: "Review the current Terms before continuing.",
        dpa: "Data Processing Agreement",
        dpaDescription: "Review the current Data Processing Agreement before continuing.",
        checkbox:
          "I have reviewed and agree to the current Terms and Data Processing Agreement.",
        continue: "Agree and continue",
        accepting: "Saving…",
      },
      profile: {
        eyebrow: "Your public profile",
        title: "What should Clients see?",
        description:
          "Set the details that appear on the Interview welcome page and after submission.",
        username: "Creator username",
        usernameHint: "This is the name Clients will see.",
        contactEmail: "Client-displayed email",
        contactEmailHint: (email: string) =>
          `Suggested from your OAuth sign-in email (${email}). Edit it if Clients should use a different address.`,
        privacyPolicyUrl: "Privacy-policy URL (optional)",
        privacyPolicyUrlHint:
          "Optional. Add a public HTTPS link if you want Clients to have it handy. You can add this later in Settings.",
        improvement: "Help improve Interview (optional)",
        improvementHint:
          "Lets us analyze anonymized excerpts of your templates and Interview Instructions to make prompts and templates better. Used only for product improvement; Client answers are never analyzed.",
        save: "Save and continue",
        saving: "Saving…",
      },
      passes: {
        eyebrow: "You're ready",
        title: "Your first Interview is free",
        description:
          "Every Creator starts with one Introductory Pass. When you need more, buy another Interview Pass package below.",
        packageIntro: "Choose one of these packages whenever you need more Interviews:",
        getStarted: "Get started",
      },
      error: "We couldn't save that yet. Please check the details and try again.",
    },
    auth: {
      workspaceLabel: "Creator workspace",
      signInTitle: "Sign in to Interview",
      accountCreation:
        "If you don't have an account yet, we'll create one for you.",
      continueWith: "Continue with",
      lastUsedProvider: (provider: string) => `Last used: ${provider}`,
      privacyAcknowledgementBefore: "By logging in, you acknowledge our",
      privacyPolicy: "privacy policy",
      privacyAcknowledgementAfter: ".",
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
        "Create a focused Interview for the kind of work you need, send one link, and receive an implementation-ready Project Submission.",
      newInterview: "New Interview",
      completeSettings: "Complete Settings",
      loading: "Loading Interviews…",
      currentStep: (step: string) => `Current step: ${step}`,
      open: "Open",
      emptyTitle: "No Interviews yet",
      emptyIntro: "Start with a template or concise instructions for the work you sell.",
      status: {
        not_started: "Not started",
        in_progress: "In progress",
        submitted: "Submitted",
        needs_attention: "Needs attention",
      },
      reservationRequired: "Needs pass reservation",
      ready: "Ready",
      step: {
        interview: "Interview",
        review: "Document Review",
        concepts: "Visual Concepts",
        submitted: "Submitted",
      },
      language: { en: "English", de: "German" },
      kind: {
        website: "Website discovery",
        privacy: "Privacy data mapping",
        custom: "Custom interview",
      },
      conceptsIncluded: "Visual Concepts included",
      conceptsNotIncluded: "Visual Concepts not included",
    },
    templates: {
      title: "Templates",
      intro:
        "Templates copy an Interview Kind and Interview Instructions into a new Interview. Editing one never changes an existing Interview.",
      newPrivate: "New Private Template",
      builtInUnavailable: "Built-in templates are not available.",
      builtInTitle: "Built-in Interview Templates",
      noPrivate: "No Private Interview Templates yet.",
      privateTitle: "Private Interview Templates",
      deleteLabel: "Delete template",
      deleteTitle: "Delete Private Interview Template?",
      deleteDescription: (name: string) =>
        `${name} will be deleted immediately. Existing Interviews retain their full Interview Kind, Visual Concepts setting, and Interview Instructions snapshot.`,
      edit: (name: string) => `Edit ${name}`,
      delete: (name: string) => `Delete ${name}`,
      sourceLanguage: "Source language",
      language: { en: "English", de: "German" },
      description: "When to use this template (optional)",
      interviewKind: "Interview kind",
      includeVisualConcepts: "Include Visual Concepts",
      includeVisualConceptsHint:
        "Website Interviews always include concepts. Privacy Interviews never do. Custom Interviews can choose.",
      conceptsIncluded: "Visual Concepts included",
      conceptsNotIncluded: "Visual Concepts not included",
      conceptsOptional: "Visual Concepts optional",
      editPrivate: "Edit Private Interview Template",
      newPrivateForm: "New Private Interview Template",
      templateName: "Template name",
      instructions: "Interview Instructions",
      cancel: "Cancel",
      save: "Save template",
    },
    form: {
      description:
        "Creating and editing an Interview is free. Reserve a pass when you first share its Interview Link; configuration remains editable until the Client sends their first message.",
      editPreparation: "Edit preparation",
      newInterview: "New Interview",
      editInterview: "Edit Interview",
      prepareInterview: "Prepare an Interview",
      unavailable: "Interview unavailable",
      frozenTitle: "Interview configuration is frozen",
      frozenDescription:
        "The first Client message fixed the project name, interview language, Interview Kind, Visual Concepts setting, and Interview Instructions.",
      projectName: "Project name",
      interviewLanguage: "Interview language",
      templateHint:
        "A template copies its Interview Kind, concrete Visual Concepts setting, and Interview Instructions into this Interview. Later template edits never change this Interview.",
      templateLabel: "Optional Interview Template",
      noTemplate: "No template",
      builtIn: "Built-in",
      private: "Private",
      includeVisualConcepts: "Include Visual Concepts",
      includeVisualConceptsHint:
        "Website Interviews always include concepts. Privacy Interviews never do. Custom Interviews can choose.",
      instructionsEyebrow: "The main brief",
      instructions: "Interview Instructions",
      instructionsHint:
        "Write the scope, questions, constraints, and desired outcome for this Interview. Make the brief as specific as the work requires.",
      instructionsPlaceholder:
        "What should the Client clarify? What decisions should this Interview support? What should the final Project Document contain?",
      instructionsGuidance:
        "Use paragraphs, headings, or bullet points to structure a longer brief. The editor grows with your content.",
      editorHint: "Templates are optional starting points.",
      templateStart: "Start with a template",
      templateStartHint: "Optional — choose a template to prefill this brief.",
      detailsTitle: "Interview details",
      detailsHint: "Set the project label, language, and any visual-concept preference.",
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
        "Interview language changed. Your edited Interview Instructions were kept.",
      builtInSwitched: "Built-in template switched to match the interview language.",
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
      settingsRequiredTitle: "Complete Settings before creating an Interview",
      settingsRequiredDescription:
        "Add your public display name and contact email. Clients see these details before they start.",
    },
    detail: {
      unavailable: "Interview unavailable",
      editConfiguration: "Edit configuration",
      delete: "Delete",
      interviewLink: "Interview Link",
      linkDescription:
        "The first share reserves one pass. The Client can preview the welcome page without consuming it; the pass is consumed only when the Client deliberately starts. Regenerating transfers the reservation and does not use another pass.",
      linkUnavailable: "Reserve a pass before copying or sharing this link.",
      copied: "Copied",
      copyLink: "Copy link",
      instructions: "Interview Instructions",
      instructionsDescription:
        "These are the instructions captured for this Interview. Copy them if you want to reuse or inspect them.",
      copyInstructions: "Copy instructions",
      regenerateLink: "Regenerate link",
      moreActions: "More link actions",
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
      exportEverything: "Export everything (ZIP)",
      exportPending:
        "Nothing to export yet. Exportable content appears as the Interview progresses.",
      retentionSummary: (date: string) =>
        `Data retention: permanent deletion on ${date}`,
      retentionDescription: (date: string) =>
        `This Interview is scheduled for permanent deletion on ${date}. Export everything you need before then; automatic deletion cannot be undone or restored.`,
      projectDocument: "Project Document",
      documentPending: "The Project Document will appear after the Interview is complete.",
      documentFeedbackPrompt: "Was this Project Document helpful?",
      feedbackHelpful: "Helpful",
      feedbackNotHelpful: "Not helpful",
      feedbackUp: "Yes",
      feedbackDown: "Not really",
      feedbackThanks: "Thanks — your feedback directly shapes prompt and template improvements.",
      submissionFeedbackPrompt: "Did this Project Submission save you time?",
      feedbackTitle: "Two quick questions",
      feedbackNotePlaceholder: "What worked, what didn't? (optional)",
      saveFeedbackNote: "Save note",
      visualConcepts: "Visual Concepts",
      generationFailed: "Generation failed",
      generating: "Generating…",
      roughVisualDirection: "rough visual direction",
      conceptPlanningNote: "Planning note, not a verified image description",
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
        "Permanently deletes the Interview Link, Interview Transcript, Project Document, configured Visual Concepts when included, Project Submission, and temporary exports. Access stops immediately. This cannot be undone or restored.",
      language: { en: "English", de: "German" },
      unavailableConcept: "Unavailable",
      additionalNote: "Additional note",
      selectedConcept: "Selected concept",
      inspirationLinks: "Inspiration links",
      reservationTitle: "Interview needs a pass reservation",
      reservationDescription:
        "Preparation is free. The first time you copy or share this link, one Interview Pass is reserved. The Client only consumes it by deliberately starting the Interview.",
      reservationReady: "This Interview has a reserved pass and its link is ready.",
      reserveAndCopyLink: "Reserve 1 pass and copy link",
      reservationConfirmTitle: "Reserve a pass and copy this link?",
      reservationConfirmDescription: (balance: number) =>
        `You currently have ${balance} available ${balance === 1 ? "pass" : "passes"}. This reserves one pass; it is consumed only when the Client starts.`,
      insufficientBalance:
        "You do not have an available Interview Pass. Buy a pack before sharing this Interview.",
      buyPasses: "Buy passes",
      checkingBalance: "Checking your available passes…",
      deactivateInterview: "Deactivate link",
      confirmDeactivate: "Release this Interview's reservation?",
      deactivateDescription:
        "The reserved pass will return to your available balance. The Interview remains editable, but its current link will not be usable until you reserve a pass again.",
    },
    billing: {
      title: "Interview Passes",
      intro:
        "One pass pays for one complete Interview after the Client starts, including the conversation, document, revisions, configured Visual Concepts when included, submission, storage, and downloads.",
      available: "Available passes",
      reserved: "Reserved passes",
      introductory: "Introductory passes",
      purchased: "Purchased passes",
      nonExpiring: "Passes do not expire.",
      taxes: "including tax",
      buyOneTitle: "1 Interview Pass",
      buyOneDescription: "One complete started Interview",
      buyFiveTitle: "5 Interview Passes",
      buyFiveDescription: "Five complete started Interviews",
      buyFor: (price: string) => `Buy for ${price}`,
      redirecting: "Opening secure Checkout…",
      checkoutError: "Checkout could not be opened. Please try again.",
      successTitle: "Purchase status",
      successPending:
        "Payment is still being confirmed. Your Pass Balance will update after the signed payment notification arrives.",
      successConfirmed: "Payment confirmed. Your Interview Passes are available.",
      successFailed: "The payment was not confirmed. No passes were added.",
      successRefunded: "This purchase was refunded and its passes were revoked.",
      successPartialRefund:
        "This purchase has a partial refund and is awaiting reconciliation.",
      cancelledTitle: "Checkout cancelled",
      cancelledDescription: "No passes were added. You can try again whenever you are ready.",
      backToInterviews: "Back to Interviews",
      backToPasses: "Back to passes",
      loading: "Checking purchase status…",
      unavailable: "Pass purchases are not configured for this deployment yet.",
    },
    settings: {
      title: "Settings",
      intro:
        "Complete your public identity before you create an Interview. Clients see your name and contact email before starting and after submission.",
      displayName: "Public Creator display name",
      displayNameHint: "Shown to Clients on the Interview start screen and after submission.",
      contactEmail: "Creator contact email",
      contactEmailHint: "Shown to Clients as the contact address for this Interview.",
      privacyPolicyUrl: "Creator privacy-policy URL (optional)",
      privacyPolicyUrlHint: "Optional. Clients can open this policy before starting and after submission when provided.",
      improvement: "Help improve Interview",
      improvementHint:
        "Optional. Lets us analyze anonymized excerpts of your templates and Interview Instructions to make prompts and templates better. Used only for product improvement; Client answers are never analyzed.",
      emailHint: "Your OAuth sign-in email is private and is never shown to Clients automatically.",
      email: "Private OAuth sign-in email",
      language: "Language",
      languageHint:
        "This language is used for the Creator workspace and notification emails.",
      languageOptions: { en: "English", de: "German" },
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
      passBalance: (count: number) =>
        `${count} ${count === 1 ? "Interview-Pass" : "Interview-Pässe"}`,
      buyPasses: "Pässe kaufen",
      profileIncompleteTitle:
        "Einstellungen vor dem Erstellen von Interviews vervollständigen",
      profileIncompleteDescription:
        "Ergänzen Sie Ihren öffentlichen Anzeigenamen und Ihre Kontakt-E-Mail. Diese Angaben werden Clients angezeigt und sind erforderlich, bevor Sie ein Interview erstellen können.",
      completeSettings: "Einstellungen vervollständigen",
    },
    legal: {
      label: "Rechtliche Informationen",
      loading: "Aktuelle rechtliche Dokumente werden geprüft…",
      errorTitle: "Rechtliche Dokumente nicht verfügbar",
      errorDescription:
        "Die aktuellen rechtlichen Dokumente konnten nicht geprüft werden. Bitte versuchen Sie es erneut.",
      retry: "Erneut versuchen",
      title: "Aktualisierte rechtliche Dokumente",
      description:
        "Einige Teile der Bedingungen haben sich geändert. Bitte prüfen Sie sie sorgfältig und stimmen Sie ihnen zu, um diesen Dienst weiter nutzen zu können.",
      terms: "Bedingungen",
      termsDescription: "Prüfen Sie die aktuellen Bedingungen, bevor Sie fortfahren.",
      dpa: "Auftragsverarbeitungsvertrag (DPA)",
      dpaDescription:
        "Prüfen Sie den aktuellen Auftragsverarbeitungsvertrag, bevor Sie fortfahren.",
      checkbox:
        "Ich habe die aktuellen Bedingungen und den Auftragsverarbeitungsvertrag geprüft und stimme ihnen zu.",
      continue: "Zustimmen und fortfahren",
      accepting: "Wird gespeichert…",
    },
    onboarding: {
      eyebrow: "Kurze Einrichtung",
      steps: {
        welcome: "Willkommen",
        legal: "Bedingungen",
        profile: "Ihr Profil",
        passes: "Interview-Pässe",
      },
      progress: (current: number, total: number) => `Schritt ${current} von ${total}`,
      back: "Zurück",
      welcome: {
        eyebrow: "Willkommen",
        title: "Willkommen bei Interview",
        description:
          "Richten wir Ihren Creator-Arbeitsbereich in wenigen ruhigen Schritten ein. Sie legen fest, was Clients sehen, prüfen die Bedingungen und erfahren, wie Interview-Pässe funktionieren.",
        highlights: {
          legal: "Prüfen Sie die Bedingungen für Ihren Arbeitsbereich.",
          profile: "Wählen Sie den Namen und die Kontakt-E-Mail für Clients.",
          firstPass: "Starten Sie Ihr erstes Interview mit Ihrem kostenlosen Einführungspass.",
        },
        start: "Los geht's",
      },
      legal: {
        eyebrow: "Bedingungen und Daten",
        title: "Ein kurzer Blick auf die Bedingungen",
        description:
          "Bitte prüfen Sie die aktuellen Bedingungen und den Auftragsverarbeitungsvertrag und bestätigen Sie anschließend Ihre Zustimmung.",
        terms: "Bedingungen",
        termsDescription: "Prüfen Sie die aktuellen Bedingungen, bevor Sie fortfahren.",
        dpa: "Auftragsverarbeitungsvertrag (DPA)",
        dpaDescription:
          "Prüfen Sie den aktuellen Auftragsverarbeitungsvertrag, bevor Sie fortfahren.",
        checkbox:
          "Ich habe die aktuellen Bedingungen und den Auftragsverarbeitungsvertrag geprüft und stimme ihnen zu.",
        continue: "Zustimmen und fortfahren",
        accepting: "Wird gespeichert…",
      },
      profile: {
        eyebrow: "Ihr öffentliches Profil",
        title: "Was sollen Clients sehen?",
        description:
          "Legen Sie die Angaben fest, die auf der Interview-Willkommensseite und nach der Übermittlung erscheinen.",
        username: "Creator-Benutzername",
        usernameHint: "Dieser Name wird Clients angezeigt.",
        contactEmail: "Für Clients angezeigte E-Mail",
        contactEmailHint: (email: string) =>
          `Vorschlag aus Ihrer OAuth-Anmelde-E-Mail (${email}). Ändern Sie sie, wenn Clients eine andere Adresse verwenden sollen.`,
        privacyPolicyUrl: "URL der Datenschutzerklärung (optional)",
        privacyPolicyUrlHint:
          "Optional. Hinterlegen Sie einen öffentlichen HTTPS-Link, wenn Clients ihn griffbereit haben sollen. Sie können ihn später in den Einstellungen ergänzen.",
        improvement: "Interview verbessern helfen (optional)",
        improvementHint:
          "Ermöglicht uns die Auswertung anonymisierter Auszüge Ihrer Vorlagen und Interview Instructions, um Prompts und Vorlagen zu verbessern. Ausschließlich zur Produktverbesserung; Antworten von Clients werden nie ausgewertet.",
        save: "Speichern und fortfahren",
        saving: "Wird gespeichert…",
      },
      passes: {
        eyebrow: "Sie sind bereit",
        title: "Ihr erstes Interview ist kostenlos",
        description:
          "Jeder Creator erhält einen Einführungspass. Wenn Sie mehr benötigen, können Sie unten ein weiteres Interview-Paket kaufen.",
        packageIntro: "Wählen Sie eines dieser Pakete, sobald Sie weitere Interviews benötigen:",
        getStarted: "Loslegen",
      },
      error: "Das konnte noch nicht gespeichert werden. Prüfen Sie die Angaben und versuchen Sie es erneut.",
    },
    auth: {
      workspaceLabel: "Creator-Arbeitsbereich",
      signInTitle: "Bei Interview anmelden",
      accountCreation:
        "Wenn Sie noch kein Konto haben, erstellen wir automatisch eines für Sie.",
      continueWith: "Weiter mit",
      lastUsedProvider: (provider: string) => `Zuletzt verwendet: ${provider}`,
      privacyAcknowledgementBefore: "Mit der Anmeldung nehmen Sie unsere",
      privacyPolicy: "Datenschutzerklärung",
      privacyAcknowledgementAfter: " zur Kenntnis.",
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
        "Erstellen Sie ein fokussiertes Interview für die gewünschte Arbeit, versenden Sie einen Link und erhalten Sie eine umsetzungsbereite Projektübergabe.",
      newInterview: "Neues Interview",
      completeSettings: "Einstellungen vervollständigen",
      loading: "Interviews werden geladen…",
      currentStep: (step: string) => `Aktueller Schritt: ${step}`,
      open: "Öffnen",
      emptyTitle: "Noch keine Interviews",
      emptyIntro: "Beginnen Sie mit einer Vorlage oder präzisen Anweisungen für Ihre Leistung.",
      status: {
        not_started: "Nicht gestartet",
        in_progress: "In Bearbeitung",
        submitted: "Übermittelt",
        needs_attention: "Aufmerksamkeit erforderlich",
      },
      reservationRequired: "Pass-Reservierung erforderlich",
      ready: "Bereit",
      step: {
        interview: "Interview",
        review: "Dokumentprüfung",
        concepts: "Visuelle Konzepte",
        submitted: "Übermittelt",
      },
      language: { en: "Englisch", de: "Deutsch" },
      kind: {
        website: "Website allgemein",
        privacy: "Datenschutz-Datenmapping",
        custom: "Individuelles Interview",
      },
      conceptsIncluded: "Visuelle Konzepte enthalten",
      conceptsNotIncluded: "Visuelle Konzepte nicht enthalten",
    },
    templates: {
      title: "Vorlagen",
      intro:
        "Vorlagen kopieren eine Interview-Art und Interview Instructions in ein neues Interview. Änderungen an einer Vorlage wirken sich nie auf ein bestehendes Interview aus.",
      newPrivate: "Neue private Vorlage",
      builtInUnavailable: "Integrierte Vorlagen sind nicht verfügbar.",
      builtInTitle: "Integrierte Interview-Vorlagen",
      noPrivate: "Noch keine privaten Interview-Vorlagen.",
      privateTitle: "Private Interview-Vorlagen",
      deleteLabel: "Vorlage löschen",
      deleteTitle: "Private Interview-Vorlage löschen?",
      deleteDescription: (name: string) =>
        `${name} wird sofort gelöscht. Bestehende Interviews behalten ihre vollständige Interview-Art, die Einstellung für visuelle Konzepte und den gespeicherten Snapshot der Interview Instructions.`,
      edit: (name: string) => `${name} bearbeiten`,
      delete: (name: string) => `${name} löschen`,
      sourceLanguage: "Quellsprache",
      language: { en: "Englisch", de: "Deutsch" },
      description: "Wann sollte diese Vorlage verwendet werden? (optional)",
      interviewKind: "Interview-Art",
      includeVisualConcepts: "Visuelle Konzepte einschließen",
      includeVisualConceptsHint:
        "Website-Interviews enthalten immer Konzepte. Datenschutz-Interviews enthalten keine. Bei individuellen Interviews ist die Wahl frei.",
      conceptsIncluded: "Visuelle Konzepte enthalten",
      conceptsNotIncluded: "Visuelle Konzepte nicht enthalten",
      conceptsOptional: "Visuelle Konzepte optional",
      editPrivate: "Private Interview-Vorlage bearbeiten",
      newPrivateForm: "Neue private Interview-Vorlage",
      templateName: "Vorlagenname",
      instructions: "Interview Instructions",
      cancel: "Abbrechen",
      save: "Vorlage speichern",
    },
    form: {
      description:
        "Das Erstellen und Bearbeiten eines Interviews ist kostenlos. Reservieren Sie beim ersten Teilen des Interview-Links einen Pass; die Konfiguration bleibt bis zur ersten Client-Nachricht bearbeitbar.",
      editPreparation: "Vorbereitung bearbeiten",
      newInterview: "Neues Interview",
      editInterview: "Interview bearbeiten",
      prepareInterview: "Interview vorbereiten",
      unavailable: "Interview nicht verfügbar",
      frozenTitle: "Interview-Konfiguration ist eingefroren",
      frozenDescription:
        "Die erste Client-Nachricht hat Projektname, Interview-Sprache, Interview-Art, die Einstellung für visuelle Konzepte und die Interview Instructions festgelegt.",
      projectName: "Projektname",
      interviewLanguage: "Interview-Sprache",
      templateHint:
        "Eine Vorlage kopiert ihre Interview-Art, die konkrete Einstellung für visuelle Konzepte und die Interview Instructions in dieses Interview. Spätere Änderungen an der Vorlage wirken sich nie auf dieses Interview aus.",
      templateLabel: "Optionale Interview-Vorlage",
      noTemplate: "Keine Vorlage",
      builtIn: "Integriert",
      private: "Privat",
      includeVisualConcepts: "Visuelle Konzepte einschließen",
      includeVisualConceptsHint:
        "Website-Interviews enthalten immer Konzepte. Datenschutz-Interviews enthalten keine. Bei individuellen Interviews ist die Wahl frei.",
      instructionsEyebrow: "Der zentrale Brief",
      instructions: "Interview Instructions",
      instructionsHint:
        "Beschreiben Sie Umfang, Fragen, Einschränkungen und gewünschtes Ergebnis dieses Interviews. Der Brief darf so konkret sein, wie es die Aufgabe erfordert.",
      instructionsPlaceholder:
        "Was soll der Client klären? Welche Entscheidungen soll dieses Interview unterstützen? Was soll das abschließende Project Document enthalten?",
      instructionsGuidance:
        "Strukturieren Sie einen längeren Brief bei Bedarf mit Absätzen, Überschriften oder Aufzählungen. Der Editor wächst mit Ihrem Inhalt.",
      editorHint: "Vorlagen sind optionale Ausgangspunkte.",
      templateStart: "Mit einer Vorlage starten",
      templateStartHint: "Optional – wählen Sie eine Vorlage, um diesen Brief vorauszufüllen.",
      detailsTitle: "Interview-Details",
      detailsHint: "Legen Sie Projektbezeichnung, Sprache und die Einstellung für visuelle Konzepte fest.",
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
        "Interview-Sprache geändert. Ihre bearbeiteten Interviewanweisungen wurden beibehalten.",
      builtInSwitched: "Integrierte Vorlage an die Interview-Sprache angepasst.",
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
      settingsRequiredTitle:
        "Einstellungen vor dem Erstellen eines Interviews vervollständigen",
      settingsRequiredDescription:
        "Ergänzen Sie Ihren öffentlichen Anzeigenamen und Ihre Kontakt-E-Mail. Clients sehen diese Angaben vor dem Start.",
    },
    detail: {
      unavailable: "Interview nicht verfügbar",
      editConfiguration: "Konfiguration bearbeiten",
      delete: "Löschen",
      interviewLink: "Interview-Link",
      linkDescription:
        "Beim ersten Teilen wird ein Pass reserviert. Der Client kann die Willkommensseite ansehen, ohne ihn zu verbrauchen; erst der bewusste Start verbraucht den Pass. Eine Erneuerung überträgt die Reservierung und verbraucht keinen weiteren Pass.",
      linkUnavailable: "Reservieren Sie einen Pass, bevor Sie diesen Link kopieren oder teilen.",
      copied: "Kopiert",
      copyLink: "Link kopieren",
      instructions: "Interview Instructions",
      instructionsDescription:
        "Diese Anweisungen wurden für dieses Interview gespeichert. Kopieren Sie sie, wenn Sie sie wiederverwenden oder prüfen möchten.",
      copyInstructions: "Anweisungen kopieren",
      regenerateLink: "Link erneuern",
      moreActions: "Weitere Link-Aktionen",
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
      exportEverything: "Alles exportieren (ZIP)",
      exportPending:
        "Noch nichts zu exportieren. Exportierbare Inhalte entstehen, während das Interview läuft.",
      retentionSummary: (date: string) =>
        `Datenaufbewahrung: endgültige Löschung am ${date}`,
      retentionDescription: (date: string) =>
        `Dieses Interview wird planmäßig am ${date} endgültig gelöscht. Exportieren Sie vorher alles, was Sie benötigen; die automatische Löschung kann weder rückgängig gemacht noch wiederhergestellt werden.`,
      projectDocument: "Projektdokument",
      documentPending: "Das Projektdokument erscheint nach Abschluss des Interviews.",
      documentFeedbackPrompt: "War dieses Projektdokument hilfreich?",
      feedbackHelpful: "Hilfreich",
      feedbackNotHelpful: "Nicht hilfreich",
      feedbackUp: "Ja",
      feedbackDown: "Eher nicht",
      feedbackThanks: "Danke – Ihr Feedback fließt direkt in Verbesserungen von Prompts und Vorlagen ein.",
      submissionFeedbackPrompt: "Hat Ihnen diese Projektübergabe Zeit gespart?",
      feedbackTitle: "Zwei kurze Fragen",
      feedbackNotePlaceholder: "Was hat funktioniert, was nicht? (optional)",
      saveFeedbackNote: "Notiz speichern",
      visualConcepts: "Visuelle Konzepte",
      generationFailed: "Erstellung fehlgeschlagen",
      generating: "Wird erstellt…",
      roughVisualDirection: "grobe visuelle Richtung",
      conceptPlanningNote: "Planungsnotiz, keine geprüfte Bildbeschreibung",
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
        "Interview-Link, Interview-Transkript, Projektdokument, konfigurierte visuelle Konzepte, wenn enthalten, Projektübergabe und temporäre Exporte werden endgültig gelöscht. Der Zugriff endet sofort. Dies kann weder rückgängig gemacht noch wiederhergestellt werden.",
      language: { en: "Englisch", de: "Deutsch" },
      unavailableConcept: "Nicht verfügbar",
      additionalNote: "Zusätzliche Notiz",
      selectedConcept: "Ausgewähltes Konzept",
      inspirationLinks: "Inspirationslinks",
      reservationTitle: "Für das Interview muss ein Pass reserviert werden",
      reservationDescription:
        "Die Vorbereitung ist kostenlos. Beim ersten Kopieren oder Teilen wird ein Interview-Pass reserviert. Erst der bewusste Start durch den Client verbraucht ihn.",
      reservationReady: "Für dieses Interview ist ein Pass reserviert; der Link ist bereit.",
      reserveAndCopyLink: "1 Pass reservieren und Link kopieren",
      reservationConfirmTitle: "Einen Pass reservieren und diesen Link kopieren?",
      reservationConfirmDescription: (balance: number) =>
        `Sie haben derzeit ${balance} ${balance === 1 ? "verfügbaren Pass" : "verfügbare Pässe"}. Dadurch wird ein Pass reserviert; verbraucht wird er erst beim Start durch den Client.`,
      insufficientBalance:
        "Sie haben keinen verfügbaren Interview-Pass. Kaufen Sie ein Paket, bevor Sie dieses Interview teilen.",
      buyPasses: "Pässe kaufen",
      checkingBalance: "Verfügbare Pässe werden geprüft…",
      deactivateInterview: "Link deaktivieren",
      confirmDeactivate: "Reservierung dieses Interviews freigeben?",
      deactivateDescription:
        "Der reservierte Pass wird Ihrem verfügbaren Bestand wieder gutgeschrieben. Das Interview bleibt bearbeitbar, aber der aktuelle Link ist bis zu einer neuen Reservierung nicht nutzbar.",
    },
    billing: {
      title: "Interview-Pässe",
      intro:
        "Ein Pass bezahlt ein vollständiges Interview nach dem Start durch den Client – einschließlich Gespräch, Dokument, Überarbeitungen, konfigurierten visuellen Konzepten, wenn diese enthalten sind, Übergabe, Speicherung und Downloads.",
      available: "Verfügbare Pässe",
      reserved: "Reservierte Pässe",
      introductory: "Einführungspässe",
      purchased: "Gekaufte Pässe",
      nonExpiring: "Pässe laufen nicht ab.",
      taxes: "inkl. Steuern",
      buyOneTitle: "1 Interview-Pass",
      buyOneDescription: "Ein vollständiges gestartetes Interview",
      buyFiveTitle: "5 Interview-Pässe",
      buyFiveDescription: "Fünf vollständige gestartete Interviews",
      buyFor: (price: string) => `Für ${price} kaufen`,
      redirecting: "Sicherer Checkout wird geöffnet…",
      checkoutError: "Der Checkout konnte nicht geöffnet werden. Bitte versuchen Sie es erneut.",
      successTitle: "Kaufstatus",
      successPending:
        "Die Zahlung wird noch bestätigt. Ihr Pass-Bestand wird nach der signierten Zahlungsbenachrichtigung aktualisiert.",
      successConfirmed: "Zahlung bestätigt. Ihre Interview-Pässe sind verfügbar.",
      successFailed: "Die Zahlung wurde nicht bestätigt. Es wurden keine Pässe hinzugefügt.",
      successRefunded: "Dieser Kauf wurde erstattet und seine Pässe wurden entzogen.",
      successPartialRefund:
        "Dieser Kauf enthält eine teilweise Erstattung und wartet auf Abstimmung.",
      cancelledTitle: "Checkout abgebrochen",
      cancelledDescription: "Es wurden keine Pässe hinzugefügt. Sie können es später erneut versuchen.",
      backToInterviews: "Zurück zu den Interviews",
      backToPasses: "Zurück zu den Pässen",
      loading: "Kaufstatus wird geprüft…",
      unavailable: "Passkäufe sind für diese Bereitstellung noch nicht konfiguriert.",
    },
    settings: {
      title: "Einstellungen",
      intro:
        "Vervollständigen Sie Ihre öffentliche Identität, bevor Sie ein Interview erstellen. Clients sehen Ihren Namen und Ihre Kontakt-E-Mail vor dem Start und nach der Übermittlung.",
      displayName: "Öffentlicher Anzeigename des Creators",
      displayNameHint: "Wird Clients auf dem Startbildschirm und nach der Übermittlung angezeigt.",
      contactEmail: "Kontakt-E-Mail des Creators",
      contactEmailHint: "Wird Clients als Kontaktadresse für dieses Interview angezeigt.",
      privacyPolicyUrl: "URL der Datenschutzerklärung des Creators (optional)",
      privacyPolicyUrlHint: "Optional. Clients können diese Erklärung öffnen, wenn Sie eine URL hinterlegen.",
      improvement: "Interview verbessern helfen",
      improvementHint:
        "Optional. Ermöglicht uns die Auswertung anonymisierter Auszüge Ihrer Vorlagen und Interview Instructions, um Prompts und Vorlagen zu verbessern. Ausschließlich zur Produktverbesserung; Antworten von Clients werden nie ausgewertet.",
      emailHint: "Ihre OAuth-Anmelde-E-Mail bleibt privat und wird Clients nicht automatisch angezeigt.",
      email: "Private OAuth-Anmelde-E-Mail",
      language: "Sprache",
      languageHint:
        "Diese Sprache wird für den Creator-Arbeitsbereich und E-Mail-Benachrichtigungen verwendet.",
      languageOptions: { en: "Englisch", de: "Deutsch" },
      save: "Einstellungen speichern",
      saved: "Einstellungen gespeichert.",
    },
    common: { cancel: "Abbrechen" },
  },
} as const satisfies Record<CreatorLanguage, object>;
