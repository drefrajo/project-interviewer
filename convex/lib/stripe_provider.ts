import {
  assertApprovedPrice,
  checkoutParametersFor,
  type InterviewPassPack,
  type InterviewPassPackDefinition,
  type StripeConfiguration,
  type StripePriceSnapshot,
} from "./stripe_catalog";

type JsonRecord = Record<string, unknown>;
type FetchLike = typeof fetch;

export class StripeProviderError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string) {
    super("Stripe provider request failed.");
    this.name = "StripeProviderError";
    this.status = status;
    this.code = code;
  }
}

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null;

const idFrom = (value: unknown) => {
  if (typeof value === "string") return value;
  if (isRecord(value) && typeof value.id === "string") return value.id;
  return undefined;
};

const appendFormValue = (
  form: URLSearchParams,
  key: string,
  value: unknown,
) => {
  if (value === undefined || value === null) return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => appendFormValue(form, `${key}[${index}]`, item));
    return;
  }
  if (isRecord(value)) {
    Object.entries(value).forEach(([childKey, childValue]) =>
      appendFormValue(form, `${key}[${childKey}]`, childValue),
    );
    return;
  }
  form.append(key, String(value));
};

export const stripeFormBody = (parameters: JsonRecord) => {
  const form = new URLSearchParams();
  Object.entries(parameters).forEach(([key, value]) =>
    appendFormValue(form, key, value),
  );
  return form.toString();
};

const jsonBody = async (response: Response): Promise<JsonRecord> => {
  let parsed: unknown = null;
  try {
    parsed = await response.json();
  } catch {
    parsed = null;
  }
  if (!isRecord(parsed)) return {};
  return parsed;
};

export type StripeGateway = {
  getAccount(): Promise<{ livemode: boolean }>;
  getPrice(priceId: string): Promise<StripePriceSnapshot>;
  resolveApprovedCatalogItem(
    pack: InterviewPassPackDefinition,
  ): Promise<InterviewPassPack>;
  retrieveCustomer(customerId: string): Promise<{ id: string }>;
  createCustomer(input: {
    email: string;
    name: string;
    creatorProfileId: string;
  }, idempotencyKey: string): Promise<{ id: string }>;
  createCheckoutSession(input: {
    pack: InterviewPassPack;
    purchaseId: string;
    customerId: string;
  }, idempotencyKey: string): Promise<{
    id: string;
    url: string;
    paymentIntentId?: string;
    customerId?: string;
  }>;
};

export const createStripeGateway = (
  configuration: StripeConfiguration,
  fetchImplementation: FetchLike = fetch,
): StripeGateway => {
  const request = async <T extends JsonRecord>(
    method: "GET" | "POST",
    path: string,
    body: JsonRecord | undefined,
    idempotencyKey?: string,
  ): Promise<T> => {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${configuration.secretKey}`,
      "Stripe-Version": configuration.apiVersion,
    };
    const init: RequestInit = { method, headers };
    if (body) {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
      init.body = stripeFormBody(body);
    }
    let response: Response;
    try {
      response = await fetchImplementation(`https://api.stripe.com${path}`, init);
    } catch {
      throw new StripeProviderError(0, "STRIPE_NETWORK_ERROR");
    }
    const parsed = await jsonBody(response);
    if (!response.ok) {
      throw new StripeProviderError(response.status, "STRIPE_API_ERROR");
    }
    return parsed as T;
  };

  const getAccount = async () => {
    const account = await request<{ livemode?: unknown }>(
      "GET",
      "/v1/account",
      undefined,
    );
    if (typeof account.livemode !== "boolean") {
      // Some Managed Payments account responses on Basil omit livemode. The
      // sandbox key prefix is a safe fallback here; the allowlisted Price and
      // Product checks run immediately afterward before any Stripe mutation.
      if (
        configuration.mode === "sandbox" &&
        configuration.secretKey.startsWith("sk_test_")
      ) {
        return { livemode: false };
      }
      throw new StripeProviderError(200, "STRIPE_MODE_UNAVAILABLE");
    }
    if (account.livemode !== (configuration.mode === "live")) {
      throw new StripeProviderError(200, "STRIPE_MODE_MISMATCH");
    }
    return { livemode: account.livemode };
  };

  const getPrice = async (priceId: string) =>
    await request<StripePriceSnapshot>(
      "GET",
      `/v1/prices/${encodeURIComponent(priceId)}`,
      undefined,
    );

  const getPriceByLookupKey = async (lookupKey: string) => {
    const prices = await request<{
      data?: unknown;
    }>(
      "GET",
      `/v1/prices?lookup_keys[]=${encodeURIComponent(lookupKey)}&active=true`,
      undefined,
    );
    if (!Array.isArray(prices.data) || prices.data.length !== 1) {
      throw new StripeProviderError(200, "STRIPE_PRICE_LOOKUP_UNAVAILABLE");
    }
    return prices.data[0] as StripePriceSnapshot;
  };

  const resolveApprovedCatalogItem = async (
    pack: InterviewPassPackDefinition,
  ): Promise<InterviewPassPack> => {
    const price = await getPriceByLookupKey(pack.lookupKey);
    assertApprovedPrice(configuration, pack, price);
    const productId = idFrom(price.product);
    if (!productId) {
      throw new StripeProviderError(200, "STRIPE_PRODUCT_UNAVAILABLE");
    }
    const product = await request<{
      tax_code?: unknown;
      livemode?: unknown;
      active?: unknown;
    }>("GET", `/v1/products/${encodeURIComponent(productId)}`, undefined);
    if (
      product.tax_code !== configuration.taxCode ||
      product.active !== true ||
      product.livemode !== (configuration.mode === "live")
    ) {
      throw new StripeProviderError(200, "STRIPE_CATALOG_MISMATCH");
    }
    return {
      ...pack,
      priceId: price.id,
      productId,
      amountMinor: price.unit_amount!,
    };
  };

  const retrieveCustomer = async (customerId: string) => {
    const customer = await request<{ id?: unknown }>(
      "GET",
      `/v1/customers/${encodeURIComponent(customerId)}`,
      undefined,
    );
    if (typeof customer.id !== "string") {
      throw new StripeProviderError(200, "STRIPE_CUSTOMER_UNAVAILABLE");
    }
    return { id: customer.id };
  };

  const createCustomer = async (
    input: { email: string; name: string; creatorProfileId: string },
    idempotencyKey: string,
  ) => {
    const customer = await request<{ id?: unknown }>(
      "POST",
      "/v1/customers",
      {
        email: input.email,
        name: input.name,
        metadata: { creator_profile_id: input.creatorProfileId },
      },
      idempotencyKey,
    );
    if (typeof customer.id !== "string") {
      throw new StripeProviderError(200, "STRIPE_CUSTOMER_CREATE_FAILED");
    }
    return { id: customer.id };
  };

  const createCheckoutSession = async (
    input: { pack: InterviewPassPack; purchaseId: string; customerId: string },
    idempotencyKey: string,
  ) => {
    const session = await request<{
      id?: unknown;
      url?: unknown;
      payment_intent?: unknown;
      customer?: unknown;
    }>(
      "POST",
      "/v1/checkout/sessions",
      checkoutParametersFor({
        configuration,
        pack: input.pack,
        purchaseId: input.purchaseId,
        customerId: input.customerId,
      }),
      idempotencyKey,
    );
    if (typeof session.id !== "string" || typeof session.url !== "string") {
      throw new StripeProviderError(200, "STRIPE_CHECKOUT_CREATE_FAILED");
    }
    const paymentIntentId = idFrom(session.payment_intent);
    const customerId = idFrom(session.customer);
    return {
      id: session.id,
      url: session.url,
      ...(paymentIntentId ? { paymentIntentId } : {}),
      ...(customerId ? { customerId } : {}),
    };
  };

  return {
    getAccount,
    getPrice,
    resolveApprovedCatalogItem,
    retrieveCustomer,
    createCustomer,
    createCheckoutSession,
  };
};
