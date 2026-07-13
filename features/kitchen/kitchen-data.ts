import { createClient } from "@/lib/supabase/server";
import type {
  CookApplication,
  CookMenuItem,
  CookPickupWindow,
  CookProfile,
} from "@/types/database";

const KITCHEN_IMAGE_SIGNED_URL_SECONDS = 900;

export type KitchenMenuItem = CookMenuItem & {
  signed_image_urls: string[];
};

async function signedKitchenImageUrls(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  item: CookMenuItem,
): Promise<string[]> {
  const paths = item.image_urls?.length
    ? item.image_urls
    : [item.image_url].filter((path): path is string => Boolean(path));
  return Promise.all(
    paths.map(async (path) => {
      const { data, error } = await supabase.storage
        .from("cook-menu-images")
        .createSignedUrl(path, KITCHEN_IMAGE_SIGNED_URL_SECONDS);
      return error ? "" : data.signedUrl;
    }),
  );
}

export async function userHasCookWorkspace(userId: string): Promise<boolean> {
  const supabase = await createClient();
  if (!supabase) return false;

  const [identity, application] = await Promise.all([
    supabase
      .schema("lck_identity")
      .from("users")
      .select("cook_onboarding_started_at")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .schema("lck_marketplace")
      .from("cook_applications")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  return Boolean(
    (!identity.error && identity.data?.cook_onboarding_started_at) ||
    (!application.error && application.data),
  );
}

export async function getKitchenDashboard(userId: string): Promise<{
  application: CookApplication | null;
  profile: CookProfile | null;
  menuItems: KitchenMenuItem[];
  pickupWindows: CookPickupWindow[];
  error: string | null;
}> {
  const supabase = await createClient();
  if (!supabase)
    return {
      application: null,
      profile: null,
      menuItems: [],
      pickupWindows: [],
      error: "Supabase is not configured.",
    };

  const marketplace = supabase.schema("lck_marketplace");
  const [application, profile, menuItems, pickupWindows] = await Promise.all([
    marketplace.from("cook_applications").select("*").eq("user_id", userId).maybeSingle(),
    marketplace.from("cook_profiles").select("*").eq("cook_id", userId).maybeSingle(),
    marketplace
      .from("cook_menu_items")
      .select("*")
      .eq("cook_id", userId)
      .order("created_at", { ascending: false }),
    marketplace
      .from("cook_pickup_windows")
      .select("*")
      .eq("cook_id", userId)
      .order("day_of_week", { ascending: true }),
  ]);

  if (application.error || profile.error || menuItems.error || pickupWindows.error) {
    return {
      application: null,
      profile: null,
      menuItems: [],
      pickupWindows: [],
      error: "Kitchen data could not be loaded.",
    };
  }

  const signedMenuItems = await Promise.all(
    (menuItems.data ?? []).map(async (item) => ({
      ...item,
      signed_image_urls: await signedKitchenImageUrls(supabase, item),
    })),
  );

  return {
    application: application.data,
    profile: profile.data,
    menuItems: signedMenuItems,
    pickupWindows: pickupWindows.data ?? [],
    error: null,
  };
}
