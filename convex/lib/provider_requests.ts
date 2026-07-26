export type ProviderMessage = Readonly<{
  role: "system" | "user" | "assistant";
  content: string;
}>;

const requireSecret = (value: string | undefined, name: string) => {
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
};

const textModelId = (model: "gpt-5.6-terra" | "deepseek-v4-flash") =>
  model === "gpt-5.6-terra"
    ? "openai/gpt-5.6-terra"
    : "deepseek/deepseek-v4-flash";

export const buildOpenRouterTextRequest = (args: {
  apiKey: string | undefined;
  model: "gpt-5.6-terra" | "deepseek-v4-flash";
  messages: ProviderMessage[];
  operation: "interview" | "document" | "concept_prompt" | "translation";
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
        zdr: true,
        allow_fallbacks: false,
        require_parameters: true,
      },
      ...(args.model === "gpt-5.6-terra"
        ? { reasoning: { effort: "medium" } }
        : args.operation === "translation"
          ? { reasoning: { enabled: false } }
          : { reasoning: { enabled: true, effort: "high" } }),
    }),
  } satisfies RequestInit,
});

export const buildOpenRouterImageRequest = (args: {
  apiKey: string | undefined;
  prompt: string;
}) => ({
  url: "https://openrouter.ai/api/v1/images/generations",
  init: {
    method: "POST",
    headers: {
      authorization: `Bearer ${requireSecret(args.apiKey, "OPENROUTER_API_KEY")}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-image-2",
      prompt: args.prompt,
      quality: "medium",
      size: "1536x1024",
      n: 1,
      provider: {
        data_collection: "deny",
        zdr: true,
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
  url: requireSecret(args.apiUrl, "CLOUDFLARE_EMAIL_API_URL"),
  init: {
    method: "POST",
    headers: {
      authorization: `Bearer ${requireSecret(
        args.apiToken,
        "CLOUDFLARE_EMAIL_API_TOKEN",
      )}`,
      "content-type": "application/json",
      "idempotency-key": args.submissionId,
    },
    body: JSON.stringify({
      from: requireSecret(args.from, "EMAIL_FROM"),
      to: [args.to],
      subject: `Project submitted: ${args.projectName}`,
      text: `${args.projectName} was submitted.\n\nOpen the authenticated dashboard: ${args.dashboardUrl}`,
      headers: { "X-Project-Submission-ID": args.submissionId },
    }),
  } satisfies RequestInit,
});
