import { beforeEach, describe, expect, it, vi } from "vitest";

const cookOrderMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  eq: vi.fn(),
  from: vi.fn(),
  maybeSingle: vi.fn(),
  rpc: vi.fn(),
  select: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: cookOrderMocks.createClient,
}));

import { getCookOrdersDashboard } from "@/features/kitchen/cook-orders-data";

describe("cook orders data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookOrderMocks.maybeSingle.mockResolvedValue({
      data: { status: "approved" },
      error: null,
    });
    cookOrderMocks.rpc.mockResolvedValue({
      data: [
        {
          fulfillment_status: "pending",
          item_name: "Chicken biryani",
          line_total_cents: 2500,
          order_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          order_item_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          order_status: "paid",
          quantity: 2,
          unit_price_cents: 1250,
        },
      ],
      error: null,
    });
    cookOrderMocks.eq.mockReturnValue({ maybeSingle: cookOrderMocks.maybeSingle });
    cookOrderMocks.select.mockReturnValue({ eq: cookOrderMocks.eq });
    cookOrderMocks.from.mockReturnValue({ select: cookOrderMocks.select });
    cookOrderMocks.createClient.mockResolvedValue({
      schema: () => ({
        from: cookOrderMocks.from,
        rpc: cookOrderMocks.rpc,
      }),
    });
  });

  it("loads application status and delegates safe order visibility to the cook RPC", async () => {
    const result = await getCookOrdersDashboard("cook-id");

    expect(result.error).toBeNull();
    expect(result.application?.status).toBe("approved");
    expect(result.orderItems).toHaveLength(1);
    expect(cookOrderMocks.from).toHaveBeenCalledWith("cook_applications");
    expect(cookOrderMocks.eq).toHaveBeenCalledWith("user_id", "cook-id");
    expect(cookOrderMocks.rpc).toHaveBeenCalledWith("list_own_cook_order_items");
  });
});
