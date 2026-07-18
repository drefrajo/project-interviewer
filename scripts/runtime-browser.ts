import { access } from "node:fs/promises";

export const requireRuntimeVariable = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required runtime verification variable: ${name}`);
  }
  return value;
};

export const runtimeBaseUrl = (): string => {
  const value = requireRuntimeVariable("RUNTIME_BASE_URL");
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error("RUNTIME_BASE_URL must use http or https.");
  }
  return url.toString().replace(/\/$/u, "");
};

export const runtimeStorageStatePath = (): string =>
  process.env.RUNTIME_FREELANCER_STORAGE_STATE?.trim() ||
  ".scratch/runtime/freelancer-storage-state.json";

export const resolveBrowserExecutable = async (): Promise<string> => {
  const candidates = [
    process.env.BROWSER_EXECUTABLE_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next explicitly supported browser path.
    }
  }
  throw new Error(
    "A Chromium browser is required. Set BROWSER_EXECUTABLE_PATH to Chrome, Edge, or Chromium.",
  );
};
