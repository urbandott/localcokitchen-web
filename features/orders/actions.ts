"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { orderIdSchema } from "@/features/orders/order-data";

export type CancelOrderActionState = {
  ok: boolean;
  message: string;
};

export async function cancelPendingOrderAction(
  _state: CancelOrderActionState,
  formData: FormData,
): Promise<CancelOrderActionState> {
  const parsed = orderIdSchema.safeParse(String(formData.get("orderId") ?? ""));
  if (!parsed.success) {
    return { ok: false, message: "This order could not be found." };
  }

  const supabase = await createClient();
  if (!supabase) return { ok: false, message: "Order cancellation is not configured yet." };

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { ok: false, message: "Sign in to cancel this order." };
  }

  const { data, error } = await supabase
    .schema("lck_marketplace")
    .rpc("cancel_own_pending_payment_order", { p_order_id: parsed.data });

  if (error || data !== true) {
    return {
      ok: false,
      message: "This order could not be cancelled. It may already be paid, cancelled, or expired.",
    };
  }

  revalidatePath("/profile/orders/");
  revalidatePath(`/profile/orders/${parsed.data}/`);
  return { ok: true, message: "Order cancelled. Reserved inventory has been released." };
}
