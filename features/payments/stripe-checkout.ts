export type StripeCheckoutLineItem = {
  name: string;
  quantity: number;
  unitAmountCents: number;
};

export type StripeCheckoutSessionRequest = {
  amountCents: number;
  cancelUrl: string;
  customerEmail?: string | null;
  currency: "usd";
  lineItems: StripeCheckoutLineItem[];
  orderId: string;
  secretKey: string;
  successUrl: string;
};

export type StripeCheckoutSession = {
  id: string;
  url: string;
};

function safeProductName(name: string): string {
  const normalized = name.replace(/\s+/g, " ").trim();
  return normalized.slice(0, 120) || "LocalCoKitchen item";
}

function appendLineItem(
  body: URLSearchParams,
  item: StripeCheckoutLineItem,
  index: number,
  currency: "usd",
) {
  if (!Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 10) {
    throw new Error("Invalid checkout item quantity.");
  }
  if (!Number.isSafeInteger(item.unitAmountCents) || item.unitAmountCents <= 0) {
    throw new Error("Invalid checkout item amount.");
  }

  const prefix = `line_items[${index}]`;
  body.set(`${prefix}[quantity]`, String(item.quantity));
  body.set(`${prefix}[price_data][currency]`, currency);
  body.set(`${prefix}[price_data][unit_amount]`, String(item.unitAmountCents));
  body.set(`${prefix}[price_data][product_data][name]`, safeProductName(item.name));
}

export async function createStripeCheckoutSession(
  request: StripeCheckoutSessionRequest,
): Promise<StripeCheckoutSession> {
  if (!request.secretKey) throw new Error("Stripe secret key is not configured.");
  if (!request.lineItems.length || request.lineItems.length > 50) {
    throw new Error("Checkout requires between 1 and 50 items.");
  }
  if (!Number.isSafeInteger(request.amountCents) || request.amountCents <= 0) {
    throw new Error("Checkout amount is invalid.");
  }

  const lineTotal = request.lineItems.reduce(
    (sum, item) => sum + item.quantity * item.unitAmountCents,
    0,
  );
  if (lineTotal !== request.amountCents) {
    throw new Error("Checkout line items do not match the order total.");
  }

  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.set("success_url", request.successUrl);
  body.set("cancel_url", request.cancelUrl);
  body.set("client_reference_id", request.orderId);
  body.set("metadata[order_id]", request.orderId);
  body.set("payment_intent_data[metadata][order_id]", request.orderId);
  body.set("payment_method_types[0]", "card");
  body.set("expires_at", String(Math.floor(Date.now() / 1000) + 30 * 60));
  if (request.customerEmail) body.set("customer_email", request.customerEmail);

  request.lineItems.forEach((item, index) => appendLineItem(body, item, index, request.currency));

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${request.secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error("Stripe Checkout Session could not be created.");
  }
  if (!payload || typeof payload !== "object") {
    throw new Error("Stripe Checkout Session response was invalid.");
  }

  const session = payload as Record<string, unknown>;
  if (typeof session.id !== "string" || typeof session.url !== "string") {
    throw new Error("Stripe Checkout Session response was incomplete.");
  }
  const sessionUrl = new URL(session.url);
  if (sessionUrl.protocol !== "https:" || sessionUrl.hostname !== "checkout.stripe.com") {
    throw new Error("Stripe Checkout Session URL was invalid.");
  }

  return { id: session.id, url: sessionUrl.toString() };
}
