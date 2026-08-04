import { describe, expect, it } from "vitest";
import {
  assertApprovedPrice,
  packForId,
  packForLookupKey,
  packsFor,
  readStripeConfiguration,
  type StripeConfiguration,
} from "./stripe_catalog";

const configuration = readStripeConfiguration({
  STRIPE_MODE: "sandbox",
  STRIPE_SECRET_KEY: "sk_test_sandbox-key",
  STRIPE_WEBHOOK_SIGNING_SECRET: "whsec_sandbox-secret",
  STRIPE_ONE_PASS_LOOKUP_KEY: "interview_pass_one",
  STRIPE_FIVE_PASS_LOOKUP_KEY: "interview_pass_five",
  STRIPE_CHECKOUT_SUCCESS_URL: "https://example.test/billing/success",
  STRIPE_CHECKOUT_CANCEL_URL: "https://example.test/billing/cancel",
});

describe("Stripe Managed Payments catalog boundary", () => {
  it("defines exactly two server-owned one-time EUR pack identities", () => {
    expect(packsFor(configuration)).toEqual([
      expect.objectContaining({
        id: "one_pass",
        lookupKey: "interview_pass_one",
        passCount: 1,
        currency: "eur",
      }),
      expect.objectContaining({
        id: "five_passes",
        lookupKey: "interview_pass_five",
        passCount: 5,
        currency: "eur",
      }),
    ]);
    expect(packsFor(configuration)).toHaveLength(2);
  });

  it("rejects arbitrary pack IDs and lookup keys", () => {
    expect(() => packForId(configuration, "twenty_passes")).toThrow(
      "Unknown Interview Pass pack",
    );
    expect(() => packForLookupKey(configuration, "client_supplied")).toThrow(
      "not allowlisted",
    );
  });

  it("accepts a current Stripe Price regardless of its replacement amount", () => {
    const pack = packForId(configuration, "one_pass");
    const valid = {
      id: "price_replacement_sandbox",
      lookup_key: pack.lookupKey,
      active: true,
      livemode: false,
      currency: "eur",
      unit_amount: 3100,
      type: "one_time",
      recurring: null,
      product: "prod_one_sandbox",
    } as const;
    expect(() => assertApprovedPrice(configuration, pack, valid)).not.toThrow();
    expect(() =>
      assertApprovedPrice(configuration, pack, { ...valid, livemode: true }),
    ).toThrow("mode");
    expect(() =>
      assertApprovedPrice(configuration, pack, {
        ...valid,
        lookup_key: "unapproved",
      }),
    ).toThrow("lookup key");
    expect(() =>
      assertApprovedPrice(configuration, pack, {
        ...valid,
        recurring: { interval: "month" },
      }),
    ).toThrow("approved Interview Pass pack");
  });

  it("fails closed when sandbox and live credentials are mixed", () => {
    expect(() =>
      readStripeConfiguration({
        STRIPE_MODE: "live",
        STRIPE_SECRET_KEY: configuration.secretKey,
        STRIPE_WEBHOOK_SIGNING_SECRET: configuration.webhookSigningSecret,
        STRIPE_ONE_PASS_LOOKUP_KEY: configuration.onePassLookupKey,
        STRIPE_FIVE_PASS_LOOKUP_KEY: configuration.fivePassesLookupKey,
        STRIPE_CHECKOUT_SUCCESS_URL: configuration.checkoutSuccessUrl,
        STRIPE_CHECKOUT_CANCEL_URL: configuration.checkoutCancelUrl,
      }),
    ).toThrow("does not match");
  });

  it("pins the Managed Payments API version and provisional tax classification", () => {
    expect(configuration.apiVersion).toBe("2025-03-31.basil");
    expect(configuration.taxCode).toBe("txcd_10105002");
  });
});

void (configuration satisfies StripeConfiguration);
