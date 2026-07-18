import type { AuthConfig } from "convex/server";

const convexSiteUrl =
  process.env.CONVEX_SITE_URL ?? "http://127.0.0.1:3211";

export default {
  providers: [
    {
      domain: convexSiteUrl,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
