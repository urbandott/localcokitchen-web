import { beforeEach, describe, expect, it, vi } from "vitest";

const checkoutMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUser: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: checkoutMocks.createClient,
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
    checkoutMocks.getUser.mockResolvedValue({
      data: { user: { id: "customer-id" } },
      error: null,
    });
    checkoutMocks.rpc.mockResolvedValue({
      data: [
        {
          order_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          subtotal_cents: 2500,
          item_count: 3,
        },
      ],
      error: null,
    });
    checkoutMocks.createClient.mockResolvedValue({
      auth: { getUser: checkoutMocks.getUser },
      schema: () => ({ rpc: checkoutMocks.rpc }),
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

  it("normalizes duplicate cart rows and delegates final validation to the database RPC", async () => {
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
      message: "Order created. Payment confirmation will be added in the next checkout step.",
      orderId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      subtotalCents: 2500,
      itemCount: 3,
    });
    expect(checkoutMocks.rpc).toHaveBeenCalledWith("create_customer_checkout_order", {
      p_cart: [
        { id: itemId, quantity: 5 },
        { id: secondItemId, quantity: 1 },
      ],
    });
  });
});
