"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const fulfillmentSchema = z.object({
  orderItemId: z.string().uuid(),
  status: z.enum(["ready", "fulfilled"]),
});

export type CookOrderActionState = {
  ok: boolean;
  message: string;
};

export async function updateCookOrderItemFulfillmentAction(
  _state: CookOrderActionState,
  formData: FormData,
): Promise<CookOrderActionState> {
  const parsed = fulfillmentSchema.safeParse({
    orderItemId: formData.get("orderItemId"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    return { ok: false, message: "This order item update is invalid." };
  }

  const supabase = await createClient();
  if (!supabase) return { ok: false, message: "Order management is not configured yet." };

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { ok: false, message: "Sign in to update kitchen orders." };
  }

  const { data, error } = await supabase
    .schema("lck_marketplace")
    .rpc("update_own_cook_order_item_fulfillment", {
      p_fulfillment_status: parsed.data.status,
      p_order_item_id: parsed.data.orderItemId,
    });

  if (error || data !== true) {
    return {
      ok: false,
      message:
        "This order item could not be updated. It may not be paid or may not belong to your kitchen.",
    };
  }

  revalidatePath("/my-kitchen/orders/");
  return { ok: true, message: "Order item updated." };
}
