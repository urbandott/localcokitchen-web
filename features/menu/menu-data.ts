import { unstable_noStore as noStore } from "next/cache";
import type { CustomerMenuItem } from "@/types/database";
import { createClient } from "@/lib/supabase/server";

const SIGNED_IMAGE_SECONDS = 900;

function storagePath(value: string | null, bucket: string): string {
  const source = String(value ?? "").trim();
  if (!source) return "";
  if (!source.includes("://")) return source.replace(/^\/+/, "");
  const marker = `/storage/v1/object/public/${bucket}/`;
  const markerIndex = source.indexOf(marker);
  return markerIndex === -1
    ? ""
    : decodeURIComponent(source.slice(markerIndex + marker.length).split("?")[0] ?? "");
}

async function signedImageUrl(bucket: string, value: string | null): Promise<string | null> {
  const supabase = await createClient();
  const path = storagePath(value, bucket);
  if (!supabase || !path) return null;
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_IMAGE_SECONDS);
  return error ? null : data.signedUrl;
}

export type CustomerMenuItemView = CustomerMenuItem & {
  signed_image_url: string | null;
  signed_cook_profile_image_url: string | null;
};

export async function getCustomerMenuItems(): Promise<{
  items: CustomerMenuItemView[];
  error: string | null;
}> {
  noStore();
  const supabase = await createClient();
  if (!supabase) return { items: [], error: "Supabase is not configured for this environment." };

  const { data, error } = await supabase.schema("lck_marketplace").rpc("get_customer_menu_items", {
    p_search: null,
    p_categories: [],
    p_dietary_tags: [],
    p_excluded_allergens: [],
    p_cuisine_types: [],
    p_spice_levels: [],
    p_cook_ids: [],
    p_item_ids: [],
    p_min_quantity: 1,
    p_limit: 96,
    p_offset: 0,
  });

  if (error) return { items: [], error: "Available items could not be loaded." };

  const rows: CustomerMenuItem[] = data ?? [];
  const items = await Promise.all(
    rows.map(async (item) => ({
      ...item,
      signed_image_url: await signedImageUrl("cook-menu-images", item.image_url),
      signed_cook_profile_image_url: await signedImageUrl(
        "cook-profile-images",
        item.cook_profile_image_url,
      ),
    })),
  );

  return { items, error: null };
}
