import { beforeEach, describe, expect, it, vi } from "vitest";

const adminOrderMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  eq: vi.fn(),
  from: vi.fn(),
  inFilter: vi.fn(),
  limit: vi.fn(),
  order: vi.fn(),
  select: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: adminOrderMocks.createClient,
}));

import { listAdminOrders } from "@/features/admin/admin-data";

const orderId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const customerId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const cookId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function queryResult(data: unknown) {
  const result = { data, error: null };
  const query = {
    in: adminOrderMocks.inFilter.mockImplementation(() => query),
    limit: adminOrderMocks.limit.mockImplementation(() => Promise.resolve(result)),
    order: adminOrderMocks.order.mockImplementation(() => query),
    select: adminOrderMocks.select.mockImplementation(() => query),
    then: (resolve: (value: unknown) => void) => resolve(result),
  };
  return query;
}

describe("admin order data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminOrderMocks.from.mockImplementation((table: string) => {
      if (table === "customer_orders") {
        return queryResult([
          {
            cancelled_at: null,
            created_at: "2026-07-08T01:00:00.000Z",
            currency: "usd",
            customer_id: customerId,
            expires_at: "2026-07-08T01:15:00.000Z",
            id: orderId,
            paid_at: "2026-07-08T01:02:00.000Z",
            status: "paid",
            subtotal_cents: 2500,
            updated_at: "2026-07-08T01:02:00.000Z",
          },
        ]);
      }
      if (table === "customer_order_items") {
        return queryResult([
          {
            cook_id: cookId,
            created_at: "2026-07-08T01:00:00.000Z",
            fulfilled_at: null,
            fulfillment_status: "pending",
            id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            item_name: "Chicken biryani",
            line_total_cents: 2500,
            menu_item_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
            order_id: orderId,
            quantity: 2,
            unit_price_cents: 1250,
          },
        ]);
      }
      if (table === "customer_payment_attempts") {
        return queryResult([
          {
            amount_cents: 2500,
            created_at: "2026-07-08T01:01:00.000Z",
            currency: "usd",
            order_id: orderId,
            provider: "stripe",
            status: "succeeded",
            updated_at: "2026-07-08T01:02:00.000Z",
          },
        ]);
      }
      if (table === "users") {
        return queryResult([
          {
            email: "customer@example.com",
            first_name: "Ada",
            full_name: null,
            id: customerId,
            last_name: "Lovelace",
          },
          {
            email: "cook@example.com",
            first_name: "Cook",
            full_name: "Cook Name",
            id: cookId,
            last_name: "User",
          },
        ]);
      }
      if (table === "cook_profiles") {
        return queryResult([{ cook_id: cookId, display_name: "Asha's Kitchen" }]);
      }
      throw new Error(`Unexpected table ${table}`);
    });
    adminOrderMocks.createClient.mockResolvedValue({
      schema: () => ({ from: adminOrderMocks.from }),
    });
  });

  it("aggregates recent orders with safe customer, cook, item, and payment state", async () => {
    const result = await listAdminOrders();

    expect(result.error).toBeNull();
    expect(result.orders).toHaveLength(1);
    expect(result.orders[0]?.customer?.email).toBe("customer@example.com");
    expect(result.orders[0]?.latestPayment).toMatchObject({
      provider: "stripe",
      status: "succeeded",
    });
    expect(result.orders[0]?.items[0]).toMatchObject({
      cookDisplayName: "Asha's Kitchen",
      item_name: "Chicken biryani",
    });
    expect(JSON.stringify(result.orders)).not.toMatch(/provider_reference|payload|secret/i);
  });
});
