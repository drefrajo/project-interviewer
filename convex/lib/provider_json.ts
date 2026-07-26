const withoutOuterJsonFence = (content: string) => {
  const match = content.match(
    /^\s*```(?:json)?[^\S\r\n]*\r?\n([\s\S]*?)\r?\n```[^\S\r\n]*\s*$/i,
  );
  return match?.[1] ?? content;
};

export const parseProviderJson = <Value>(content: string): Value =>
  JSON.parse(withoutOuterJsonFence(content)) as Value;
