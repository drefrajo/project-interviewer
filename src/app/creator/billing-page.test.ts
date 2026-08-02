import { describe, expect, it } from "vitest";
import { creatorCopy } from "./creator-copy";
import { purchaseMessage } from "./billing-page";

describe("Billing success feedback", () => {
  it("keeps an unknown or pending purchase pending and never treats navigation as fulfillment", () => {
    expect(purchaseMessage(undefined, creatorCopy.en.billing)).toBe(
      creatorCopy.en.billing.loading,
    );
    expect(purchaseMessage(null, creatorCopy.en.billing)).toBe(
      creatorCopy.en.billing.successPending,
    );
  });

  it("shows server purchase states without exposing Stripe details", () => {
    expect(
      purchaseMessage(
        {
          purchaseId: "purchase_test",
          packId: "five_passes",
          passCount: 5,
          amountMinor: 9900,
          currency: "eur",
          status: "confirmed",
        },
        creatorCopy.de.billing,
      ),
    ).toBe(creatorCopy.de.billing.successConfirmed);
    expect(creatorCopy.de.billing.successConfirmed).not.toMatch(
      /Stripe|Price|Event|Checkout/i,
    );
  });
});
