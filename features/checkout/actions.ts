"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { CART_ITEM_LIMIT } from "@/features/cart/cart-utils";
import { createStripeCheckoutSession } from "@/features/payments/stripe-checkout";
import { getServerEnv } from "@/lib/env";
import type { Json } from "@/types/database";

const checkoutCartSchema = z
  .array(
    z.object({
      id: z.string().uuid(),
      quantity: z.coerce.number().int().min(1).max(CART_ITEM_LIMIT),
    }),
  )
  .min(1, "Your cart is empty.")
  .max(50, "Checkout supports up to 50 unique menu items.");

export type CheckoutActionState = {
  ok: boolean;
  message: string;
  orderId?: string;
  subtotalCents?: number;
  itemCount?: number;
  redirectUrl?: string;
};

export async function createCheckoutOrderAction(
  _state: CheckoutActionState,
  formData: FormData,
): Promise<CheckoutActionState> {
  const rawCart = String(formData.get("cart") ?? "");
  let cartJson: unknown;
  try {
    cartJson = JSON.parse(rawCart);
  } catch {
    return { ok: false, message: "Your cart could not be read. Refresh and try again." };
  }

  const parsed = checkoutCartSchema.safeParse(cartJson);
  if (!parsed.success) {
    const hasQuantityIssue = parsed.error.issues.some((issue) => issue.path.includes("quantity"));
    return {
      ok: false,
      message: hasQuantityIssue
        ? "One or more item quantity values are invalid."
        : (parsed.error.issues[0]?.message ?? "Your cart is invalid."),
    };
  }

  const byId = new Map<string, number>();
  for (const item of parsed.data) {
    byId.set(item.id, (byId.get(item.id) ?? 0) + item.quantity);
  }

  const normalizedCart = [...byId.entries()].map(([id, quantity]) => ({ id, quantity }));
  if (normalizedCart.some((item) => item.quantity < 1 || item.quantity > CART_ITEM_LIMIT)) {
    return { ok: false, message: "One or more item quantity values are invalid." };
  }

  const supabase = await createClient();
  if (!supabase) return { ok: false, message: "Checkout is not configured yet." };

  const env = getServerEnv();
  if (!env.STRIPE_SECRET_KEY) {
    return { ok: false, message: "Secure payment checkout is not configured yet." };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { ok: false, message: "Sign in before checkout." };
  }

  const { data, error } = await supabase
    .schema("lck_marketplace")
    .rpc("create_customer_checkout_order", { p_cart: normalizedCart as Json });

  if (error || !data?.[0]) {
    return {
      ok: false,
      message:
        "Checkout could not be completed. An item may be unavailable, sold out, or no longer public.",
    };
  }

  const order = data[0];
  const { data: orderItems, error: orderItemsError } = await supabase
    .schema("lck_marketplace")
    .from("customer_order_items")
    .select("item_name, quantity, unit_price_cents")
    .eq("order_id", order.order_id);

  if (orderItemsError || !orderItems?.length) {
    return {
      ok: false,
      message: "Checkout could not load the final order items. Please try again.",
    };
  }

  let checkoutSession: Awaited<ReturnType<typeof createStripeCheckoutSession>>;
  try {
    checkoutSession = await createStripeCheckoutSession({
      amountCents: order.subtotal_cents,
      cancelUrl: new URL("/menu?checkout=cancelled", env.NEXT_PUBLIC_SITE_URL).toString(),
      currency: "usd",
      customerEmail: userData.user.email,
      lineItems: orderItems.map((item) => ({
        name: item.item_name,
        quantity: item.quantity,
        unitAmountCents: item.unit_price_cents,
      })),
      orderId: order.order_id,
      secretKey: env.STRIPE_SECRET_KEY,
      successUrl: new URL("/menu?checkout=success", env.NEXT_PUBLIC_SITE_URL).toString(),
    });
  } catch {
    return {
      ok: false,
      message: "Secure payment checkout could not be started. Please try again.",
    };
  }

  const { error: paymentAttemptError } = await supabase
    .schema("lck_marketplace")
    .rpc("create_checkout_session_payment_attempt", {
      p_amount_cents: order.subtotal_cents,
      p_currency: "usd",
      p_order_id: order.order_id,
      p_provider_reference: checkoutSession.id,
    });

  if (paymentAttemptError) {
    return {
      ok: false,
      message: "Secure payment checkout could not be confirmed. Please try again.",
    };
  }

  return {
    ok: true,
    message: "Redirecting you to secure payment…",
    orderId: order.order_id,
    redirectUrl: checkoutSession.url,
    subtotalCents: order.subtotal_cents,
    itemCount: order.item_count,
  };
}
