import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { CustomerOrder, CustomerOrderItem, CustomerPaymentAttempt } from "@/types/database";

export const orderIdSchema = z.string().uuid();

export type CustomerOrderSummary = CustomerOrder & {
  latestPaymentStatus: CustomerPaymentAttempt["status"] | null;
};

export type CustomerOrderDetails = CustomerOrderSummary & {
  items: CustomerOrderItem[];
  paymentAttempts: CustomerPaymentAttempt[];
};

function latestPaymentStatus(
  orderId: string,
  attempts: CustomerPaymentAttempt[],
): CustomerPaymentAttempt["status"] | null {
  return attempts.find((attempt) => attempt.order_id === orderId)?.status ?? null;
}

export async function listCustomerOrders(userId: string): Promise<{
  error: string | null;
  orders: CustomerOrderSummary[];
}> {
  const supabase = await createClient();
  if (!supabase) return { error: "Orders are not configured yet.", orders: [] };

  const marketplace = supabase.schema("lck_marketplace");
  const { data: orders, error } = await marketplace
    .from("customer_orders")
    .select("*")
    .eq("customer_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return { error: "Your orders could not be loaded.", orders: [] };
  if (!orders?.length) return { error: null, orders: [] };

  const orderIds = orders.map((order) => order.id);
  const { data: attempts } = await marketplace
    .from("customer_payment_attempts")
    .select("*")
    .eq("customer_id", userId)
    .in("order_id", orderIds)
    .order("created_at", { ascending: false });

  const paymentAttempts = attempts ?? [];
  return {
    error: null,
    orders: orders.map((order) => ({
      ...order,
      latestPaymentStatus: latestPaymentStatus(order.id, paymentAttempts),
    })),
  };
}

export async function getCustomerOrderDetails(
  userId: string,
  orderId: string,
): Promise<{ error: string | null; order: CustomerOrderDetails | null }> {
  const parsed = orderIdSchema.safeParse(orderId);
  if (!parsed.success) return { error: "Order not found.", order: null };

  const supabase = await createClient();
  if (!supabase) return { error: "Orders are not configured yet.", order: null };

  const marketplace = supabase.schema("lck_marketplace");
  const { data: order, error } = await marketplace
    .from("customer_orders")
    .select("*")
    .eq("id", parsed.data)
    .eq("customer_id", userId)
    .maybeSingle();

  if (error) return { error: "Your order could not be loaded.", order: null };
  if (!order) return { error: "Order not found.", order: null };

  const [itemsResult, attemptsResult] = await Promise.all([
    marketplace
      .from("customer_order_items")
      .select("*")
      .eq("order_id", order.id)
      .order("created_at", { ascending: true }),
    marketplace
      .from("customer_payment_attempts")
      .select("*")
      .eq("order_id", order.id)
      .eq("customer_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  if (itemsResult.error || attemptsResult.error) {
    return { error: "Your order details could not be loaded.", order: null };
  }

  const paymentAttempts = attemptsResult.data ?? [];
  return {
    error: null,
    order: {
      ...order,
      items: itemsResult.data ?? [],
      latestPaymentStatus: latestPaymentStatus(order.id, paymentAttempts),
      paymentAttempts,
    },
  };
}

export function customerOrderStatusCopy(
  status: CustomerOrder["status"],
  paymentStatus: CustomerPaymentAttempt["status"] | null,
): { label: string; message: string; tone: "success" | "warning" | "neutral" } {
  if (status === "paid") {
    return {
      label: "Paid",
      message: "Your payment was confirmed. The cook can now prepare this order.",
      tone: "success",
    };
  }
  if (status === "cancelled") {
    return {
      label: "Cancelled",
      message: "This order is no longer active. Any reserved inventory was released.",
      tone: "neutral",
    };
  }
  if (status === "fulfilled") {
    return {
      label: "Fulfilled",
      message: "This order has been completed.",
      tone: "success",
    };
  }
  if (status === "refunded") {
    return {
      label: "Refunded",
      message: "This order was refunded.",
      tone: "neutral",
    };
  }
  if (paymentStatus === "failed") {
    return {
      label: "Payment failed",
      message: "Payment was not completed. You can return to the menu and place a new order.",
      tone: "warning",
    };
  }
  if (paymentStatus === "canceled") {
    return {
      label: "Payment cancelled",
      message: "Payment was cancelled. This order will expire if payment is not completed.",
      tone: "warning",
    };
  }
  return {
    label: "Awaiting payment",
    message:
      "Payment is still pending. If you already paid, this page will update after Stripe confirms it.",
    tone: "warning",
  };
}
