"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export async function setKitchenDisabledAction(formData: FormData) {
  await requireAdmin();
  const parsed = z
    .object({ cookId: z.string().uuid(), disabled: z.enum(["true", "false"]) })
    .safeParse({
      cookId: formData.get("cookId"),
      disabled: formData.get("disabled"),
    });
  if (!parsed.success) return;

  const supabase = await createClient();
  await supabase?.schema("lck_identity").rpc("set_admin_cook_kitchen_disabled", {
    p_cook_id: parsed.data.cookId,
    p_disabled: parsed.data.disabled === "true",
  });
  revalidatePath("/admin/cooks/");
}
