import { readFile } from "node:fs/promises";

const requiredCspDirectives = [
  "default-src",
  "script-src",
  "style-src",
  "connect-src",
  "img-src",
  "font-src",
  "object-src",
  "base-uri",
  "form-action",
  "frame-ancestors",
] as const;

const readRequiredFile = async (path: string): Promise<string> => {
  try {
    return await readFile(path, "utf8");
  } catch {
    throw new Error(`Production build is missing ${path}.`);
  }
};

const headerValue = (headers: string, name: string): string | null => {
  const match = headers.match(
    new RegExp(`^\\s*${name}:\\s*(.+)$`, "imu"),
  );
  return match?.[1]?.trim() ?? null;
};

try {
  const [headers, html] = await Promise.all([
    readRequiredFile("dist/_headers"),
    readRequiredFile("dist/index.html"),
  ]);
  const csp = headerValue(headers, "Content-Security-Policy");

  if (!csp) {
    throw new Error("dist/_headers does not define Content-Security-Policy.");
  }
  if (csp.includes("'unsafe-inline'") || csp.includes("*")) {
    throw new Error(
      "Content-Security-Policy must not contain unsafe-inline or wildcard sources.",
    );
  }
  for (const directive of requiredCspDirectives) {
    if (!new RegExp(`(?:^|;)\\s*${directive}\\s`, "u").test(csp)) {
      throw new Error(`Content-Security-Policy is missing ${directive}.`);
    }
  }
  const configuredOrigins = [
    process.env.VITE_CONVEX_URL,
    process.env.VITE_CONVEX_SITE_URL,
  ].flatMap((value) => {
    if (!value) return [];
    const origin = new URL(value).origin;
    return [origin, origin.replace(/^https:/u, "wss:")];
  });
  for (const origin of configuredOrigins) {
    if (!csp.includes(origin)) {
      throw new Error(
        `Content-Security-Policy is missing configured origin ${origin}.`,
      );
    }
  }
  if (headerValue(headers, "Referrer-Policy") !== "no-referrer") {
    throw new Error("Production headers must set Referrer-Policy: no-referrer.");
  }
  if (headerValue(headers, "X-Content-Type-Options") !== "nosniff") {
    throw new Error(
      "Production headers must set X-Content-Type-Options: nosniff.",
    );
  }
  const robotsIndexable = /<meta\s+name=["']robots["']\s+content=["'][^"']*\bindex\b[^"']*\bfollow\b/iu.test(
    html,
  );
  if (!robotsIndexable) {
    throw new Error("Production output must allow the app entry point to be indexed.");
  }
  if (/<style(?:\s|>)/iu.test(html)) {
    throw new Error("Production HTML must not contain inline style blocks.");
  }

  const scriptTags = html.match(/<script\b[^>]*>/giu) ?? [];
  const inlineScript = scriptTags.find((tag) => !/\ssrc=/iu.test(tag));
  if (inlineScript) {
    throw new Error("Production HTML must not contain inline scripts.");
  }

  process.stdout.write("Production security headers and HTML are valid.\n");
} catch (error) {
  const message =
    error instanceof Error ? error.message : "Unknown build validation error.";
  process.stderr.write(`Production build validation failed: ${message}\n`);
  process.exitCode = 1;
}
