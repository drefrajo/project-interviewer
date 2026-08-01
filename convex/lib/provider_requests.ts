export type ProviderMessage = Readonly<{
  role: "system" | "user" | "assistant";
  content: string;
}>;

export type ConceptImageModel =
  | "gpt-image-2"
  | "gpt-image-2-low"
  | "nano-banana-2"
  | "nano-banana-2-lite";

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

const textModelId = (model: "gpt-5.6-terra" | "deepseek-v4-flash") =>
  model === "gpt-5.6-terra"
    ? "openai/gpt-5.6-terra"
    : "deepseek/deepseek-v4-flash-0731";

export const buildOpenRouterTextRequest = (args: {
  apiKey: string | undefined;
  model: "gpt-5.6-terra" | "deepseek-v4-flash";
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
      model: textModelId(args.model),
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
      ...(args.model === "gpt-5.6-terra"
        ? {
            reasoning: {
              effort: args.operation === "interview" ? "low" : "medium",
            },
          }
        : args.operation === "translation" || args.operation === "interview"
          ? { reasoning: { enabled: false } }
          : args.operation === "concept_prompt"
            ? { reasoning: { enabled: true, effort: "medium" } }
          : args.operation === "interview_plan"
            ? { reasoning: { enabled: true, effort: "high" } }
            : { reasoning: { enabled: true, effort: "high" } }),
    }),
  } satisfies RequestInit,
});

export const buildOpenRouterImageRequest = (args: {
  apiKey: string | undefined;
  imageModel: ConceptImageModel;
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
      model:
        args.imageModel === "nano-banana-2"
          ? "google/gemini-3.1-flash-image"
          : args.imageModel === "nano-banana-2-lite"
            ? "google/gemini-3.1-flash-lite-image"
            : "openai/gpt-image-2",
      prompt: args.prompt,
      aspect_ratio: "3:2",
      n: 1,
      ...(args.imageModel === "nano-banana-2" ||
      args.imageModel === "nano-banana-2-lite"
        ? {}
        : {
            quality: args.imageModel === "gpt-image-2-low" ? "low" : "medium",
          }),
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
  to: string;
  projectName: string;
  dashboardUrl: string;
  submissionId: string;
}) => ({
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
      from: requireSecret(
        args.from,
        "EMAIL_FROM",
        "EMAIL_CONFIGURATION_MISSING",
      ),
      to: [args.to],
      subject: `Project submitted: ${args.projectName}`,
      text: `${args.projectName} was submitted.\n\nOpen the authenticated dashboard: ${args.dashboardUrl}`,
      headers: { "X-Project-Submission-ID": args.submissionId },
    }),
  } satisfies RequestInit,
});
