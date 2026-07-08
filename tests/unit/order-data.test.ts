import { beforeEach, describe, expect, it, vi } from "vitest";

const orderMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  eq: vi.fn(),
  from: vi.fn(),
  inFilter: vi.fn(),
  limit: vi.fn(),
  maybeSingle: vi.fn(),
  order: vi.fn(),
  select: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: orderMocks.createClient,
}));

import {
  customerOrderStatusCopy,
  getCustomerOrderDetails,
  listCustomerOrders,
} from "@/features/orders/order-data";

const order = {
  cancelled_at: null,
  created_at: "2026-07-08T01:00:00.000Z",
  currency: "usd",
  customer_id: "user-id",
  expires_at: "2026-07-08T01:15:00.000Z",
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  paid_at: null,
  status: "pending_payment",
  subtotal_cents: 2500,
  updated_at: "2026-07-08T01:00:00.000Z",
};

describe("customer order data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const makeQuery = (result: unknown) => {
      const query = {
        eq: orderMocks.eq.mockImplementation(() => query),
        in: orderMocks.inFilter.mockImplementation(() => query),
        limit: orderMocks.limit.mockImplementation(() => query),
        maybeSingle: orderMocks.maybeSingle.mockResolvedValue(result),
        order: orderMocks.order.mockImplementation(() => query),
        select: orderMocks.select.mockImplementation(() => query),
        then: (resolve: (value: unknown) => void) => resolve(result),
      };
      return query;
    };
    orderMocks.from.mockImplementation((table: string) => {
      if (table === "customer_orders") return makeQuery({ data: [order], error: null });
      return makeQuery({ data: [], error: null });
    });
    orderMocks.createClient.mockResolvedValue({
      schema: () => ({ from: orderMocks.from }),
    });
  });

  it("rejects invalid order ids before querying", async () => {
    const result = await getCustomerOrderDetails("user-id", "not-a-uuid");

    expect(result).toEqual({ error: "Order not found.", order: null });
    expect(orderMocks.createClient).not.toHaveBeenCalled();
  });

  it("lists only the authenticated customer's orders", async () => {
    const result = await listCustomerOrders("user-id");

    expect(result.orders).toHaveLength(1);
    expect(orderMocks.from).toHaveBeenCalledWith("customer_orders");
    expect(orderMocks.eq).toHaveBeenCalledWith("customer_id", "user-id");
  });

  it("uses clear status copy for paid, pending, failed, and cancelled payment states", () => {
    expect(customerOrderStatusCopy("paid", "succeeded").label).toBe("Paid");
    expect(customerOrderStatusCopy("pending_payment", null).label).toBe("Awaiting payment");
    expect(customerOrderStatusCopy("pending_payment", "failed").label).toBe("Payment failed");
    expect(customerOrderStatusCopy("pending_payment", "canceled").label).toBe("Payment cancelled");
  });
});
