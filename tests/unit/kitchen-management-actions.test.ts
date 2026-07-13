import { beforeEach, describe, expect, it, vi } from "vitest";

const managementMocks = vi.hoisted(() => ({
  applicationSingle: vi.fn(),
  createClient: vi.fn(),
  deleteMenuItem: vi.fn(),
  insertMenuItem: vi.fn(),
  menuItemSingle: vi.fn(),
  profileSingle: vi.fn(),
  profileUpsert: vi.fn(),
  revalidatePath: vi.fn(),
  remove: vi.fn(),
  rpc: vi.fn(),
  updateMenuItem: vi.fn(),
  upload: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: managementMocks.revalidatePath,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: managementMocks.createClient,
}));

import {
  createMenuItemAction,
  deleteMenuItemAction,
  savePickupWindowsAction,
  updateMenuItemAction,
  updateCookProfileAction,
} from "@/features/kitchen/actions";

const initialKitchenManagementActionState = { ok: false, message: "" };
const itemId = "11111111-1111-4111-8111-111111111111";

function pngHeader(width = 400, height = 400) {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

function profileForm(overrides: Record<string, string | File> = {}) {
  const formData = new FormData();
  formData.set("displayName", "Asha's Kitchen");
  formData.set("description", "Home cooked meals.");
  formData.set("cuisineType", "Pakistani");
  formData.set("pickupZipCode", "60601");
  formData.set("preorderCutoffHours", "24");
  formData.set("orderNotes", "Bring your order number.");
  formData.set("isPublic", "on");
  for (const [key, value] of Object.entries(overrides)) formData.set(key, value);
  return formData;
}

function profileDraftForm(overrides: Record<string, string | File> = {}) {
  const formData = profileForm(overrides);
  formData.delete("isPublic");
  return formData;
}

function menuForm(overrides: Record<string, string | File> = {}) {
  const formData = new FormData();
  formData.set("itemId", itemId);
  formData.set("name", "Chicken biryani");
  formData.set("description", "Fragrant rice and chicken.");
  formData.set("price", "12.50");
  formData.set("quantityAvailable", "8");
  formData.set("category", "Dinner");
  formData.set("dietaryTags", "Halal, Spicy");
  formData.set("allergens", "Dairy");
  formData.set("mainIngredients", "Chicken, Rice, Spices");
  formData.set("portionSize", "24");
  formData.set("portionServes", "1");
  formData.set("spiceLevel", "Medium");
  formData.set("pickupWindowNote", "Pickup after 5 PM.");
  formData.set("isActive", "on");
  formData.set("image", new File([pngHeader()], "ignored-name.png", { type: "image/png" }));
  for (const [key, value] of Object.entries(overrides)) formData.set(key, value);
  return formData;
}

function menuFormWithImages(count: number) {
  const formData = menuForm();
  formData.delete("image");
  for (let index = 0; index < count; index += 1) {
    formData.append(
      "images",
      new File([pngHeader()], `ignored-name-${index}.png`, { type: "image/png" }),
    );
  }
  return formData;
}

function pickupForm() {
  const formData = new FormData();
  for (let day = 0; day < 7; day += 1) {
    formData.set(`startTime-${day}`, "09:00");
    formData.set(`endTime-${day}`, "17:00");
    if (day === 1 || day === 2) formData.set(`isActive-${day}`, "on");
  }
  return formData;
}

function mockSupabase(
  options: {
    hasActiveMenuItem?: boolean;
    hasActivePickupWindow?: boolean;
    moderatorDisabled?: boolean;
    status?: string;
  } = {},
) {
  managementMocks.applicationSingle.mockResolvedValue({
    data: { status: options.status ?? "approved" },
    error: null,
  });
  managementMocks.profileSingle.mockResolvedValue({
    data: {
      moderator_disabled_at: options.moderatorDisabled ? "2026-07-07T00:00:00.000Z" : null,
      profile_image_url: null,
    },
    error: null,
  });
  managementMocks.profileUpsert.mockImplementation(() => ({
    select: () => ({
      single: vi.fn().mockResolvedValue({ data: { cook_id: "user-id" }, error: null }),
    }),
  }));
  managementMocks.insertMenuItem.mockImplementation(() => ({
    select: () => ({ single: vi.fn().mockResolvedValue({ data: { id: "item-id" }, error: null }) }),
  }));
  managementMocks.menuItemSingle.mockResolvedValue({
    data: {
      image_url: "user-id/old-image.png",
      image_urls: ["user-id/old-image.png", "user-id/old-image-2.png"],
      image_names: ["original biryani.png", "plated biryani.png"],
    },
    error: null,
  });
  managementMocks.updateMenuItem.mockImplementation(() => ({
    eq: () => ({
      eq: () => ({
        select: () => ({
          single: vi.fn().mockResolvedValue({ data: { id: itemId }, error: null }),
        }),
      }),
    }),
  }));
  managementMocks.deleteMenuItem.mockImplementation(() => ({
    eq: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
  }));
  managementMocks.rpc.mockResolvedValue({ data: null, error: null });
  managementMocks.upload.mockResolvedValue({ data: { path: "uploaded" }, error: null });
  managementMocks.remove.mockResolvedValue({ data: [], error: null });

  function ownerScopedMaybeSingleQuery() {
    return {
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: managementMocks.menuItemSingle,
        })),
      })),
    };
  }

  function readinessListQuery(rows: Array<{ id: string }>) {
    const query = {
      eq: vi.fn(() => query),
      limit: vi.fn().mockResolvedValue({ data: rows, error: null }),
    };
    return query;
  }

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-id" } }, error: null }),
    },
    schema: () => ({
      from: (table: string) => {
        if (table === "cook_applications") {
          return {
            select: () => ({
              eq: () => ({ maybeSingle: managementMocks.applicationSingle }),
            }),
          };
        }
        if (table === "cook_profiles") {
          return {
            select: () => ({
              eq: () => ({ maybeSingle: managementMocks.profileSingle }),
            }),
            upsert: managementMocks.profileUpsert,
          };
        }
        if (table === "cook_menu_items") {
          return {
            delete: managementMocks.deleteMenuItem,
            insert: managementMocks.insertMenuItem,
            select: (columns?: string) =>
              columns === "id"
                ? readinessListQuery(
                    options.hasActiveMenuItem === false ? [] : [{ id: "active-menu-item" }],
                  )
                : ownerScopedMaybeSingleQuery(),
            update: managementMocks.updateMenuItem,
          };
        }
        if (table === "cook_pickup_windows") {
          return {
            select: () =>
              readinessListQuery(
                options.hasActivePickupWindow === false ? [] : [{ id: "pickup-window" }],
              ),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      },
      rpc: managementMocks.rpc,
    }),
    storage: {
      from: () => ({
        remove: managementMocks.remove,
        upload: managementMocks.upload,
      }),
    },
  };
}

describe("kitchen management actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    managementMocks.createClient.mockResolvedValue(mockSupabase());
  });

  it("blocks profile publication when a moderator disabled the kitchen", async () => {
    managementMocks.createClient.mockResolvedValue(mockSupabase({ moderatorDisabled: true }));

    const result = await updateCookProfileAction(
      initialKitchenManagementActionState,
      profileForm(),
    );

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/moderator has disabled/i);
    expect(managementMocks.profileUpsert).not.toHaveBeenCalled();
  });

  it("blocks profile publication until the cook is approved", async () => {
    managementMocks.createClient.mockResolvedValue(mockSupabase({ status: "submitted" }));

    const result = await updateCookProfileAction(
      initialKitchenManagementActionState,
      profileForm(),
    );

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/must be approved/i);
    expect(managementMocks.profileUpsert).not.toHaveBeenCalled();
  });

  it("allows profile preparation before approval when the kitchen is not made public", async () => {
    managementMocks.createClient.mockResolvedValue(mockSupabase({ status: "submitted" }));

    const result = await updateCookProfileAction(
      initialKitchenManagementActionState,
      profileDraftForm(),
    );

    expect(result).toEqual({ ok: true, message: "Your public cook profile has been updated." });
    expect(managementMocks.profileUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        cook_id: "user-id",
        display_name: "Asha's Kitchen",
        is_public: false,
      }),
      { onConflict: "cook_id" },
    );
  });

  it("requires active menu and pickup-window readiness before publication", async () => {
    managementMocks.createClient.mockResolvedValue(
      mockSupabase({ hasActiveMenuItem: false, status: "approved" }),
    );

    const result = await updateCookProfileAction(
      initialKitchenManagementActionState,
      profileForm(),
    );

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/active, available menu item/i);
    expect(managementMocks.profileUpsert).not.toHaveBeenCalled();
  });

  it("allows menu item creation before approval as kitchen preparation", async () => {
    managementMocks.createClient.mockResolvedValue(mockSupabase({ status: "submitted" }));

    const result = await createMenuItemAction(initialKitchenManagementActionState, menuForm());

    expect(result).toEqual({ ok: true, message: "Menu item created." });
    expect(managementMocks.upload).toHaveBeenCalled();
    expect(managementMocks.insertMenuItem).toHaveBeenCalled();
  });

  it("rejects menu item changes when the cook application is suspended", async () => {
    managementMocks.createClient.mockResolvedValue(mockSupabase({ status: "suspended" }));

    const result = await createMenuItemAction(initialKitchenManagementActionState, menuForm());

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/suspended/i);
    expect(managementMocks.upload).not.toHaveBeenCalled();
    expect(managementMocks.insertMenuItem).not.toHaveBeenCalled();
  });

  it("uploads menu images to generated owner paths and inserts normalized menu data", async () => {
    const result = await createMenuItemAction(
      initialKitchenManagementActionState,
      menuFormWithImages(3),
    );

    expect(result).toEqual({ ok: true, message: "Menu item created." });
    expect(managementMocks.upload).toHaveBeenCalledTimes(3);
    expect(managementMocks.upload).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(/^user-id\/[0-9a-f-]+\.png$/),
      expect.any(Uint8Array),
      expect.objectContaining({ contentType: "image/png", upsert: false }),
    );
    expect(managementMocks.insertMenuItem).toHaveBeenCalledWith(
      expect.objectContaining({
        cook_id: "user-id",
        price_cents: 1250,
        dietary_tags: ["Halal", "Spicy"],
        allergens: ["Dairy"],
        main_ingredients: ["Chicken", "Rice", "Spices"],
        image_url: expect.stringMatching(/^user-id\/[0-9a-f-]+\.png$/),
        image_urls: [
          expect.stringMatching(/^user-id\/[0-9a-f-]+\.png$/),
          expect.stringMatching(/^user-id\/[0-9a-f-]+\.png$/),
          expect.stringMatching(/^user-id\/[0-9a-f-]+\.png$/),
        ],
        image_names: ["ignored-name-0.png", "ignored-name-1.png", "ignored-name-2.png"],
      }),
    );
  });

  it("rejects more than 3 menu item photos", async () => {
    const result = await createMenuItemAction(
      initialKitchenManagementActionState,
      menuFormWithImages(4),
    );

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/no more than 3/i);
    expect(managementMocks.upload).not.toHaveBeenCalled();
    expect(managementMocks.insertMenuItem).not.toHaveBeenCalled();
  });

  it("updates an existing menu item and removes selected replaced photos after save", async () => {
    const formData = menuForm();
    formData.set("removeImageUrls", "user-id/old-image.png");
    formData.append("removeImageUrls", "user-id/old-image-2.png");

    const result = await updateMenuItemAction(initialKitchenManagementActionState, formData);

    expect(result).toEqual({ ok: true, message: "Menu item updated." });
    expect(managementMocks.updateMenuItem).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Chicken biryani",
        price_cents: 1250,
        image_url: expect.stringMatching(/^user-id\/[0-9a-f-]+\.png$/),
        image_urls: [expect.stringMatching(/^user-id\/[0-9a-f-]+\.png$/)],
        image_names: ["ignored-name.png"],
      }),
    );
    expect(managementMocks.remove).toHaveBeenCalledWith([
      "user-id/old-image.png",
      "user-id/old-image-2.png",
    ]);
  });

  it("keeps retained menu photo display names when adding a replacement", async () => {
    const formData = menuForm();
    formData.set("removeImageUrls", "user-id/old-image-2.png");

    const result = await updateMenuItemAction(initialKitchenManagementActionState, formData);

    expect(result).toEqual({ ok: true, message: "Menu item updated." });
    expect(managementMocks.updateMenuItem).toHaveBeenCalledWith(
      expect.objectContaining({
        image_urls: ["user-id/old-image.png", expect.stringMatching(/^user-id\/[0-9a-f-]+\.png$/)],
        image_names: ["original biryani.png", "ignored-name.png"],
      }),
    );
  });

  it("rejects deleting all menu photos without adding a replacement", async () => {
    const formData = menuForm({ image: new File([], "empty.png", { type: "image/png" }) });
    formData.delete("image");
    formData.set("removeImageUrls", "user-id/old-image.png");
    formData.append("removeImageUrls", "user-id/old-image-2.png");

    const result = await updateMenuItemAction(initialKitchenManagementActionState, formData);

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/at least one menu item photo/i);
    expect(managementMocks.upload).not.toHaveBeenCalled();
    expect(managementMocks.updateMenuItem).not.toHaveBeenCalled();
  });

  it("rejects edits that would leave more than 3 total menu photos", async () => {
    const formData = menuFormWithImages(2);

    const result = await updateMenuItemAction(initialKitchenManagementActionState, formData);

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/no more than 3 photos/i);
    expect(managementMocks.upload).not.toHaveBeenCalled();
    expect(managementMocks.updateMenuItem).not.toHaveBeenCalled();
  });

  it("deletes a confirmed owner-scoped menu item and removes its image", async () => {
    const formData = new FormData();
    formData.set("itemId", itemId);
    formData.set("confirmDelete", "on");

    await deleteMenuItemAction(formData);

    expect(managementMocks.deleteMenuItem).toHaveBeenCalled();
    expect(managementMocks.remove).toHaveBeenCalledWith([
      "user-id/old-image.png",
      "user-id/old-image-2.png",
    ]);
  });

  it("does not delete a menu item without explicit confirmation", async () => {
    const formData = new FormData();
    formData.set("itemId", itemId);

    await deleteMenuItemAction(formData);

    expect(managementMocks.createClient).not.toHaveBeenCalled();
    expect(managementMocks.deleteMenuItem).not.toHaveBeenCalled();
  });

  it("saves validated weekly pickup windows through the owner-scoped RPC", async () => {
    const result = await savePickupWindowsAction(initialKitchenManagementActionState, pickupForm());

    expect(result).toEqual({ ok: true, message: "Pickup windows saved." });
    expect(managementMocks.rpc).toHaveBeenCalledWith("save_own_pickup_windows", {
      p_windows: expect.arrayContaining([
        { day_of_week: 1, start_time: "09:00", end_time: "17:00", is_active: true },
        { day_of_week: 3, start_time: "09:00", end_time: "17:00", is_active: false },
      ]),
    });
  });
});
