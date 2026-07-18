import { findSuspectedSecrets } from "./material-safety";

export interface SafeSharedResourceInput {
  label: string;
  url?: string;
  note?: string;
  accountIdentifier?: string;
}

export const normalizeSafeSharedResource = (
  input: SafeSharedResourceInput,
):
  | { accepted: true; value: SafeSharedResourceInput }
  | { accepted: false; reason: string } => {
  const label = input.label.trim();
  const url = input.url?.trim() || undefined;
  const note = input.note?.trim() || undefined;
  const accountIdentifier = input.accountIdentifier?.trim() || undefined;
  if (!label || (!url && !note)) {
    return {
      accepted: false,
      reason:
        "A Shared Resource needs a label and a URL or non-secret note.",
    };
  }
  if (url) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return {
        accepted: false,
        reason: "Shared Resource URLs must be valid HTTP or HTTPS links.",
      };
    }
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return {
        accepted: false,
        reason: "Shared Resource URLs must be valid HTTP or HTTPS links.",
      };
    }
    const secretQueryName =
      /^(?:api[-_]?key|access[-_]?token|auth[-_]?token|password|passwd|pwd|secret|token)$/iu;
    if (
      parsed.password ||
      [...parsed.searchParams].some(
        ([name, value]) => value.trim() && secretQueryName.test(name),
      )
    ) {
      return {
        accepted: false,
        reason:
          "Shared Resource URLs cannot contain passwords, API keys, tokens, or other secrets.",
      };
    }
  }
  const combined = [label, url, note, accountIdentifier]
    .filter(Boolean)
    .join("\n");
  if (
    findSuspectedSecrets([
      {
        text: combined,
        locator: {
          kind: "paragraph",
          label: "Shared Resource",
          paragraph: 1,
        },
      },
    ]).length
  ) {
    return {
      accepted: false,
      reason:
        "Shared Resources cannot contain passwords, API keys, tokens, or other suspected secrets.",
    };
  }
  return {
    accepted: true,
    value: {
      label,
      ...(url ? { url } : {}),
      ...(note ? { note } : {}),
      ...(accountIdentifier ? { accountIdentifier } : {}),
    },
  };
};
