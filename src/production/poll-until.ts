export const pollUntil = async <Value>(options: {
  attempts: number;
  intervalMs: number;
  load: () => Promise<Value>;
  isComplete: (value: Value) => boolean;
  delay?: (milliseconds: number) => Promise<void>;
}): Promise<Value> => {
  if (options.attempts < 1) {
    throw new Error("Polling requires at least one attempt.");
  }
  const delay =
    options.delay ??
    ((milliseconds: number) =>
      new Promise<void>((resolve) =>
        window.setTimeout(resolve, milliseconds),
      ));
  let value = await options.load();
  for (let attempt = 1; attempt < options.attempts; attempt += 1) {
    if (options.isComplete(value)) return value;
    await delay(options.intervalMs);
    value = await options.load();
  }
  return value;
};
