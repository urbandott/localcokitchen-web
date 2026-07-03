import { describe, expect, it } from "vitest";
import {
  detectProfileImage,
  PROFILE_IMAGE_MAX_BYTES,
  profileDetailsSchema,
} from "@/features/profile/profile-validation";

describe("profile validation", () => {
  it("normalizes valid required names", () => {
    expect(profileDetailsSchema.parse({ firstName: "  María ", lastName: " López " })).toEqual({
      firstName: "María",
      lastName: "López",
    });
  });

  it("rejects missing or overly long names", () => {
    expect(profileDetailsSchema.safeParse({ firstName: " ", lastName: "" }).success).toBe(false);
    expect(profileDetailsSchema.safeParse({ firstName: "Asha", lastName: " " }).success).toBe(
      false,
    );
    expect(
      profileDetailsSchema.safeParse({ firstName: "A", lastName: "x".repeat(81) }).success,
    ).toBe(false);
  });

  it("detects supported images from file signatures rather than filenames", () => {
    expect(detectProfileImage(new Uint8Array([0xff, 0xd8, 0xff, 0x00]))).toEqual({
      contentType: "image/jpeg",
      extension: "jpg",
    });
    expect(
      detectProfileImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    ).toEqual({ contentType: "image/png", extension: "png" });
    expect(
      detectProfileImage(
        new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]),
      ),
    ).toEqual({ contentType: "image/webp", extension: "webp" });
    expect(detectProfileImage(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
  });

  it("keeps the upload limit at the private bucket's 2 MB limit", () => {
    expect(PROFILE_IMAGE_MAX_BYTES).toBe(2_097_152);
  });
});
