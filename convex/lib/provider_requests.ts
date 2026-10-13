export type ProviderMessage = Readonly<{
  role: "system" | "user" | "assistant";
  content: string;
}>;

const requireSecret = (
  value: string | undefined,
  name: string,
  errorName = "Error",
) => {
  if (!value) {
    const error = new Error(`${name} is not configured.`);
    error.name = errorName;
    throw error;
  }
  return value;
};

export const buildOpenRouterTextRequest = (args: {
  apiKey: string | undefined;
  model: "gpt-6.1-sol";
  messages: ProviderMessage[];
  operation:
    | "interview"
    | "interview_plan"
    | "document"
    | "concept_prompt"
    | "translation";
}) => ({
  url: "https://openrouter.ai/api/v1/chat/completions",
  init: {
    method: "POST",
    headers: {
      authorization: `Bearer ${requireSecret(args.apiKey, "OPENROUTER_API_KEY")}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-6.1-sol",
      messages: args.messages,
      provider: {
        data_collection: "deny",
        zdr: false,
        allow_fallbacks: false,
        require_parameters: true,
      },
      ...(args.operation === "concept_prompt"
        ? { max_tokens: 8192 }
        : args.operation === "interview_plan"
          ? { max_tokens: 1200 }
        : args.operation === "interview"
          ? { max_tokens: 1200 }
          : {}),
      ...(args.operation === "concept_prompt" ||
      args.operation === "interview"
        ? { response_format: { type: "json_object" as const } }
        : {}),
      reasoning: {
        effort: "low",
      },
    }),
  } satisfies RequestInit,
});

export const buildOpenRouterImageRequest = (args: {
  apiKey: string | undefined;
  prompt: string;
}) => ({
  url: "https://openrouter.ai/api/v1/images",
  init: {
    method: "POST",
    headers: {
      authorization: `Bearer ${requireSecret(args.apiKey, "OPENROUTER_API_KEY")}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-image-2.5-flare",
      prompt: args.prompt,
      aspect_ratio: "3:2",
      n: 1,
      quality: "medium",
      provider: {
        data_collection: "deny",
        zdr: false,
        allow_fallbacks: false,
        require_parameters: true,
      },
    }),
  } satisfies RequestInit,
});

export const buildCloudflareEmailRequest = (args: {
  apiUrl: string | undefined;
  apiToken: string | undefined;
  from: string | undefined;
  fromName: string | undefined;
  to: string;
  creatorName: string;
  language: "en" | "de";
  projectName: string;
  dashboardUrl: string;
  submissionId: string;
  includesVisualConcepts?: boolean;
}) => {
  const includesVisualConcepts = args.includesVisualConcepts ?? true;
  const copy =
    args.language === "de"
      ? {
          subject: `Ihre Projektübergabe ist bereit: ${args.projectName}`,
          text: [
            `Hallo ${args.creatorName},`,
            "",
            `der Client hat das Interview für „${args.projectName}“ abgeschlossen und die Projektübergabe übermittelt.`,
            "",
            includesVisualConcepts
              ? "Sie enthält das Projektdokument, die generierten visuellen Konzepte, die ausgewählte visuelle Richtung und das Interview-Transkript."
              : "Sie enthält das Projektdokument und das Interview-Transkript. Es wurden keine visuellen Konzepte erstellt.",
            "",
            "In Ihrem authentifizierten Creator-Workspace öffnen:",
            args.dashboardUrl,
            "",
            "Die Projektübergabe ist abgeschlossen und für den Client schreibgeschützt.",
            "",
            "Viele Grüße",
            "Interview",
          ].join("\n"),
        }
      : {
          subject: `Your Project Submission is ready: ${args.projectName}`,
          text: [
            `Hello ${args.creatorName},`,
            "",
            `The Client has completed the Interview for "${args.projectName}" and submitted the Project Submission.`,
            "",
            includesVisualConcepts
              ? "It includes the Project Document, the generated Visual Concepts, the selected Visual Direction, and the Interview Transcript."
              : "It includes the Project Document and the Interview Transcript. This Interview did not include Visual Concepts.",
            "",
            "Open it in your authenticated Creator workspace:",
            args.dashboardUrl,
            "",
            "The Project Submission is complete and read-only for the Client.",
            "",
            "Best,",
            "Interview",
          ].join("\n"),
        };

  return {
    url: requireSecret(
      args.apiUrl,
      "CLOUDFLARE_EMAIL_API_URL",
      "EMAIL_CONFIGURATION_MISSING",
    ),
    init: {
      method: "POST",
      headers: {
        authorization: `Bearer ${requireSecret(
          args.apiToken,
          "CLOUDFLARE_EMAIL_API_TOKEN",
          "EMAIL_CONFIGURATION_MISSING",
        )}`,
        "content-type": "application/json",
        "idempotency-key": args.submissionId,
      },
      body: JSON.stringify({
        from: {
          address: requireSecret(
            args.from,
            "EMAIL_FROM",
            "EMAIL_CONFIGURATION_MISSING",
          ),
          name: args.fromName?.trim() || "drefrajo | Interview",
        },
        to: [args.to],
        subject: copy.subject,
        text: copy.text,
        headers: { "X-Project-Submission-ID": args.submissionId },
      }),
    } satisfies RequestInit,
  };
};

export const buildRetentionWarningEmailRequest = (args: {
  apiUrl: string | undefined;
  apiToken: string | undefined;
  from: string | undefined;
  fromName: string | undefined;
  to: string;
  creatorName: string;
  language: "en" | "de";
  projectName: string;
  dashboardUrl: string;
  interviewId: string;
  retentionExpiresAt: number;
}) => {
  const deletionDate = new Intl.DateTimeFormat(
    args.language === "de" ? "de-DE" : "en-GB",
    { dateStyle: "long", timeZone: "UTC" },
  ).format(args.retentionExpiresAt);
  const copy =
    args.language === "de"
      ? {
          subject: `Interview wird am ${deletionDate} gelöscht: ${args.projectName}`,
          text: [
            `Hallo ${args.creatorName},`,
            "",
            `das Interview „${args.projectName}“ wird gemäß der Aufbewahrungsfrist am ${deletionDate} automatisch und endgültig gelöscht.`,
            "",
            "Exportieren Sie vorher im Creator-Arbeitsbereich alle Interview-Daten, die Sie weiter benötigen:",
            args.dashboardUrl,
            "",
            "Nach der Löschung kann das Interview nicht wiederhergestellt werden.",
            "",
            "Viele Grüße",
            "Interview",
          ].join("\n"),
        }
      : {
          subject: `Interview will be deleted on ${deletionDate}: ${args.projectName}`,
          text: [
            `Hello ${args.creatorName},`,
            "",
            `The Interview "${args.projectName}" will be automatically and permanently deleted under the retention policy on ${deletionDate}.`,
            "",
            "Before then, export everything you still need from the Creator workspace:",
            args.dashboardUrl,
            "",
            "The Interview cannot be restored after deletion.",
            "",
            "Best,",
            "Interview",
          ].join("\n"),
        };

  return {
    url: requireSecret(
      args.apiUrl,
      "CLOUDFLARE_EMAIL_API_URL",
      "EMAIL_CONFIGURATION_MISSING",
    ),
    init: {
      method: "POST",
      headers: {
        authorization: `Bearer ${requireSecret(
          args.apiToken,
          "CLOUDFLARE_EMAIL_API_TOKEN",
          "EMAIL_CONFIGURATION_MISSING",
        )}`,
        "content-type": "application/json",
        "idempotency-key": `retention-warning:${args.interviewId}:${args.retentionExpiresAt}`,
      },
      body: JSON.stringify({
        from: {
          address: requireSecret(
            args.from,
            "EMAIL_FROM",
            "EMAIL_CONFIGURATION_MISSING",
          ),
          name: args.fromName?.trim() || "drefrajo | Interview",
        },
        to: [args.to],
        subject: copy.subject,
        text: copy.text,
        headers: { "X-Interview-Retention-Warning": args.interviewId },
      }),
    } satisfies RequestInit,
  };
};
