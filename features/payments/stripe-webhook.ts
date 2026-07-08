import { createHmac, timingSafeEqual } from "node:crypto";

export type StripePaymentWebhookEvent = {
  amountCents: number | null;
  currency: string;
  eventId: string;
  eventType: string;
  orderId: string | null;
  paymentStatus: "succeeded" | "failed" | "canceled" | "processing" | "requires_action";
  providerReference: string;
};

function parseSignatureHeader(signatureHeader: string): {
  timestamp: string;
  signatures: string[];
} {
  const parts = signatureHeader.split(",").map((part) => part.trim());
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2) ?? "";
  const signatures = parts
    .filter((part) => part.startsWith("v1="))
    .map((part) => part.slice(3))
    .filter(Boolean);
  return { timestamp, signatures };
}

export function verifyStripeWebhookSignature(params: {
  rawBody: string;
  signatureHeader: string | null;
  secret: string | undefined;
  toleranceSeconds?: number;
  nowSeconds?: number;
}): boolean {
  if (!params.signatureHeader || !params.secret) return false;

  const { timestamp, signatures } = parseSignatureHeader(params.signatureHeader);
  const timestampNumber = Number(timestamp);
  if (!Number.isSafeInteger(timestampNumber) || signatures.length === 0) return false;

  const nowSeconds = params.nowSeconds ?? Math.floor(Date.now() / 1000);
  const toleranceSeconds = params.toleranceSeconds ?? 300;
  if (Math.abs(nowSeconds - timestampNumber) > toleranceSeconds) return false;

  const expected = createHmac("sha256", params.secret)
    .update(`${timestamp}.${params.rawBody}`, "utf8")
    .digest("hex");

  return signatures.some((signature) => {
    if (!/^[a-f0-9]+$/i.test(signature) || signature.length % 2 !== 0) return false;
    const expectedBuffer = Buffer.from(expected, "hex");
    const receivedBuffer = Buffer.from(signature, "hex");
    return (
      expectedBuffer.length === receivedBuffer.length &&
      timingSafeEqual(expectedBuffer, receivedBuffer)
    );
  });
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) ? value : null;
}

function metadataOrderId(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  return stringValue((metadata as Record<string, unknown>).order_id);
}

export function parseStripePaymentWebhookEvent(payload: unknown): StripePaymentWebhookEvent | null {
  if (!payload || typeof payload !== "object") return null;
  const event = payload as Record<string, unknown>;
  const eventId = stringValue(event.id);
  const eventType = stringValue(event.type);
  const data = event.data;
  const object = data && typeof data === "object" ? (data as Record<string, unknown>).object : null;
  if (!eventId || !eventType || !object || typeof object !== "object") return null;

  const paymentObject = object as Record<string, unknown>;
  const objectType = paymentObject.object;

  if (objectType === "payment_intent") {
    const providerReference = stringValue(paymentObject.id);
    if (!providerReference) return null;

    const status =
      eventType === "payment_intent.succeeded"
        ? "succeeded"
        : eventType === "payment_intent.payment_failed"
          ? "failed"
          : eventType === "payment_intent.canceled"
            ? "canceled"
            : eventType === "payment_intent.processing"
              ? "processing"
              : eventType === "payment_intent.requires_action"
                ? "requires_action"
                : null;
    if (!status) return null;

    return {
      amountCents: numberValue(paymentObject.amount_received) ?? numberValue(paymentObject.amount),
      currency: stringValue(paymentObject.currency)?.toLowerCase() ?? "usd",
      eventId,
      eventType,
      orderId: metadataOrderId(paymentObject.metadata),
      paymentStatus: status,
      providerReference,
    };
  }

  if (objectType === "checkout.session") {
    const sessionId = stringValue(paymentObject.id);
    if (!sessionId) return null;

    const paymentStatus =
      eventType === "checkout.session.completed" && paymentObject.payment_status === "paid"
        ? "succeeded"
        : eventType === "checkout.session.expired"
          ? "canceled"
          : null;
    if (!paymentStatus) return null;

    return {
      amountCents: numberValue(paymentObject.amount_total),
      currency: stringValue(paymentObject.currency)?.toLowerCase() ?? "usd",
      eventId,
      eventType,
      orderId: metadataOrderId(paymentObject.metadata),
      paymentStatus,
      providerReference: sessionId,
    };
  }

  return null;
}
