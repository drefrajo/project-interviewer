import type { Doc } from "../_generated/dataModel";

type SupportedEventType = Doc<"stripeEvents">["eventType"];
type JsonRecord = Record<string, unknown>;
export type StripeWebhookEvent = {
  eventId: string;
  eventType: SupportedEventType;
  objectId: string;
  livemode?: boolean;
  purchaseId?: string;
  paymentStatus?: string;
  sessionStatus?: string;
  paymentIntentId?: string;
  customerId?: string;
  chargeId?: string;
  amount?: number;
  amountRefunded?: number;
  disputeStatus?: string;
  lookupKey?: string;
  priceId?: string;
  productId?: string;
  priceActive?: boolean;
  priceCurrency?: string;
  priceUnitAmount?: number;
};

const supportedEventTypes = new Set<SupportedEventType>([
  "price.created",
  "price.updated",
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "charge.refunded",
  "refund.created",
  "charge.dispute.created",
  "charge.dispute.closed",
  "charge.dispute.funds_reinstated",
  "charge.dispute.funds_withdrawn",
]);

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null;

const stringValue = (value: unknown) =>
  typeof value === "string" && value.trim() ? value : undefined;

const idValue = (value: unknown) => {
  if (typeof value === "string") return value;
  if (isRecord(value)) return stringValue(value.id);
  return undefined;
};

const numberValue = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const hexToBytes = (hex: string) => {
  if (!/^[0-9a-f]+$/iu.test(hex) || hex.length % 2 !== 0) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
};

const constantTimeEqual = (left: Uint8Array, right: Uint8Array) => {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index]! ^ right[index]!;
  }
  return difference === 0;
};

const rawBytes = (body: string | ArrayBuffer | Uint8Array) => {
  if (typeof body === "string") return new TextEncoder().encode(body);
  if (body instanceof Uint8Array) return body;
  return new Uint8Array(body);
};

export const verifyStripeSignature = async (
  body: string | ArrayBuffer | Uint8Array,
  signatureHeader: string,
  secret: string,
  now = Date.now(),
  toleranceSeconds = 300,
) => {
  const parts = signatureHeader.split(",").map((part) => part.trim());
  const timestampPart = parts.find((part) => part.startsWith("t="));
  const timestamp = Number(timestampPart?.slice(2));
  if (!Number.isInteger(timestamp)) throw new Error("Invalid Stripe signature.");
  if (Math.abs(Math.floor(now / 1000) - timestamp) > toleranceSeconds) {
    throw new Error("Expired Stripe signature.");
  }
  const signatures = parts
    .filter((part) => part.startsWith("v1="))
    .map((part) => hexToBytes(part.slice(3)))
    .filter((value): value is Uint8Array => value !== null);
  if (signatures.length === 0) throw new Error("Invalid Stripe signature.");
  const message = new Uint8Array(
    new TextEncoder().encode(`${timestamp}.`).length + rawBytes(body).length,
  );
  const prefix = new TextEncoder().encode(`${timestamp}.`);
  message.set(prefix, 0);
  message.set(rawBytes(body), prefix.length);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = new Uint8Array(await crypto.subtle.sign("HMAC", key, message));
  if (!signatures.some((candidate) => constantTimeEqual(expected, candidate))) {
    throw new Error("Invalid Stripe signature.");
  }
  return true as const;
};

export const parseStripeWebhookEvent = (rawBody: string): StripeWebhookEvent => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw new Error("Invalid Stripe webhook body.");
  }
  if (!isRecord(parsed) || typeof parsed.id !== "string" || !isRecord(parsed.data)) {
    throw new Error("Invalid Stripe webhook event.");
  }
  const eventType = parsed.type;
  if (
    typeof eventType !== "string" ||
    !supportedEventTypes.has(eventType as SupportedEventType)
  ) {
    throw new Error("Unsupported Stripe webhook event.");
  }
  const object = parsed.data.object;
  if (!isRecord(object)) throw new Error("Invalid Stripe webhook object.");
  // Checkout's server-owned client_reference_id is the only browser-independent
  // purchase link accepted here. Arbitrary metadata is never an authorization
  // source; refund/dispute events resolve through stored Stripe identifiers.
  const purchaseId = stringValue(object.client_reference_id);
  const dispute = isRecord(object.dispute) ? object.dispute : object;
  const paymentStatus = stringValue(object.payment_status);
  const sessionStatus = stringValue(object.status);
  const paymentIntentId = idValue(object.payment_intent);
  const customerId = idValue(object.customer);
  const chargeId = idValue(object.charge);
  const amount = numberValue(object.amount);
  const amountRefunded = numberValue(object.amount_refunded);
  const disputeStatus = stringValue(dispute.status);
  const lookupKey = stringValue(object.lookup_key);
  const priceId = stringValue(object.id);
  const productId = idValue(object.product);
  const priceActive =
    typeof object.active === "boolean" ? object.active : undefined;
  const priceCurrency = stringValue(object.currency);
  const priceUnitAmount = numberValue(object.unit_amount);
  const livemode = typeof parsed.livemode === "boolean" ? parsed.livemode : undefined;
  return {
    eventId: parsed.id,
    eventType: eventType as SupportedEventType,
    objectId: stringValue(object.id) ?? parsed.id,
    ...(livemode !== undefined ? { livemode } : {}),
    ...(purchaseId ? { purchaseId } : {}),
    ...(paymentStatus ? { paymentStatus } : {}),
    ...(sessionStatus ? { sessionStatus } : {}),
    ...(paymentIntentId ? { paymentIntentId } : {}),
    ...(customerId ? { customerId } : {}),
    ...(chargeId ? { chargeId } : {}),
    ...(amount !== undefined ? { amount } : {}),
    ...(amountRefunded !== undefined ? { amountRefunded } : {}),
    ...(disputeStatus ? { disputeStatus } : {}),
    ...(lookupKey ? { lookupKey } : {}),
    ...(eventType.startsWith("price.") && priceId ? { priceId } : {}),
    ...(productId ? { productId } : {}),
    ...(priceActive !== undefined ? { priceActive } : {}),
    ...(priceCurrency ? { priceCurrency } : {}),
    ...(priceUnitAmount !== undefined ? { priceUnitAmount } : {}),
  };
};
