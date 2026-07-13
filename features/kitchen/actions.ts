"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  COOK_APPLICATION_MAX_FILE_BYTES,
  COOK_APPLICATION_MAX_TOTAL_FILE_BYTES,
  cookApplicationDraftSchema,
  cookApplicationSchema,
  validateCookApplicationFileBytes,
  type SupportedCookApplicationFile,
} from "@/features/kitchen/application-validation";
import {
  cookProfileSchema,
  menuItemSchema,
  pickupWindowSchema,
} from "@/features/kitchen/management-validation";
import {
  PROFILE_IMAGE_MAX_BYTES,
  validateProfileImage,
} from "@/features/profile/profile-validation";

export type CookApplicationActionState = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
};

export type KitchenManagementActionState = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
};

type ApplicationFileField =
  | "foodHandlerCertificate"
  | "permitOrCertification"
  | "governmentIdDocument"
  | "selfieVerification";

type PreparedApplicationFile = {
  bytes: Uint8Array;
  file: SupportedCookApplicationFile;
  path: string;
};

const requiredFileLabels: Record<Exclude<ApplicationFileField, "permitOrCertification">, string> = {
  foodHandlerCertificate: "Food handler certificate",
  governmentIdDocument: "Government ID",
  selfieVerification: "Selfie verification photo",
};

function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && !result[field]) result[field] = issue.message;
  }
  return result;
}

function isSubmittedFile(value: FormDataEntryValue | null): value is File {
  return value instanceof File && value.size > 0;
}

async function prepareApplicationFile(params: {
  field: ApplicationFileField;
  file: File;
  imagesOnly?: boolean;
  userId: string;
}): Promise<PreparedApplicationFile | { error: string }> {
  if (params.file.size > COOK_APPLICATION_MAX_FILE_BYTES) {
    return { error: "File must be 5 MB or smaller." };
  }

  const bytes = new Uint8Array(await params.file.arrayBuffer());
  const detected = validateCookApplicationFileBytes(bytes, { imagesOnly: params.imagesOnly });
  if (!detected || params.file.type !== detected.contentType) {
    return {
      error: params.imagesOnly
        ? "Upload a valid JPG, PNG, or WebP image."
        : "Upload a valid PDF, JPG, PNG, or WebP file.",
    };
  }

  return {
    bytes,
    file: detected,
    path: `${params.userId}/${crypto.randomUUID()}.${detected.extension}`,
  };
}

async function removeUploadedFiles(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  paths: string[],
) {
  if (paths.length === 0) return;
  await supabase.storage.from("cook-documents").remove(paths);
}

const preparableCookStatuses = new Set(["draft", "submitted", "rejected", "approved"]);

async function requireCookWorkspaceContext(): Promise<
  | {
      applicationStatus: string;
      moderatorDisabled: boolean;
      ok: true;
      supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>;
      userId: string;
    }
  | { ok: false; message: string }
> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, message: "Kitchen management is not configured yet." };

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return { ok: false, message: "Your session expired. Sign in and try again." };
  }

  const userId = authData.user.id;
  const marketplace = supabase.schema("lck_marketplace");
  const [application, profile] = await Promise.all([
    marketplace.from("cook_applications").select("status").eq("user_id", userId).maybeSingle(),
    marketplace
      .from("cook_profiles")
      .select("moderator_disabled_at")
      .eq("cook_id", userId)
      .maybeSingle(),
  ]);

  if (application.error || profile.error) {
    return { ok: false, message: "Your cook approval status could not be loaded." };
  }

  const applicationStatus = application.data?.status;
  if (!applicationStatus || !preparableCookStatuses.has(applicationStatus)) {
    return {
      ok: false,
      message:
        applicationStatus === "suspended"
          ? "Your cook application is suspended. Please contact support before editing your kitchen."
          : "Save your cook application draft before editing this.",
    };
  }

  return {
    applicationStatus,
    moderatorDisabled: Boolean(profile.data?.moderator_disabled_at),
    ok: true,
    supabase,
    userId,
  };
}

async function requireKitchenLiveReadiness(context: {
  applicationStatus: string;
  moderatorDisabled: boolean;
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>;
  userId: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (context.moderatorDisabled) {
    return {
      ok: false,
      message:
        "The moderator has disabled this kitchen. Please reach out to us at info@localcokitchen.com for more information.",
    };
  }

  if (context.applicationStatus !== "approved") {
    return {
      ok: false,
      message: "Your cook application must be approved before making your kitchen live.",
    };
  }

  const marketplace = context.supabase.schema("lck_marketplace");
  const [menuItems, pickupWindows] = await Promise.all([
    marketplace
      .from("cook_menu_items")
      .select("id")
      .eq("cook_id", context.userId)
      .eq("is_active", true)
      .eq("is_sold_out", false)
      .limit(1),
    marketplace
      .from("cook_pickup_windows")
      .select("id")
      .eq("cook_id", context.userId)
      .eq("is_active", true)
      .limit(1),
  ]);

  if (menuItems.error || pickupWindows.error) {
    return { ok: false, message: "Kitchen readiness could not be checked. Try again." };
  }

  if (!menuItems.data?.length) {
    return {
      ok: false,
      message: "Add at least one active, available menu item before making your kitchen live.",
    };
  }

  if (!pickupWindows.data?.length) {
    return {
      ok: false,
      message: "Add at least one active pickup window before making your kitchen live.",
    };
  }

  return { ok: true };
}

async function uploadKitchenImage(params: {
  bucket: "cook-profile-images" | "cook-menu-images";
  file: File;
  userId: string;
}): Promise<{ path: string } | { error: string }> {
  if (params.file.size === 0) return { error: "Choose a non-empty image file." };
  if (params.file.size > PROFILE_IMAGE_MAX_BYTES)
    return { error: "Image must be 2 MB or smaller." };

  const bytes = new Uint8Array(await params.file.arrayBuffer());
  const image = validateProfileImage(bytes);
  if (!image || params.file.type !== image.contentType) {
    return { error: "Upload a valid JPG, PNG, or WebP image." };
  }

  const supabase = await createClient();
  if (!supabase) return { error: "Image uploads are not configured yet." };

  const path = `${params.userId}/${crypto.randomUUID()}.${image.extension}`;
  const upload = await supabase.storage.from(params.bucket).upload(path, bytes, {
    cacheControl: "3600",
    contentType: image.contentType,
    upsert: false,
  });

  return upload.error ? { error: "Image could not be uploaded. Try again." } : { path };
}

export async function submitCookApplicationAction(
  _state: CookApplicationActionState,
  formData: FormData,
): Promise<CookApplicationActionState> {
  const intent = formData.get("intent") === "draft" ? "draft" : "submit";
  const parsedInput = {
    legalName: formData.get("legalName"),
    phone: formData.get("phone"),
    pickupAddress: formData.get("pickupAddress"),
    pickupZipCode: formData.get("pickupZipCode"),
    foodHandlerTrainingCompleted: formData.get("foodHandlerTrainingCompleted") === "on",
  };
  const parsed =
    intent === "draft"
      ? cookApplicationDraftSchema.safeParse(parsedInput)
      : cookApplicationSchema.safeParse(parsedInput);

  if (!parsed.success) {
    return {
      ok: false,
      message:
        intent === "draft"
          ? "Please correct the highlighted fields before saving your draft."
          : "Please complete the highlighted fields before submitting.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  const supabase = await createClient();
  if (!supabase) return { ok: false, message: "Cook applications are not configured yet." };

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return { ok: false, message: "Your session expired. Sign in and try again." };
  }

  const userId = authData.user.id;
  const marketplace = supabase.schema("lck_marketplace");
  const current = await marketplace
    .from("cook_applications")
    .select(
      "status, food_handler_certificate_url, permit_or_certification_url, government_id_document_url, selfie_verification_url",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (current.error) {
    return { ok: false, message: "Your application status could not be loaded. Try again." };
  }

  if (current.data && !["draft", "rejected"].includes(current.data.status)) {
    return {
      ok: false,
      message:
        current.data.status === "submitted"
          ? "Your application is already submitted for review."
          : "Your current application status does not allow resubmission.",
    };
  }

  const requiredFiles: Array<{
    field: Exclude<ApplicationFileField, "permitOrCertification">;
    imagesOnly?: boolean;
  }> = [
    { field: "foodHandlerCertificate" },
    { field: "governmentIdDocument" },
    { field: "selfieVerification", imagesOnly: true },
  ];
  const fieldErrors: Record<string, string> = {};
  const prepared = new Map<ApplicationFileField, PreparedApplicationFile>();
  let totalBytes = 0;

  for (const fileConfig of requiredFiles) {
    const submitted = formData.get(fileConfig.field);
    if (!isSubmittedFile(submitted)) {
      const currentPath =
        current.data?.[
          fileConfig.field === "foodHandlerCertificate"
            ? "food_handler_certificate_url"
            : fileConfig.field === "governmentIdDocument"
              ? "government_id_document_url"
              : "selfie_verification_url"
        ];
      if (intent === "submit" && !currentPath) {
        fieldErrors[fileConfig.field] = `${requiredFileLabels[fileConfig.field]} is required.`;
      }
      continue;
    }

    totalBytes += submitted.size;
    const result = await prepareApplicationFile({
      field: fileConfig.field,
      file: submitted,
      imagesOnly: fileConfig.imagesOnly,
      userId,
    });
    if ("error" in result) fieldErrors[fileConfig.field] = result.error;
    else prepared.set(fileConfig.field, result);
  }

  const permit = formData.get("permitOrCertification");
  if (isSubmittedFile(permit)) {
    totalBytes += permit.size;
    const result = await prepareApplicationFile({
      field: "permitOrCertification",
      file: permit,
      userId,
    });
    if ("error" in result) fieldErrors.permitOrCertification = result.error;
    else prepared.set("permitOrCertification", result);
  }

  if (totalBytes > COOK_APPLICATION_MAX_TOTAL_FILE_BYTES) {
    fieldErrors.foodHandlerCertificate = "Combined application documents must be 15 MB or smaller.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      message: "Please correct the highlighted fields.",
      fieldErrors,
    };
  }

  const uploadedPaths: string[] = [];
  for (const file of prepared.values()) {
    const upload = await supabase.storage.from("cook-documents").upload(file.path, file.bytes, {
      cacheControl: "3600",
      contentType: file.file.contentType,
      upsert: false,
    });

    if (upload.error) {
      await removeUploadedFiles(supabase, uploadedPaths);
      return { ok: false, message: "One of your documents could not be uploaded. Try again." };
    }
    uploadedPaths.push(file.path);
  }

  const foodHandlerCertificatePath =
    prepared.get("foodHandlerCertificate")?.path ??
    current.data?.food_handler_certificate_url ??
    null;
  const governmentIdDocumentPath =
    prepared.get("governmentIdDocument")?.path ?? current.data?.government_id_document_url ?? null;
  const selfieVerificationPath =
    prepared.get("selfieVerification")?.path ?? current.data?.selfie_verification_url ?? null;
  const permitOrCertificationPath =
    prepared.get("permitOrCertification")?.path ??
    current.data?.permit_or_certification_url ??
    null;

  if (
    intent === "submit" &&
    (!foodHandlerCertificatePath || !governmentIdDocumentPath || !selfieVerificationPath)
  ) {
    await removeUploadedFiles(supabase, uploadedPaths);
    return { ok: false, message: "Required application documents are missing." };
  }

  const submittedAt = intent === "submit" ? new Date().toISOString() : null;
  const saved = await marketplace
    .from("cook_applications")
    .upsert(
      {
        user_id: userId,
        legal_name: parsed.data.legalName,
        phone: parsed.data.phone,
        pickup_address: parsed.data.pickupAddress,
        pickup_zip_code: parsed.data.pickupZipCode,
        food_handler_training_completed: parsed.data.foodHandlerTrainingCompleted,
        food_handler_certificate_url: foodHandlerCertificatePath,
        permit_or_certification_url: permitOrCertificationPath,
        government_id_document_url: governmentIdDocumentPath,
        selfie_verification_url: selfieVerificationPath,
        status: intent === "submit" ? "submitted" : "draft",
        submitted_at: submittedAt,
      },
      { onConflict: "user_id" },
    )
    .select("user_id,status")
    .single();

  if (saved.error) {
    await removeUploadedFiles(supabase, uploadedPaths);
    return { ok: false, message: "Your application could not be submitted. Try again." };
  }

  const newPathsByField = new Set([...prepared.values()].map((file) => file.path));
  const previousPaths = [
    prepared.has("foodHandlerCertificate") ? current.data?.food_handler_certificate_url : null,
    prepared.has("permitOrCertification") ? current.data?.permit_or_certification_url : null,
    prepared.has("governmentIdDocument") ? current.data?.government_id_document_url : null,
    prepared.has("selfieVerification") ? current.data?.selfie_verification_url : null,
  ].filter((path): path is string => Boolean(path) && !newPathsByField.has(path));
  await removeUploadedFiles(supabase, previousPaths);

  revalidatePath("/my-kitchen/");
  revalidatePath("/my-kitchen/application/");
  return {
    ok: true,
    message:
      intent === "submit"
        ? "Your cook application has been submitted for review."
        : "Your cook application draft has been saved.",
  };
}

export async function updateCookProfileAction(
  _state: KitchenManagementActionState,
  formData: FormData,
): Promise<KitchenManagementActionState> {
  const parsed = cookProfileSchema.safeParse({
    displayName: formData.get("displayName"),
    description: formData.get("description") ?? "",
    cuisineType: formData.get("cuisineType") ?? "",
    pickupZipCode: formData.get("pickupZipCode"),
    preorderCutoffHours: formData.get("preorderCutoffHours"),
    orderNotes: formData.get("orderNotes") ?? "",
    isPublic: formData.get("isPublic") === "on",
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please correct the highlighted profile fields.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  const context = await requireCookWorkspaceContext();
  if (!context.ok) return { ok: false, message: context.message };
  if (parsed.data.isPublic) {
    const readiness = await requireKitchenLiveReadiness(context);
    if (!readiness.ok) return { ok: false, message: readiness.message };
  }

  const marketplace = context.supabase.schema("lck_marketplace");
  const current = await marketplace
    .from("cook_profiles")
    .select("profile_image_url")
    .eq("cook_id", context.userId)
    .maybeSingle();
  if (current.error) return { ok: false, message: "Your cook profile could not be loaded." };

  let uploadedPath: string | null = null;
  const profileImage = formData.get("profileImage");
  if (profileImage instanceof File && profileImage.size > 0) {
    const uploaded = await uploadKitchenImage({
      bucket: "cook-profile-images",
      file: profileImage,
      userId: context.userId,
    });
    if ("error" in uploaded) {
      return { ok: false, message: uploaded.error, fieldErrors: { profileImage: uploaded.error } };
    }
    uploadedPath = uploaded.path;
  }

  const saved = await marketplace
    .from("cook_profiles")
    .upsert(
      {
        cook_id: context.userId,
        display_name: parsed.data.displayName,
        description: parsed.data.description,
        cuisine_type: parsed.data.cuisineType,
        pickup_zip_code: parsed.data.pickupZipCode,
        preorder_cutoff_hours: parsed.data.preorderCutoffHours,
        order_notes: parsed.data.orderNotes,
        is_public: parsed.data.isPublic,
        ...(uploadedPath ? { profile_image_url: uploadedPath } : {}),
      },
      { onConflict: "cook_id" },
    )
    .select("cook_id")
    .single();

  if (saved.error) {
    if (uploadedPath)
      await context.supabase.storage.from("cook-profile-images").remove([uploadedPath]);
    return { ok: false, message: "Your cook profile could not be saved. Try again." };
  }

  const previousPath = current.data?.profile_image_url;
  if (uploadedPath && previousPath && previousPath !== uploadedPath) {
    await context.supabase.storage.from("cook-profile-images").remove([previousPath]);
  }

  revalidatePath("/my-kitchen/");
  revalidatePath("/my-kitchen/profile/");
  revalidatePath("/menu/");
  return { ok: true, message: "Your public cook profile has been updated." };
}

export async function createMenuItemAction(
  _state: KitchenManagementActionState,
  formData: FormData,
): Promise<KitchenManagementActionState> {
  const parsed = menuItemSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    priceCents: formData.get("price"),
    quantityAvailable: formData.get("quantityAvailable"),
    category: formData.get("category"),
    dietaryTags: formData.get("dietaryTags") ?? "",
    allergens: formData.get("allergens") ?? "",
    mainIngredients: formData.get("mainIngredients") ?? "",
    portionSize: formData.get("portionSize") ?? "",
    portionServes: formData.get("portionServes"),
    spiceLevel: formData.get("spiceLevel"),
    pickupWindowNote: formData.get("pickupWindowNote") ?? "",
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please correct the highlighted menu item fields.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  const context = await requireCookWorkspaceContext();
  if (!context.ok) return { ok: false, message: context.message };

  const image = formData.get("image");
  if (!(image instanceof File) || image.size === 0) {
    return {
      ok: false,
      message: "Upload a menu item image.",
      fieldErrors: { image: "Upload a menu item image." },
    };
  }

  const uploaded = await uploadKitchenImage({
    bucket: "cook-menu-images",
    file: image,
    userId: context.userId,
  });
  if ("error" in uploaded) {
    return { ok: false, message: uploaded.error, fieldErrors: { image: uploaded.error } };
  }

  const saved = await context.supabase
    .schema("lck_marketplace")
    .from("cook_menu_items")
    .insert({
      cook_id: context.userId,
      name: parsed.data.name,
      description: parsed.data.description,
      image_url: uploaded.path,
      price_cents: parsed.data.priceCents,
      quantity_available: parsed.data.quantityAvailable,
      category: parsed.data.category,
      dietary_tags: parsed.data.dietaryTags,
      allergens: parsed.data.allergens,
      main_ingredients: parsed.data.mainIngredients,
      portion_size: parsed.data.portionSize,
      portion_serves: parsed.data.portionServes,
      spice_level: parsed.data.spiceLevel,
      pickup_window_note: parsed.data.pickupWindowNote,
      is_active: parsed.data.isActive,
      is_sold_out: false,
    })
    .select("id")
    .single();

  if (saved.error) {
    await context.supabase.storage.from("cook-menu-images").remove([uploaded.path]);
    return { ok: false, message: "Menu item could not be created. Try again." };
  }

  revalidatePath("/my-kitchen/");
  revalidatePath("/my-kitchen/menu-items/");
  revalidatePath("/menu/");
  return { ok: true, message: "Menu item created." };
}

export async function updateMenuItemAction(
  _state: KitchenManagementActionState,
  formData: FormData,
): Promise<KitchenManagementActionState> {
  const itemId = z.string().uuid().safeParse(formData.get("itemId"));
  if (!itemId.success) return { ok: false, message: "Invalid menu item." };

  const parsed = menuItemSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    priceCents: formData.get("price"),
    quantityAvailable: formData.get("quantityAvailable"),
    category: formData.get("category"),
    dietaryTags: formData.get("dietaryTags") ?? "",
    allergens: formData.get("allergens") ?? "",
    mainIngredients: formData.get("mainIngredients") ?? "",
    portionSize: formData.get("portionSize") ?? "",
    portionServes: formData.get("portionServes"),
    spiceLevel: formData.get("spiceLevel"),
    pickupWindowNote: formData.get("pickupWindowNote") ?? "",
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please correct the highlighted menu item fields.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  const context = await requireCookWorkspaceContext();
  if (!context.ok) return { ok: false, message: context.message };

  const marketplace = context.supabase.schema("lck_marketplace");
  const existing = await marketplace
    .from("cook_menu_items")
    .select("image_url")
    .eq("id", itemId.data)
    .eq("cook_id", context.userId)
    .maybeSingle();
  if (existing.error || !existing.data) {
    return { ok: false, message: "Menu item could not be loaded." };
  }

  let uploadedPath: string | null = null;
  const image = formData.get("image");
  if (image instanceof File && image.size > 0) {
    const uploaded = await uploadKitchenImage({
      bucket: "cook-menu-images",
      file: image,
      userId: context.userId,
    });
    if ("error" in uploaded) {
      return { ok: false, message: uploaded.error, fieldErrors: { image: uploaded.error } };
    }
    uploadedPath = uploaded.path;
  }

  const saved = await marketplace
    .from("cook_menu_items")
    .update({
      name: parsed.data.name,
      description: parsed.data.description,
      ...(uploadedPath ? { image_url: uploadedPath } : {}),
      price_cents: parsed.data.priceCents,
      quantity_available: parsed.data.quantityAvailable,
      category: parsed.data.category,
      dietary_tags: parsed.data.dietaryTags,
      allergens: parsed.data.allergens,
      main_ingredients: parsed.data.mainIngredients,
      portion_size: parsed.data.portionSize,
      portion_serves: parsed.data.portionServes,
      spice_level: parsed.data.spiceLevel,
      pickup_window_note: parsed.data.pickupWindowNote,
      is_active: parsed.data.isActive,
      is_sold_out: parsed.data.quantityAvailable < 1,
    })
    .eq("id", itemId.data)
    .eq("cook_id", context.userId)
    .select("id")
    .single();

  if (saved.error) {
    if (uploadedPath)
      await context.supabase.storage.from("cook-menu-images").remove([uploadedPath]);
    return { ok: false, message: "Menu item could not be updated. Try again." };
  }

  const previousPath = existing.data.image_url;
  if (uploadedPath && previousPath && previousPath !== uploadedPath) {
    await context.supabase.storage.from("cook-menu-images").remove([previousPath]);
  }

  revalidatePath("/my-kitchen/");
  revalidatePath("/my-kitchen/menu-items/");
  revalidatePath("/menu/");
  return { ok: true, message: "Menu item updated." };
}

export async function setMenuItemAvailabilityAction(formData: FormData) {
  const parsed = z
    .object({
      itemId: z.string().uuid(),
      isActive: z.enum(["true", "false"]),
      isSoldOut: z.enum(["true", "false"]),
    })
    .safeParse({
      itemId: formData.get("itemId"),
      isActive: formData.get("isActive"),
      isSoldOut: formData.get("isSoldOut"),
    });
  if (!parsed.success) return;

  const context = await requireCookWorkspaceContext();
  if (!context.ok) return;

  await context.supabase
    .schema("lck_marketplace")
    .from("cook_menu_items")
    .update({
      is_active: parsed.data.isActive === "true",
      is_sold_out: parsed.data.isSoldOut === "true",
    })
    .eq("id", parsed.data.itemId)
    .eq("cook_id", context.userId);

  revalidatePath("/my-kitchen/");
  revalidatePath("/my-kitchen/menu-items/");
  revalidatePath("/menu/");
}

export async function deleteMenuItemAction(formData: FormData) {
  const parsed = z
    .object({
      itemId: z.string().uuid(),
      confirmDelete: z.literal("on"),
    })
    .safeParse({
      itemId: formData.get("itemId"),
      confirmDelete: formData.get("confirmDelete"),
    });
  if (!parsed.success) return;

  const context = await requireCookWorkspaceContext();
  if (!context.ok) return;

  const marketplace = context.supabase.schema("lck_marketplace");
  const existing = await marketplace
    .from("cook_menu_items")
    .select("image_url")
    .eq("id", parsed.data.itemId)
    .eq("cook_id", context.userId)
    .maybeSingle();
  if (existing.error || !existing.data) return;

  const deleted = await marketplace
    .from("cook_menu_items")
    .delete()
    .eq("id", parsed.data.itemId)
    .eq("cook_id", context.userId);
  if (deleted.error) return;

  if (existing.data.image_url) {
    await context.supabase.storage.from("cook-menu-images").remove([existing.data.image_url]);
  }

  revalidatePath("/my-kitchen/");
  revalidatePath("/my-kitchen/menu-items/");
  revalidatePath("/menu/");
}

export async function savePickupWindowsAction(
  _state: KitchenManagementActionState,
  formData: FormData,
): Promise<KitchenManagementActionState> {
  const windows = Array.from({ length: 7 }, (_, dayOfWeek) =>
    pickupWindowSchema.safeParse({
      dayOfWeek,
      startTime: formData.get(`startTime-${dayOfWeek}`),
      endTime: formData.get(`endTime-${dayOfWeek}`),
      isActive: formData.get(`isActive-${dayOfWeek}`) === "on",
    }),
  );
  const failed = windows.find((result) => !result.success);
  if (failed && !failed.success) {
    return {
      ok: false,
      message: "Please correct the highlighted pickup windows.",
      fieldErrors: zodFieldErrors(failed.error),
    };
  }

  const context = await requireCookWorkspaceContext();
  if (!context.ok) return { ok: false, message: context.message };

  const payload = windows.map((result) => {
    if (!result.success) throw new Error("Unexpected invalid pickup window.");
    return {
      day_of_week: result.data.dayOfWeek,
      start_time: result.data.startTime,
      end_time: result.data.endTime,
      is_active: result.data.isActive,
    };
  });

  const saved = await context.supabase
    .schema("lck_marketplace")
    .rpc("save_own_pickup_windows", { p_windows: payload });
  if (saved.error) return { ok: false, message: "Pickup windows could not be saved. Try again." };

  revalidatePath("/my-kitchen/");
  revalidatePath("/my-kitchen/profile/");
  revalidatePath("/menu/");
  return { ok: true, message: "Pickup windows saved." };
}
