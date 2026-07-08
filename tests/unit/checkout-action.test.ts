import { beforeEach, describe, expect, it, vi } from "vitest";

const checkoutMocks = vi.hoisted(() => ({
  createCheckoutSession: vi.fn(),
  createClient: vi.fn(),
  eq: vi.fn(),
  from: vi.fn(),
  getUser: vi.fn(),
  rpc: vi.fn(),
  select: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: checkoutMocks.createClient,
}));

vi.mock("@/features/payments/stripe-checkout", () => ({
  createStripeCheckoutSession: checkoutMocks.createCheckoutSession,
}));

import { createCheckoutOrderAction } from "@/features/checkout/actions";

const initialState = { ok: false, message: "" };
const itemId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const secondItemId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function checkoutForm(cart: unknown) {
  const formData = new FormData();
  formData.set("cart", JSON.stringify(cart));
  return formData;
}

describe("checkout order action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SITE_URL = "https://localcokitchen.test";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable-key-that-is-long";
    process.env.STRIPE_SECRET_KEY = "sk_test_secret_key_that_is_long";
    checkoutMocks.getUser.mockResolvedValue({
      data: { user: { id: "customer-id", email: "customer@example.com" } },
      error: null,
    });
    checkoutMocks.rpc.mockImplementation((name: string) => {
      if (name === "create_customer_checkout_order") {
        return Promise.resolve({
          data: [
            {
              order_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
              subtotal_cents: 2500,
              item_count: 3,
            },
          ],
          error: null,
        });
      }
      return Promise.resolve({ data: "payment-attempt-id", error: null });
    });
    checkoutMocks.eq.mockResolvedValue({
      data: [
        { item_name: "Chicken biryani", quantity: 2, unit_price_cents: 1000 },
        { item_name: "Mango lassi", quantity: 1, unit_price_cents: 500 },
      ],
      error: null,
    });
    checkoutMocks.select.mockReturnValue({ eq: checkoutMocks.eq });
    checkoutMocks.from.mockReturnValue({ select: checkoutMocks.select });
    checkoutMocks.createCheckoutSession.mockResolvedValue({
      id: "cs_test_123",
      url: "https://checkout.stripe.com/c/pay/cs_test_123",
    });
    checkoutMocks.createClient.mockResolvedValue({
      auth: { getUser: checkoutMocks.getUser },
      schema: () => ({ from: checkoutMocks.from, rpc: checkoutMocks.rpc }),
    });
  });

  it("rejects malformed cart JSON before accessing Supabase", async () => {
    const formData = new FormData();
    formData.set("cart", "{not-json");

    const result = await createCheckoutOrderAction(initialState, formData);

    expect(result.ok).toBe(false);
    expect(checkoutMocks.createClient).not.toHaveBeenCalled();
  });

  it("rejects invalid quantities before checkout RPC", async () => {
    const result = await createCheckoutOrderAction(
      initialState,
      checkoutForm([{ id: itemId, quantity: 11 }]),
    );

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/quantity/i);
    expect(checkoutMocks.createClient).not.toHaveBeenCalled();
  });

  it("requires an authenticated user before creating an order", async () => {
    checkoutMocks.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await createCheckoutOrderAction(
      initialState,
      checkoutForm([{ id: itemId, quantity: 2 }]),
    );

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/sign in/i);
    expect(checkoutMocks.rpc).not.toHaveBeenCalled();
  });

  it("normalizes duplicate cart rows, creates a Stripe session, and records the payment attempt", async () => {
    const result = await createCheckoutOrderAction(
      initialState,
      checkoutForm([
        { id: itemId, quantity: 2 },
        { id: itemId, quantity: 3 },
        { id: secondItemId, quantity: 1 },
      ]),
    );

    expect(result).toEqual({
      ok: true,
      message: "Redirecting you to secure payment…",
      orderId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      redirectUrl: "https://checkout.stripe.com/c/pay/cs_test_123",
      subtotalCents: 2500,
      itemCount: 3,
    });
    expect(checkoutMocks.rpc).toHaveBeenCalledWith("create_customer_checkout_order", {
      p_cart: [
        { id: itemId, quantity: 5 },
        { id: secondItemId, quantity: 1 },
      ],
    });
    expect(checkoutMocks.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        amountCents: 2500,
        customerEmail: "customer@example.com",
        lineItems: [
          { name: "Chicken biryani", quantity: 2, unitAmountCents: 1000 },
          { name: "Mango lassi", quantity: 1, unitAmountCents: 500 },
        ],
        orderId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      }),
    );
    expect(checkoutMocks.rpc).toHaveBeenCalledWith("create_checkout_session_payment_attempt", {
      p_amount_cents: 2500,
      p_currency: "usd",
      p_order_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      p_provider_reference: "cs_test_123",
    });
  });

  it("does not create an order when Stripe checkout is not configured", async () => {
    delete process.env.STRIPE_SECRET_KEY;

    const result = await createCheckoutOrderAction(
      initialState,
      checkoutForm([{ id: itemId, quantity: 2 }]),
    );

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/payment checkout is not configured/i);
    expect(checkoutMocks.rpc).not.toHaveBeenCalled();
  });
});
