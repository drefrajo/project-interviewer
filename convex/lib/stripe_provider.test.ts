import { describe, expect, it } from "vitest";
import {
  createStripeGateway,
  type StripeGateway,
} from "./stripe_provider";
import { readStripeConfiguration, packForId } from "./stripe_catalog";

const configuration = readStripeConfiguration({
  STRIPE_MODE: "sandbox",
  STRIPE_SECRET_KEY: "sk_test_sandbox-key",
  STRIPE_WEBHOOK_SIGNING_SECRET: "whsec_sandbox-secret",
  STRIPE_ONE_PASS_LOOKUP_KEY: "interview_pass_one",
  STRIPE_FIVE_PASS_LOOKUP_KEY: "interview_pass_five",
  STRIPE_CHECKOUT_SUCCESS_URL: "https://example.test/billing/success",
  STRIPE_CHECKOUT_CANCEL_URL: "https://example.test/billing/cancel",
});

describe("Stripe provider boundary", () => {
  it("resolves the current lookup-key Price and uses server-owned checkout parameters", async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const responses = [
      { id: "acct_sandbox", object: "account", livemode: false },
      {
        data: [
          {
            id: "price_one_sandbox",
            lookup_key: "interview_pass_one",
            active: true,
            livemode: false,
            currency: "eur",
            unit_amount: 2900,
            type: "one_time",
            recurring: null,
            product: "prod_one_sandbox",
          },
        ],
      },
      { tax_code: "txcd_10105002", active: true, livemode: false },
      { id: "cus_sandbox" },
      {
        id: "cs_sandbox",
        url: "https://checkout.stripe.com/c/pay/cs_sandbox",
        payment_intent: "pi_sandbox",
        customer: "cus_sandbox",
      },
    ];
    const fakeFetch: typeof fetch = async (input, init) => {
      requests.push({ url: String(input), init: init ?? {} });
      const response = responses.shift();
      if (!response) throw new Error("Unexpected fake Stripe request.");
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const gateway: StripeGateway = createStripeGateway(
      configuration,
      fakeFetch,
    );
    const definition = packForId(configuration, "one_pass");

    await expect(gateway.getAccount()).resolves.toEqual({ livemode: false });
    const pack = await gateway.resolveApprovedCatalogItem(definition);
    expect(pack).toMatchObject({
      priceId: "price_one_sandbox",
      amountMinor: 2900,
      passCount: 1,
    });
    await expect(
      gateway.retrieveCustomer("cus_sandbox"),
    ).resolves.toEqual({ id: "cus_sandbox" });
    await expect(
      gateway.createCheckoutSession(
        {
          pack,
          purchaseId: "purchase_sandbox",
          customerId: "cus_sandbox",
        },
        "checkout:purchase_sandbox",
      ),
    ).resolves.toMatchObject({
      id: "cs_sandbox",
      url: "https://checkout.stripe.com/c/pay/cs_sandbox",
      paymentIntentId: "pi_sandbox",
    });

    const accountHeaders = new Headers(requests[0]?.init.headers);
    expect(accountHeaders.get("Authorization")).toBe(
      "Bearer sk_test_sandbox-key",
    );
    expect(accountHeaders.get("Stripe-Version")).toBe("2025-03-31.basil");
    expect(requests[1]?.url).toContain(
      "/v1/prices?lookup_keys[]=interview_pass_one",
    );
    const checkout = new URLSearchParams(
      String(requests.at(-1)?.init.body ?? ""),
    );
    expect(checkout.get("mode")).toBe("payment");
    expect(checkout.get("line_items[0][price]")).toBe("price_one_sandbox");
    expect(checkout.get("line_items[0][quantity]")).toBe("1");
    expect(checkout.get("managed_payments[enabled]")).toBe("true");
    expect(checkout.get("metadata[purchase_id]")).toBe("purchase_sandbox");
    expect(new Headers(requests.at(-1)?.init.headers).get("Idempotency-Key")).toBe(
      "checkout:purchase_sandbox",
    );
  });

  it("never contacts Stripe when a gateway is not invoked", () => {
    const fakeFetch = async () => {
      throw new Error("The provider fake must be injected by the caller.");
    };
    expect(typeof createStripeGateway(configuration, fakeFetch).getAccount).toBe(
      "function",
    );
  });

  it("uses the validated live key prefix when the account response omits livemode", async () => {
    const liveConfiguration = readStripeConfiguration({
      STRIPE_MODE: "live",
      STRIPE_SECRET_KEY: "sk_live_sandbox-key",
      STRIPE_WEBHOOK_SIGNING_SECRET: "whsec_live-secret",
      STRIPE_ONE_PASS_LOOKUP_KEY: "interview_pass_one",
      STRIPE_FIVE_PASS_LOOKUP_KEY: "interview_pass_five",
      STRIPE_CHECKOUT_SUCCESS_URL: "https://example.test/billing/success",
      STRIPE_CHECKOUT_CANCEL_URL: "https://example.test/billing/cancel",
    });
    const fakeFetch: typeof fetch = async () =>
      new Response(JSON.stringify({ id: "acct_live", object: "account" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    await expect(
      createStripeGateway(liveConfiguration, fakeFetch).getAccount(),
    ).resolves.toEqual({ livemode: true });
  });
});
