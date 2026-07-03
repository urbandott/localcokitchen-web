import { createClient } from "@/lib/supabase/server";
import type { CookApplication, CookMenuItem, CookProfile } from "@/types/database";

export async function userHasCookApplication(userId: string): Promise<boolean> {
  const supabase = await createClient();
  if (!supabase) return false;

  const { data, error } = await supabase
    .schema("lck_marketplace")
    .from("cook_applications")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  return !error && Boolean(data);
}

export async function getKitchenDashboard(userId: string): Promise<{
  application: CookApplication | null;
  profile: CookProfile | null;
  menuItems: CookMenuItem[];
  error: string | null;
}> {
  const supabase = await createClient();
  if (!supabase)
    return {
      application: null,
      profile: null,
      menuItems: [],
      error: "Supabase is not configured.",
    };

  const marketplace = supabase.schema("lck_marketplace");
  const [application, profile, menuItems] = await Promise.all([
    marketplace.from("cook_applications").select("*").eq("user_id", userId).maybeSingle(),
    marketplace.from("cook_profiles").select("*").eq("cook_id", userId).maybeSingle(),
    marketplace
      .from("cook_menu_items")
      .select("*")
      .eq("cook_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  if (application.error || profile.error || menuItems.error) {
    return {
      application: null,
      profile: null,
      menuItems: [],
      error: "Kitchen data could not be loaded.",
    };
  }

  return {
    application: application.data,
    profile: profile.data,
    menuItems: menuItems.data ?? [],
    error: null,
  };
}
