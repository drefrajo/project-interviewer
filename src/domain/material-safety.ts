import type {
  MaterialSegment,
  SourceLocator,
  SuspectedSecret,
} from "./project-material";

interface SecretMatch extends SuspectedSecret {
  value: string;
  sensitiveValues: string[];
}

const credentialPatterns: Array<{ kind: string; pattern: RegExp }> = [
  {
    kind: "named_credential",
    pattern:
      /\b(?:api[_-]?key|access[_-]?token|auth[_-]?token|secret|password)\s*[:=]\s*[^\s,;]+/giu,
  },
  {
    kind: "provider_key",
    pattern: /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9_-]{12,}\b/gu,
  },
  {
    kind: "private_key",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/gu,
  },
];

const highEntropyToken = /\b[A-Za-z0-9+/=_-]{24,}\b/gu;

export const findSuspectedSecrets = (
  segments: MaterialSegment[],
): SecretMatch[] => {
  const matches: SecretMatch[] = [];
  for (const segment of segments) {
    for (const { kind, pattern } of credentialPatterns) {
      for (const match of segment.text.matchAll(pattern)) {
        if (
          !matches.some(
            ({ value, locator }) =>
              sameLocator(locator, segment.locator) &&
              (value.includes(match[0]) || match[0].includes(value)),
          )
        ) {
          matches.push(toMatch(kind, match[0], segment.locator));
        }
      }
    }
    for (const match of segment.text.matchAll(highEntropyToken)) {
      if (
        entropy(match[0]) >= 3.6 &&
        !matches.some(
          ({ value, locator }) =>
            sameLocator(locator, segment.locator) &&
            value.includes(match[0]),
        )
      ) {
        matches.push(toMatch("high_entropy_token", match[0], segment.locator));
      }
    }
  }
  return matches;
};

export const redactSegments = (
  segments: MaterialSegment[],
  matches: SecretMatch[],
  includeSuspectedSecrets: boolean,
): MaterialSegment[] => {
  if (includeSuspectedSecrets) return structuredClone(segments);
  return segments.map((segment) => ({
    ...segment,
    text: matches.reduce(
      (text, match) =>
        sameLocator(segment.locator, match.locator)
          ? text.replaceAll(match.value, "[REDACTED SUSPECTED SECRET]")
          : text,
      segment.text,
    ),
  }));
};

export const publicSuspectedSecrets = (
  matches: SecretMatch[],
): SuspectedSecret[] =>
  matches.map(({ kind, locator, maskedPreview }) => ({
    kind,
    locator,
    maskedPreview,
  }));

export const redactModelText = (
  text: string,
  matches: SecretMatch[],
): string =>
  matches.reduce(
    (redacted, match) =>
      match.sensitiveValues.reduce(
        (value, secret) =>
          value.replaceAll(
            secret,
            "[REDACTED SUSPECTED SECRET]",
          ),
        redacted,
      ),
    text,
  );

const namedCredentialVariants = (value: string): string[] => {
  const separator = assignmentSeparator(value);
  const payload =
    separator >= 0 ? value.slice(separator + 1).trim() : value;
  const unquoted = payload.replace(/^(['"])(.*)\1$/u, "$2");
  return [...new Set([value, payload, unquoted].filter(Boolean))];
};

const toMatch = (
  kind: string,
  value: string,
  locator: SourceLocator,
): SecretMatch => ({
  kind,
  value,
  sensitiveValues:
    kind === "named_credential"
      ? namedCredentialVariants(value)
      : [value],
  locator,
  maskedPreview: mask(kind, value),
});

const mask = (kind: string, value: string): string => {
  const separator =
    kind === "named_credential" ? assignmentSeparator(value) : -1;
  if (kind === "named_credential" && separator >= 0) {
    const prefix = value.slice(0, separator + 1);
    const secret = value.slice(separator + 1);
    return secret.length > 12
      ? `${prefix}${secret.slice(0, 4)}…${secret.slice(-4)}`
      : `${prefix}••••`;
  }
  return value.length > 12
    ? `${value.slice(0, 4)}…${value.slice(-4)}`
    : "••••";
};

const assignmentSeparator = (value: string): number => {
  const candidates = [value.indexOf("="), value.indexOf(":")].filter(
    (index) => index >= 0,
  );
  return candidates.length ? Math.min(...candidates) : -1;
};

const entropy = (value: string): number => {
  const frequencies = new Map<string, number>();
  for (const character of value) {
    frequencies.set(character, (frequencies.get(character) ?? 0) + 1);
  }
  return [...frequencies.values()].reduce((total, count) => {
    const probability = count / value.length;
    return total - probability * Math.log2(probability);
  }, 0);
};

const sameLocator = (left: SourceLocator, right: SourceLocator): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

export const fullTextScore = (query: string, text: string): number => {
  const terms = tokenize(query);
  if (!terms.length) return 0;
  const haystack = tokenize(text);
  return terms.reduce(
    (score, term) => score + haystack.filter((word) => word === term).length,
    0,
  );
};

const tokenize = (value: string): string[] =>
  value.toLocaleLowerCase().match(/[\p{L}\p{N}_-]+/gu) ?? [];

export const cosineSimilarity = (
  left: number[],
  right: number[],
): number => {
  if (!left.length || left.length !== right.length) return 0;
  const dot = left.reduce(
    (sum, value, index) => sum + value * (right[index] ?? 0),
    0,
  );
  const leftNorm = Math.sqrt(left.reduce((sum, value) => sum + value ** 2, 0));
  const rightNorm = Math.sqrt(
    right.reduce((sum, value) => sum + value ** 2, 0),
  );
  return leftNorm && rightNorm ? dot / (leftNorm * rightNorm) : 0;
};
