"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  detectProfileImage,
  PROFILE_IMAGE_MAX_BYTES,
  profileDetailsSchema,
} from "@/features/profile/profile-validation";

export type ProfileActionState = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
};

function fieldErrors(
  error: ReturnType<typeof profileDetailsSchema.safeParse>,
): Record<string, string> {
  if (error.success) return {};

  const result: Record<string, string> = {};
  for (const issue of error.error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && !result[field]) result[field] = issue.message;
  }
  return result;
}

export async function updateProfileAction(
  _state: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const parsed = profileDetailsSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please correct the highlighted fields.",
      fieldErrors: fieldErrors(parsed),
    };
  }

  const avatar = formData.get("avatar");
  const newAvatar = avatar instanceof File && avatar.size > 0 ? avatar : null;
  const removeAvatar = formData.get("removeAvatar") === "on";

  if (newAvatar && removeAvatar) {
    return { ok: false, message: "Choose a new photo or remove the current photo, not both." };
  }

  if (newAvatar && newAvatar.size > PROFILE_IMAGE_MAX_BYTES) {
    return {
      ok: false,
      message: "Profile photo must be 2 MB or smaller.",
      fieldErrors: { avatar: "Choose an image that is 2 MB or smaller." },
    };
  }

  const supabase = await createClient();
  if (!supabase) return { ok: false, message: "Profile updates are not configured yet." };

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return { ok: false, message: "Your session expired. Sign in and try again." };
  }

  const userId = authData.user.id;
  const identity = supabase.schema("lck_identity");
  const currentProfile = await identity
    .from("users")
    .select("avatar_path")
    .eq("id", userId)
    .single();

  if (currentProfile.error) {
    return { ok: false, message: "Your profile could not be loaded. Try again." };
  }

  let uploadedPath: string | null = null;
  if (newAvatar) {
    const bytes = new Uint8Array(await newAvatar.arrayBuffer());
    const image = detectProfileImage(bytes);
    if (!image || newAvatar.type !== image.contentType) {
      return {
        ok: false,
        message: "Use a valid JPG, PNG, or WebP image.",
        fieldErrors: { avatar: "The file contents must match a supported image format." },
      };
    }

    uploadedPath = `${userId}/${crypto.randomUUID()}.${image.extension}`;
    const upload = await supabase.storage.from("profile-images").upload(uploadedPath, bytes, {
      cacheControl: "3600",
      contentType: image.contentType,
      upsert: false,
    });

    if (upload.error) {
      return { ok: false, message: "The profile photo could not be uploaded. Try again." };
    }
  }

  const firstName = parsed.data.firstName;
  const lastName = parsed.data.lastName;
  const update = {
    first_name: firstName,
    last_name: lastName || null,
    full_name: [firstName, lastName].filter(Boolean).join(" "),
    ...(uploadedPath || removeAvatar ? { avatar_path: uploadedPath } : {}),
  };

  const saved = await identity.from("users").update(update).eq("id", userId).select("id").single();

  if (saved.error) {
    if (uploadedPath) await supabase.storage.from("profile-images").remove([uploadedPath]);
    return { ok: false, message: "Your profile could not be updated. Try again." };
  }

  const previousPath = currentProfile.data.avatar_path;
  if ((uploadedPath || removeAvatar) && previousPath && previousPath !== uploadedPath) {
    await supabase.storage.from("profile-images").remove([previousPath]);
  }

  revalidatePath("/profile/");
  revalidatePath("/profile/personal-details/");
  return { ok: true, message: "Your profile has been updated." };
}
