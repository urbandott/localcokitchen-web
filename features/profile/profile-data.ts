import { createClient } from "@/lib/supabase/server";
import type { IdentityUser } from "@/types/database";

const PROFILE_IMAGE_URL_SECONDS = 3600;

export type AccountProfile = Pick<
  IdentityUser,
  "id" | "email" | "first_name" | "last_name" | "full_name" | "avatar_path"
> & {
  signedAvatarUrl: string | null;
};

export async function getAccountProfile(userId: string): Promise<AccountProfile | null> {
  const supabase = await createClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .schema("lck_identity")
    .from("users")
    .select("id,email,first_name,last_name,full_name,avatar_path")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return null;

  let signedAvatarUrl: string | null = null;
  if (data.avatar_path) {
    const signedImage = await supabase.storage
      .from("profile-images")
      .createSignedUrl(data.avatar_path, PROFILE_IMAGE_URL_SECONDS);
    signedAvatarUrl = signedImage.error ? null : signedImage.data.signedUrl;
  }

  return { ...data, signedAvatarUrl };
}
