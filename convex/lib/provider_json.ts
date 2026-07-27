const withoutOuterJsonFence = (content: string) => {
  const match = content.match(
    /^\s*```(?:json)?[^\S\r\n]*\r?\n([\s\S]*?)\r?\n```[^\S\r\n]*\s*$/i,
  );
  return match?.[1] ?? content;
};

export const parseProviderJson = <Value>(content: string): Value =>
  JSON.parse(withoutOuterJsonFence(content)) as Value;

const embeddedJsonObjects = (content: string) => {
  const objects: string[] = [];
  for (let start = 0; start < content.length; start += 1) {
    if (content[start] !== "{") continue;
    let depth = 0;
    let escaped = false;
    let inString = false;
    for (let index = start; index < content.length; index += 1) {
      const character = content[index];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (character === "\\") {
          escaped = true;
        } else if (character === '"') {
          inString = false;
        }
        continue;
      }
      if (character === '"') {
        inString = true;
      } else if (character === "{") {
        depth += 1;
      } else if (character === "}") {
        depth -= 1;
        if (depth === 0) {
          objects.push(content.slice(start, index + 1));
          break;
        }
      }
    }
  }
  return objects;
};

export const parseEmbeddedProviderJson = <Value>(
  content: string,
  accepts: (value: unknown) => value is Value,
): Value => {
  let parseError: unknown = new SyntaxError(
    "Provider response contains no accepted JSON object.",
  );
  try {
    const parsed = parseProviderJson<unknown>(content);
    if (accepts(parsed)) return parsed;
  } catch (error) {
    parseError = error;
  }
  for (const candidate of embeddedJsonObjects(content)) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (accepts(parsed)) return parsed;
    } catch {
      // Keep searching in case an earlier brace was ordinary prose.
    }
  }
  throw parseError;
};
