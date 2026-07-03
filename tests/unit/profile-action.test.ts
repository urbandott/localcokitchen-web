import { beforeEach, describe, expect, it, vi } from "vitest";

const profileMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getCurrent: vi.fn(),
  remove: vi.fn(),
  revalidatePath: vi.fn(),
  saved: vi.fn(),
  update: vi.fn(),
  upload: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: profileMocks.revalidatePath,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: profileMocks.createClient,
}));

import { updateProfileAction } from "@/features/profile/actions";

const initialState = { ok: false, message: "" };

function pngHeader(width = 400, height = 400) {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

function formData(values: { firstName?: string; lastName?: string; avatar?: File }) {
  const data = new FormData();
  if (values.firstName !== undefined) data.set("firstName", values.firstName);
  if (values.lastName !== undefined) data.set("lastName", values.lastName);
  if (values.avatar) data.set("avatar", values.avatar);
  return data;
}

describe("profile update action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    profileMocks.getCurrent.mockResolvedValue({ data: { avatar_path: null }, error: null });
    profileMocks.saved.mockResolvedValue({ data: { id: "user-id" }, error: null });
    profileMocks.upload.mockResolvedValue({ data: { path: "uploaded" }, error: null });
    profileMocks.remove.mockResolvedValue({ data: [], error: null });
    profileMocks.update.mockImplementation(() => ({
      eq: () => ({
        select: () => ({
          single: profileMocks.saved,
        }),
      }),
    }));
    profileMocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-id" } },
          error: null,
        }),
      },
      schema: () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              single: profileMocks.getCurrent,
            }),
          }),
          update: profileMocks.update,
        }),
      }),
      storage: {
        from: () => ({
          upload: profileMocks.upload,
          remove: profileMocks.remove,
        }),
      },
    });
  });

  it("rejects invalid names before accessing Supabase", async () => {
    const result = await updateProfileAction(
      initialState,
      formData({ firstName: " ", lastName: "" }),
    );

    expect(result.ok).toBe(false);
    expect(result.fieldErrors?.firstName).toBeTruthy();
    expect(profileMocks.createClient).not.toHaveBeenCalled();
  });

  it("updates only the authenticated user's normalized profile fields", async () => {
    const result = await updateProfileAction(
      initialState,
      formData({ firstName: "  Asha ", lastName: " Patel " }),
    );

    expect(result).toEqual({ ok: true, message: "Your profile has been updated." });
    expect(profileMocks.update).toHaveBeenCalledWith({
      first_name: "Asha",
      last_name: "Patel",
      full_name: "Asha Patel",
    });
    expect(profileMocks.revalidatePath).toHaveBeenCalledWith("/profile/");
  });

  it("rejects MIME-spoofed profile images", async () => {
    const avatar = new File(["<svg onload=alert(1)>"], "avatar.png", {
      type: "image/png",
    });
    const result = await updateProfileAction(
      initialState,
      formData({ firstName: "Asha", lastName: "Patel", avatar }),
    );

    expect(result.ok).toBe(false);
    expect(result.fieldErrors?.avatar).toMatch(/image must be valid/i);
    expect(profileMocks.upload).not.toHaveBeenCalled();
    expect(profileMocks.update).not.toHaveBeenCalled();
  });

  it("uploads a valid image to a generated owner path without upsert", async () => {
    const avatar = new File([pngHeader()], "untrusted-name.png", { type: "image/png" });
    const result = await updateProfileAction(
      initialState,
      formData({ firstName: "Asha", lastName: "Patel", avatar }),
    );

    expect(result.ok).toBe(true);
    expect(profileMocks.upload).toHaveBeenCalledWith(
      expect.stringMatching(/^user-id\/[0-9a-f-]+\.png$/),
      expect.any(Uint8Array),
      expect.objectContaining({ contentType: "image/png", upsert: false }),
    );
    expect(profileMocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        first_name: "Asha",
        avatar_path: expect.stringMatching(/^user-id\/[0-9a-f-]+\.png$/),
      }),
    );
  });

  it("rejects images with abusive dimensions before upload", async () => {
    const avatar = new File([pngHeader(5000, 100)], "large-dimensions.png", {
      type: "image/png",
    });
    const result = await updateProfileAction(
      initialState,
      formData({ firstName: "Asha", lastName: "Patel", avatar }),
    );

    expect(result.ok).toBe(false);
    expect(result.fieldErrors?.avatar).toMatch(/4096/);
    expect(profileMocks.upload).not.toHaveBeenCalled();
    expect(profileMocks.update).not.toHaveBeenCalled();
  });

  it("rejects empty and oversized files before accessing Supabase", async () => {
    const empty = new File([], "empty.png", { type: "image/png" });
    const emptyResult = await updateProfileAction(
      initialState,
      formData({ firstName: "Asha", lastName: "Patel", avatar: empty }),
    );
    expect(emptyResult.fieldErrors?.avatar).toMatch(/non-empty/i);

    const oversized = new File([new Uint8Array(2_097_153)], "oversized.png", {
      type: "image/png",
    });
    const oversizedResult = await updateProfileAction(
      initialState,
      formData({ firstName: "Asha", lastName: "Patel", avatar: oversized }),
    );
    expect(oversizedResult.fieldErrors?.avatar).toMatch(/2 MB/i);
    expect(profileMocks.createClient).not.toHaveBeenCalled();
  });
});
