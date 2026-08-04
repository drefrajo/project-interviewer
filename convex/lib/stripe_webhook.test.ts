import { describe, expect, it } from "vitest";
import {
  parseStripeWebhookEvent,
  verifyStripeSignature,
} from "./stripe_webhook";

const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

const signedHeader = async (body: string, timestamp: number, secret: string) => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${body}`),
  );
  return `t=${timestamp}, v1=${hex(new Uint8Array(signature))}`;
};

describe("Stripe webhook boundary", () => {
  it("verifies the exact raw body and parses only sanitized fields", async () => {
    const secret = "whsec_test_secret";
    const timestamp = 1_700_000_000;
    const body = JSON.stringify({
      id: "evt_paid",
      type: "checkout.session.completed",
      livemode: false,
      data: {
        object: {
          id: "cs_paid",
          client_reference_id: "purchase_123",
          payment_status: "paid",
          payment_intent: "pi_123",
          customer: "cus_123",
          metadata: { purchase_id: "purchase_123", arbitrary: "ignored" },
        },
      },
      secret_client_content: "must not be persisted",
    });
    const header = await signedHeader(body, timestamp, secret);
    await expect(
      verifyStripeSignature(body, header, secret, timestamp * 1000),
    ).resolves.toBe(true);
    await expect(
      verifyStripeSignature(
        `${body} `,
        header,
        secret,
        timestamp * 1000,
      ),
    ).rejects.toThrow("Invalid Stripe signature");

    expect(parseStripeWebhookEvent(body)).toEqual({
      eventId: "evt_paid",
      eventType: "checkout.session.completed",
      objectId: "cs_paid",
      livemode: false,
      purchaseId: "purchase_123",
      paymentStatus: "paid",
      paymentIntentId: "pi_123",
      customerId: "cus_123",
    });
  });

  it("rejects invalid, expired, and unsupported events before application mutation", async () => {
    await expect(
      verifyStripeSignature("{}", "t=1700000000,v1=00", "whsec_test", 1_700_000_000_000),
    ).rejects.toThrow("Invalid Stripe signature");
    await expect(
      verifyStripeSignature(
        "{}",
        "t=1,v1=00",
        "whsec_test",
        1_700_000_000_000,
      ),
    ).rejects.toThrow("Expired Stripe signature");
    expect(() =>
      parseStripeWebhookEvent(
        JSON.stringify({ id: "evt_unknown", type: "customer.created", data: { object: {} } }),
      ),
    ).toThrow("Unsupported Stripe webhook event");
  });

  it("sanitizes Stripe Price updates for catalog refresh without persisting payloads", () => {
    const event = parseStripeWebhookEvent(
      JSON.stringify({
        id: "evt_price_updated",
        type: "price.updated",
        livemode: false,
        data: {
          object: {
            id: "price_replacement",
            lookup_key: "interview_pass_one",
            active: true,
            currency: "eur",
            unit_amount: 3100,
            product: "prod_one",
            secret: "must not be persisted",
          },
        },
      }),
    );
    expect(event).toEqual({
      eventId: "evt_price_updated",
      eventType: "price.updated",
      objectId: "price_replacement",
      livemode: false,
      lookupKey: "interview_pass_one",
      priceId: "price_replacement",
      productId: "prod_one",
      priceActive: true,
      priceCurrency: "eur",
      priceUnitAmount: 3100,
    });
  });
});
