import { beforeEach, describe, expect, it, vi } from "vitest";

const cookOrderActionMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUser: vi.fn(),
  revalidatePath: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: cookOrderActionMocks.revalidatePath,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: cookOrderActionMocks.createClient,
}));

import { updateCookOrderItemFulfillmentAction } from "@/features/kitchen/cook-order-actions";

const initialState = { ok: false, message: "" };
const orderItemId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function fulfillmentForm(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set("orderItemId", orderItemId);
  formData.set("status", "ready");
  for (const [key, value] of Object.entries(overrides)) formData.set(key, value);
  return formData;
}

describe("cook order fulfillment action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookOrderActionMocks.getUser.mockResolvedValue({
      data: { user: { id: "cook-id" } },
      error: null,
    });
    cookOrderActionMocks.rpc.mockResolvedValue({ data: true, error: null });
    cookOrderActionMocks.createClient.mockResolvedValue({
      auth: { getUser: cookOrderActionMocks.getUser },
      schema: () => ({ rpc: cookOrderActionMocks.rpc }),
    });
  });

  it("rejects invalid ids and statuses before Supabase access", async () => {
    const result = await updateCookOrderItemFulfillmentAction(
      initialState,
      fulfillmentForm({ orderItemId: "not-a-uuid", status: "paid" }),
    );

    expect(result.ok).toBe(false);
    expect(cookOrderActionMocks.createClient).not.toHaveBeenCalled();
  });

  it("requires an authenticated cook before updating fulfillment", async () => {
    cookOrderActionMocks.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await updateCookOrderItemFulfillmentAction(initialState, fulfillmentForm());

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/sign in/i);
    expect(cookOrderActionMocks.rpc).not.toHaveBeenCalled();
  });

  it("calls the owner-scoped fulfillment RPC and revalidates kitchen orders", async () => {
    const result = await updateCookOrderItemFulfillmentAction(
      initialState,
      fulfillmentForm({ status: "fulfilled" }),
    );

    expect(result).toEqual({ ok: true, message: "Order item updated." });
    expect(cookOrderActionMocks.rpc).toHaveBeenCalledWith(
      "update_own_cook_order_item_fulfillment",
      {
        p_fulfillment_status: "fulfilled",
        p_order_item_id: orderItemId,
      },
    );
    expect(cookOrderActionMocks.revalidatePath).toHaveBeenCalledWith("/my-kitchen/orders/");
  });
});
