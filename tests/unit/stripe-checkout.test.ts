import { afterEach, describe, expect, it, vi } from "vitest";
import { createStripeCheckoutSession } from "@/features/payments/stripe-checkout";

describe("Stripe Checkout Session creation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates a hosted Checkout Session with server-derived line items and order metadata", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "cs_test_123",
        url: "https://checkout.stripe.com/c/pay/cs_test_123",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const session = await createStripeCheckoutSession({
      amountCents: 2500,
      cancelUrl: "https://localcokitchen.test/menu?checkout=cancelled",
      currency: "usd",
      customerEmail: "customer@example.com",
      lineItems: [
        { name: " Chicken   biryani ", quantity: 2, unitAmountCents: 1000 },
        { name: "Mango lassi", quantity: 1, unitAmountCents: 500 },
      ],
      orderId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      secretKey: "sk_test_secret_key_that_is_long",
      successUrl: "https://localcokitchen.test/menu?checkout=success",
    });

    expect(session).toEqual({
      id: "cs_test_123",
      url: "https://checkout.stripe.com/c/pay/cs_test_123",
    });
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(request.headers).toMatchObject({
      Authorization: "Bearer sk_test_secret_key_that_is_long",
      "Content-Type": "application/x-www-form-urlencoded",
    });
    const body = request.body as URLSearchParams;
    expect(body.get("mode")).toBe("payment");
    expect(body.get("client_reference_id")).toBe("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    expect(body.get("metadata[order_id]")).toBe("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    expect(body.get("payment_intent_data[metadata][order_id]")).toBe(
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    );
    expect(body.get("line_items[0][price_data][product_data][name]")).toBe("Chicken biryani");
    expect(body.get("line_items[0][quantity]")).toBe("2");
    expect(body.get("line_items[0][price_data][unit_amount]")).toBe("1000");
  });

  it("rejects mismatched totals and invalid redirect URLs before returning to the browser", async () => {
    await expect(
      createStripeCheckoutSession({
        amountCents: 999,
        cancelUrl: "https://localcokitchen.test/menu?checkout=cancelled",
        currency: "usd",
        lineItems: [{ name: "Biryani", quantity: 2, unitAmountCents: 1000 }],
        orderId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        secretKey: "sk_test_secret_key_that_is_long",
        successUrl: "https://localcokitchen.test/menu?checkout=success",
      }),
    ).rejects.toThrow(/line items/i);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: "cs_test_123", url: "https://evil.test/pay" }),
      }),
    );

    await expect(
      createStripeCheckoutSession({
        amountCents: 2000,
        cancelUrl: "https://localcokitchen.test/menu?checkout=cancelled",
        currency: "usd",
        lineItems: [{ name: "Biryani", quantity: 2, unitAmountCents: 1000 }],
        orderId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        secretKey: "sk_test_secret_key_that_is_long",
        successUrl: "https://localcokitchen.test/menu?checkout=success",
      }),
    ).rejects.toThrow(/url/i);
  });
});
