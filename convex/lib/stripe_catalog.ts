export type StripeMode = "sandbox" | "live";

export type InterviewPassPack = {
  id: "one_pass" | "five_passes";
  label: string;
  priceId: string;
  passCount: 1 | 5;
  amountMinor: 2900 | 9900;
  currency: "eur";
};

export type StripeConfiguration = {
  mode: StripeMode;
  secretKey: string;
  webhookSigningSecret: string;
  onePassPriceId: string;
  fivePassPriceId: string;
  checkoutSuccessUrl: string;
  checkoutCancelUrl: string;
  apiVersion: "2025-03-31.basil";
  taxCode: "txcd_10105002";
};

type ConfigurationSource = Readonly<{
  STRIPE_MODE?: string | undefined;
  STRIPE_SECRET_KEY?: string | undefined;
  STRIPE_WEBHOOK_SIGNING_SECRET?: string | undefined;
  STRIPE_ONE_PASS_PRICE_ID?: string | undefined;
  STRIPE_FIVE_PASS_PRICE_ID?: string | undefined;
  STRIPE_CHECKOUT_SUCCESS_URL?: string | undefined;
  STRIPE_CHECKOUT_CANCEL_URL?: string | undefined;
}>;

const required = (source: ConfigurationSource, key: keyof ConfigurationSource) => {
  const value = source[key]?.trim();
  if (!value) throw new Error(`Stripe configuration is missing ${key}.`);
  return value;
};

const urlValue = (source: ConfigurationSource, key: keyof ConfigurationSource) => {
  const value = required(source, key);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Stripe configuration contains an invalid ${key}.`);
  }
  if (url.protocol !== "https:" && url.hostname !== "localhost") {
    throw new Error(`Stripe configuration ${key} must use HTTPS.`);
  }
  return value;
};

export const readStripeConfiguration = (
  source: ConfigurationSource,
): StripeConfiguration => {
  const modeValue = required(source, "STRIPE_MODE");
  if (modeValue !== "sandbox" && modeValue !== "live") {
    throw new Error("STRIPE_MODE must be sandbox or live.");
  }
  const secretKey = required(source, "STRIPE_SECRET_KEY");
  const expectedPrefix = modeValue === "sandbox" ? "sk_test_" : "sk_live_";
  if (!secretKey.startsWith(expectedPrefix)) {
    throw new Error("Stripe secret key does not match STRIPE_MODE.");
  }
  const webhookSigningSecret = required(
    source,
    "STRIPE_WEBHOOK_SIGNING_SECRET",
  );
  if (!webhookSigningSecret.startsWith("whsec_")) {
    throw new Error("Stripe webhook signing secret is invalid.");
  }
  const onePassPriceId = required(source, "STRIPE_ONE_PASS_PRICE_ID");
  const fivePassPriceId = required(source, "STRIPE_FIVE_PASS_PRICE_ID");
  if (
    !onePassPriceId.startsWith("price_") ||
    !fivePassPriceId.startsWith("price_") ||
    onePassPriceId === fivePassPriceId
  ) {
    throw new Error("Stripe Price IDs must be two distinct price IDs.");
  }
  return {
    mode: modeValue,
    secretKey,
    webhookSigningSecret,
    onePassPriceId,
    fivePassPriceId,
    checkoutSuccessUrl: urlValue(source, "STRIPE_CHECKOUT_SUCCESS_URL"),
    checkoutCancelUrl: urlValue(source, "STRIPE_CHECKOUT_CANCEL_URL"),
    apiVersion: "2025-03-31.basil",
    taxCode: "txcd_10105002",
  };
};

export const packsFor = (
  configuration: Pick<
    StripeConfiguration,
    "onePassPriceId" | "fivePassPriceId"
  >,
): readonly InterviewPassPack[] => [
  {
    id: "one_pass",
    label: "1 Interview Pass",
    priceId: configuration.onePassPriceId,
    passCount: 1,
    amountMinor: 2900,
    currency: "eur",
  },
  {
    id: "five_passes",
    label: "5 Interview Passes",
    priceId: configuration.fivePassPriceId,
    passCount: 5,
    amountMinor: 9900,
    currency: "eur",
  },
];

export const packForId = (
  configuration: Pick<
    StripeConfiguration,
    "onePassPriceId" | "fivePassPriceId"
  >,
  packId: string,
) => {
  const pack = packsFor(configuration).find((candidate) => candidate.id === packId);
  if (!pack) throw new Error("Unknown Interview Pass pack.");
  return pack;
};

export const packForPriceId = (
  configuration: Pick<
    StripeConfiguration,
    "onePassPriceId" | "fivePassPriceId"
  >,
  priceId: string,
) => {
  const pack = packsFor(configuration).find(
    (candidate) => candidate.priceId === priceId,
  );
  if (!pack) throw new Error("Stripe Price ID is not allowlisted.");
  return pack;
};

const withPurchaseQuery = (base: string, purchaseId: string, session = false) => {
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}purchase_id=${encodeURIComponent(purchaseId)}${
    session ? "&checkout_session_id={CHECKOUT_SESSION_ID}" : ""
  }`;
};

export const checkoutParametersFor = (input: {
  configuration: StripeConfiguration;
  pack: InterviewPassPack;
  purchaseId: string;
  customerId: string;
}) => ({
  mode: "payment" as const,
  line_items: [{ price: input.pack.priceId, quantity: 1 }],
  managed_payments: { enabled: true },
  customer: input.customerId,
  success_url: withPurchaseQuery(
    input.configuration.checkoutSuccessUrl,
    input.purchaseId,
    true,
  ),
  cancel_url: withPurchaseQuery(
    input.configuration.checkoutCancelUrl,
    input.purchaseId,
  ),
  client_reference_id: input.purchaseId,
  metadata: {
    purchase_id: input.purchaseId,
    pack_id: input.pack.id,
  },
});

export type StripePriceSnapshot = {
  id: string;
  active: boolean;
  livemode: boolean;
  currency: string;
  unit_amount: number | null;
  type?: string;
  recurring?: unknown;
  product: string | { id: string };
};

export const assertApprovedPrice = (
  configuration: Pick<StripeConfiguration, "mode" | "taxCode">,
  pack: InterviewPassPack,
  price: StripePriceSnapshot,
) => {
  if (price.id !== pack.priceId) throw new Error("Stripe Price ID mismatch.");
  if (price.livemode !== (configuration.mode === "live")) {
    throw new Error("Stripe Price mode does not match deployment mode.");
  }
  if (
    !price.active ||
    price.currency !== pack.currency ||
    price.unit_amount !== pack.amountMinor ||
    (price.recurring !== undefined && price.recurring !== null) ||
    (price.type !== undefined && price.type !== "one_time")
  ) {
    throw new Error("Stripe Price does not match the approved Interview Pass pack.");
  }
};
