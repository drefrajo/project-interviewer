import { describe, expect, it } from "vitest";
import {
  assertApprovedPrice,
  packForId,
  packForPriceId,
  packsFor,
  readStripeConfiguration,
  type StripeConfiguration,
} from "./stripe_catalog";

const configuration = readStripeConfiguration({
  STRIPE_MODE: "sandbox",
  STRIPE_SECRET_KEY: "sk_test_sandbox-key",
  STRIPE_WEBHOOK_SIGNING_SECRET: "whsec_sandbox-secret",
  STRIPE_ONE_PASS_PRICE_ID: "price_one_sandbox",
  STRIPE_FIVE_PASS_PRICE_ID: "price_five_sandbox",
  STRIPE_CHECKOUT_SUCCESS_URL: "https://example.test/billing/success",
  STRIPE_CHECKOUT_CANCEL_URL: "https://example.test/billing/cancel",
});

describe("Stripe Managed Payments catalog boundary", () => {
  it("defines exactly the two server-owned one-time EUR packs", () => {
    expect(packsFor(configuration)).toEqual([
      expect.objectContaining({
        id: "one_pass",
        priceId: "price_one_sandbox",
        passCount: 1,
        amountMinor: 2900,
        currency: "eur",
      }),
      expect.objectContaining({
        id: "five_passes",
        priceId: "price_five_sandbox",
        passCount: 5,
        amountMinor: 9900,
        currency: "eur",
      }),
    ]);
  });

  it("rejects arbitrary pack IDs and Price IDs", () => {
    expect(() => packForId(configuration, "twenty_passes")).toThrow(
      "Unknown Interview Pass pack",
    );
    expect(() => packForPriceId(configuration, "price_client_supplied")).toThrow(
      "not allowlisted",
    );
  });

  it("rejects mode, amount, currency, and recurring-price mismatches", () => {
    const pack = packForId(configuration, "one_pass");
    const valid = {
      id: pack.priceId,
      active: true,
      livemode: false,
      currency: "eur",
      unit_amount: 2900,
      type: "one_time",
      recurring: null,
      product: "prod_one_sandbox",
    } as const;
    expect(() =>
      assertApprovedPrice(configuration, pack, valid),
    ).not.toThrow();
    expect(() =>
      assertApprovedPrice(configuration, pack, { ...valid, livemode: true }),
    ).toThrow("mode");
    expect(() =>
      assertApprovedPrice(configuration, pack, { ...valid, unit_amount: 2901 }),
    ).toThrow("approved Interview Pass pack");
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
        STRIPE_ONE_PASS_PRICE_ID: configuration.onePassPriceId,
        STRIPE_FIVE_PASS_PRICE_ID: configuration.fivePassPriceId,
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
