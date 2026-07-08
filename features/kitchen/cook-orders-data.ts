import { createClient } from "@/lib/supabase/server";
import type { CookApplication, CookOrderItemSummary } from "@/types/database";

export type CookOrdersData = {
  application: Pick<CookApplication, "status"> | null;
  error: string | null;
  orderItems: CookOrderItemSummary[];
};

export async function getCookOrdersDashboard(userId: string): Promise<CookOrdersData> {
  const supabase = await createClient();
  if (!supabase) {
    return { application: null, error: "Supabase is not configured.", orderItems: [] };
  }

  const marketplace = supabase.schema("lck_marketplace");
  const [application, orderItems] = await Promise.all([
    marketplace.from("cook_applications").select("status").eq("user_id", userId).maybeSingle(),
    marketplace.rpc("list_own_cook_order_items"),
  ]);

  if (application.error || orderItems.error) {
    return {
      application: null,
      error: "Cook orders could not be loaded.",
      orderItems: [],
    };
  }

  return {
    application: application.data,
    error: null,
    orderItems: orderItems.data ?? [],
  };
}
