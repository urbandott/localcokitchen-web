import { beforeEach, describe, expect, it, vi } from "vitest";

const orderActionMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUser: vi.fn(),
  revalidatePath: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: orderActionMocks.revalidatePath,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: orderActionMocks.createClient,
}));

import { cancelPendingOrderAction } from "@/features/orders/actions";

const initialState = { ok: false, message: "" };
const orderId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function cancelForm(id = orderId) {
  const formData = new FormData();
  formData.set("orderId", id);
  return formData;
}

describe("order cancellation action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    orderActionMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-id" } },
      error: null,
    });
    orderActionMocks.rpc.mockResolvedValue({ data: true, error: null });
    orderActionMocks.createClient.mockResolvedValue({
      auth: { getUser: orderActionMocks.getUser },
      schema: () => ({ rpc: orderActionMocks.rpc }),
    });
  });

  it("rejects invalid order ids before accessing Supabase", async () => {
    const result = await cancelPendingOrderAction(initialState, cancelForm("not-a-uuid"));

    expect(result.ok).toBe(false);
    expect(orderActionMocks.createClient).not.toHaveBeenCalled();
  });

  it("requires an authenticated user before cancelling", async () => {
    orderActionMocks.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await cancelPendingOrderAction(initialState, cancelForm());

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/sign in/i);
    expect(orderActionMocks.rpc).not.toHaveBeenCalled();
  });

  it("calls the owner-scoped cancellation RPC and revalidates order pages", async () => {
    const result = await cancelPendingOrderAction(initialState, cancelForm());

    expect(result).toEqual({
      ok: true,
      message: "Order cancelled. Reserved inventory has been released.",
    });
    expect(orderActionMocks.rpc).toHaveBeenCalledWith("cancel_own_pending_payment_order", {
      p_order_id: orderId,
    });
    expect(orderActionMocks.revalidatePath).toHaveBeenCalledWith("/profile/orders/");
    expect(orderActionMocks.revalidatePath).toHaveBeenCalledWith(`/profile/orders/${orderId}/`);
  });
});
