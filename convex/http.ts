import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";
import { env, httpAction } from "./_generated/server";
import { internalRefs } from "./internal_refs";
import {
  parseStripeWebhookEvent,
  type StripeWebhookEvent,
  verifyStripeSignature,
} from "./lib/stripe_webhook";

const http = httpRouter();

authComponent.registerRoutesLazy(http, createAuth, { cors: true });

http.route({
  path: "/stripe/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const signature = request.headers.get("stripe-signature");
    const secret = env.STRIPE_WEBHOOK_SIGNING_SECRET;
    const mode = env.STRIPE_MODE;
    if (
      !secret ||
      !signature ||
      (mode !== "sandbox" && mode !== "live")
    ) {
      return new Response("Webhook is not configured.", { status: 503 });
    }
    const bytes = await request.arrayBuffer();
    const rawBody = new TextDecoder().decode(bytes);
    let event: StripeWebhookEvent;
    try {
      await verifyStripeSignature(bytes, signature, secret);
      event = parseStripeWebhookEvent(rawBody);
    } catch {
      return new Response("Invalid webhook.", { status: 400 });
    }
    if (event.livemode === undefined || event.livemode !== (mode === "live")) {
      return new Response("Invalid webhook.", { status: 400 });
    }
    await ctx.runMutation(internalRefs.billing.handleWebhook, { event });
    return new Response(null, { status: 200 });
  }),
});

export default http;
