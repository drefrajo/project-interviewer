import agent from "@convex-dev/agent/convex.config";
import betterAuth from "./betterAuth/convex.config";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";
import { defineApp } from "convex/server";
import { v } from "convex/values";

const app = defineApp({
  env: {
    SITE_URL: v.string(),
    BETTER_AUTH_SECRET: v.string(),
    CAPABILITY_ENCRYPTION_SECRET: v.string(),
    CREATOR_ALLOWLIST: v.string(),
    GOOGLE_CLIENT_ID: v.optional(v.string()),
    GOOGLE_CLIENT_SECRET: v.optional(v.string()),
    GITHUB_CLIENT_ID: v.optional(v.string()),
    GITHUB_CLIENT_SECRET: v.optional(v.string()),
    OPENROUTER_API_KEY: v.optional(v.string()),
    CLOUDFLARE_EMAIL_API_URL: v.optional(v.string()),
    CLOUDFLARE_EMAIL_API_TOKEN: v.optional(v.string()),
    EMAIL_FROM: v.optional(v.string()),
    EMAIL_FROM_NAME: v.optional(v.string()),
    STRIPE_MODE: v.optional(v.string()),
    STRIPE_SECRET_KEY: v.optional(v.string()),
    STRIPE_WEBHOOK_SIGNING_SECRET: v.optional(v.string()),
    STRIPE_ONE_PASS_PRICE_ID: v.optional(v.string()),
    STRIPE_FIVE_PASS_PRICE_ID: v.optional(v.string()),
    STRIPE_CHECKOUT_SUCCESS_URL: v.optional(v.string()),
    STRIPE_CHECKOUT_CANCEL_URL: v.optional(v.string()),
  },
});

app.use(betterAuth);
app.use(agent);
app.use(rateLimiter);

export default app;
