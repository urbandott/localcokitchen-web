import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  parseStripePaymentWebhookEvent,
  verifyStripeWebhookSignature,
} from "@/features/payments/stripe-webhook";

const webhookMocks = vi.hoisted(() => ({
  createPrivilegedClient: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/privileged", () => ({
  createPrivilegedClient: webhookMocks.createPrivilegedClient,
}));

import { POST } from "@/app/api/webhooks/stripe/route";

function signatureHeader(rawBody: string, secret: string, timestamp = 1_800_000_000) {
  const digest = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  return `t=${timestamp},v1=${digest}`;
}

describe("Stripe webhook helpers", () => {
  it("verifies valid signatures and rejects invalid or stale signatures", () => {
    const rawBody = JSON.stringify({ id: "evt_123" });
    const secret = "whsec_test_secret";
    const signature = signatureHeader(rawBody, secret);

    expect(
      verifyStripeWebhookSignature({
        rawBody,
        signatureHeader: signature,
        secret,
        nowSeconds: 1_800_000_010,
      }),
    ).toBe(true);
    expect(
      verifyStripeWebhookSignature({
        rawBody,
        signatureHeader: `${signature}0`,
        secret,
        nowSeconds: 1_800_000_010,
      }),
    ).toBe(false);
    expect(
      verifyStripeWebhookSignature({
        rawBody,
        signatureHeader: signature,
        secret,
        nowSeconds: 1_800_001_000,
      }),
    ).toBe(false);
  });

  it("parses payment intent and checkout session payment events", () => {
    expect(
      parseStripePaymentWebhookEvent({
        id: "evt_pi",
        type: "payment_intent.succeeded",
        data: {
          object: {
            id: "pi_123",
            object: "payment_intent",
            amount_received: 2500,
            currency: "usd",
            metadata: { order_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
          },
        },
      }),
    ).toEqual({
      amountCents: 2500,
      currency: "usd",
      eventId: "evt_pi",
      eventType: "payment_intent.succeeded",
      orderId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      paymentStatus: "succeeded",
      providerReference: "pi_123",
    });

    expect(
      parseStripePaymentWebhookEvent({
        id: "evt_checkout",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_123",
            object: "checkout.session",
            payment_intent: "pi_456",
            payment_status: "paid",
            amount_total: 1500,
            currency: "usd",
            metadata: { order_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" },
          },
        },
      })?.providerReference,
    ).toBe("pi_456");
  });
});

describe("Stripe webhook route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable-key-that-is-long";
    process.env.SUPABASE_SECRET_KEY = "server-secret-key-that-is-long";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";
    webhookMocks.rpc.mockResolvedValue({ data: [{ processed: true }], error: null });
    webhookMocks.createPrivilegedClient.mockReturnValue({
      schema: () => ({ rpc: webhookMocks.rpc }),
    });
  });

  it("rejects invalid signatures before parsing or touching Supabase", async () => {
    const response = await POST(
      new Request("https://local.test/api/webhooks/stripe", {
        method: "POST",
        body: JSON.stringify({ id: "evt_bad" }),
        headers: { "stripe-signature": "t=1,v1=bad" },
      }),
    );

    expect(response.status).toBe(400);
    expect(webhookMocks.createPrivilegedClient).not.toHaveBeenCalled();
  });

  it("records valid supported payment events through the payment RPC", async () => {
    const rawBody = JSON.stringify({
      id: "evt_paid",
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_paid",
          object: "payment_intent",
          amount_received: 2500,
          currency: "usd",
          metadata: { order_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
        },
      },
    });

    const response = await POST(
      new Request("https://local.test/api/webhooks/stripe", {
        method: "POST",
        body: rawBody,
        headers: {
          "stripe-signature": signatureHeader(
            rawBody,
            "whsec_test_secret",
            Math.floor(Date.now() / 1000),
          ),
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(webhookMocks.rpc).toHaveBeenCalledWith(
      "record_payment_webhook_event",
      expect.objectContaining({
        p_provider: "stripe",
        p_provider_event_id: "evt_paid",
        p_provider_reference: "pi_paid",
        p_payment_status: "succeeded",
        p_amount_cents: 2500,
      }),
    );
  });
});
