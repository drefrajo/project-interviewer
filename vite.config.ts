import { readFile, writeFile } from "node:fs/promises";
import {
  defineConfig,
  loadEnv,
  type Plugin,
  type PluginOption,
} from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const exactProductionHeaders = (
  convexCloudUrl: string,
  convexSiteUrl: string,
): Plugin => ({
  name: "exact-production-headers",
  apply: "build",
  async writeBundle(options) {
    const outputDirectory =
      typeof options.dir === "string" ? options.dir : "dist";
    const headersPath = `${outputDirectory}/_headers`;
    const cloudOrigin = new URL(convexCloudUrl).origin;
    const siteOrigin = new URL(convexSiteUrl).origin;
    const cloudSocketOrigin = cloudOrigin.replace(/^https:/u, "wss:");
    const siteSocketOrigin = siteOrigin.replace(/^https:/u, "wss:");
    const headers = await readFile(headersPath, "utf8");
    const exactHeaders = headers
      .replaceAll("https://*.convex.cloud", cloudOrigin)
      .replaceAll("https://*.convex.site", siteOrigin)
      .replaceAll("wss://*.convex.cloud", cloudSocketOrigin)
      .replaceAll("wss://*.convex.site", siteSocketOrigin);
    await writeFile(headersPath, exactHeaders);
  },
});

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), "");
  const plugins: PluginOption[] = [react(), tailwindcss()];

  if (mode === "production") {
    plugins.push(
      exactProductionHeaders(
        environment.VITE_CONVEX_URL ?? "",
        environment.VITE_CONVEX_SITE_URL ?? "",
      ),
    );
  }

  return {
    plugins,
    build: {
      target: "es2022",
      sourcemap: mode !== "production",
    },
  };
});
