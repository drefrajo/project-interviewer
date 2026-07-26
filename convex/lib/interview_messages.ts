import type { ProviderMessage } from "./provider_requests";

export const buildInterviewMessages = (
  policy: string,
  clientLanguage: "de" | "en",
  transcript: ReadonlyArray<ProviderMessage>,
): ProviderMessage[] => [
  { role: "system", content: policy },
  ...(transcript.length === 0
    ? [
        {
          role: "user" as const,
          content:
            clientLanguage === "de"
              ? "Beginne das Interview mit deinen ersten Fragen."
              : "Begin the Interview by asking your first questions.",
        },
      ]
    : transcript),
];
