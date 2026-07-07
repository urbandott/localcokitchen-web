"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const reviewCookApplicationSchema = z
  .object({
    cookId: z.string().uuid(),
    decision: z.enum(["approved", "rejected"]),
    reviewNotes: z
      .string()
      .normalize()
      .trim()
      .max(1000, "Review notes must be 1000 characters or fewer."),
  })
  .superRefine((value, context) => {
    if (value.decision === "rejected" && value.reviewNotes.length < 5) {
      context.addIssue({
        code: "custom",
        path: ["reviewNotes"],
        message: "Add a clear rejection note for the cook.",
      });
    }
  });

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

export async function reviewCookApplicationAction(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = reviewCookApplicationSchema.safeParse({
    cookId: formData.get("cookId"),
    decision: formData.get("decision"),
    reviewNotes: formData.get("reviewNotes") ?? "",
  });
  if (!parsed.success) return;

  const supabase = await createClient();
  if (!supabase) return;

  const saved = await supabase
    .schema("lck_marketplace")
    .from("cook_applications")
    .update({
      status: parsed.data.decision,
      reviewed_at: new Date().toISOString(),
      reviewed_by: admin.id,
      review_notes: parsed.data.reviewNotes || null,
    })
    .eq("user_id", parsed.data.cookId)
    .eq("status", "submitted")
    .select("user_id")
    .single();

  if (saved.error) return;

  revalidatePath("/admin/cook-applications/");
  revalidatePath("/admin/cooks/");
  revalidatePath("/admin/metrics/");
}
