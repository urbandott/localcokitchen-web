import { describe, expect, it } from "vitest";
import {
  detectProfileImage,
  PROFILE_IMAGE_MAX_BYTES,
  PROFILE_IMAGE_MAX_DIMENSION,
  PROFILE_IMAGE_MAX_PIXELS,
  profileDetailsSchema,
  validateProfileImage,
} from "@/features/profile/profile-validation";

function pngHeader(width: number, height: number) {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

function jpegHeader(width: number, height: number) {
  return new Uint8Array([
    0xff,
    0xd8,
    0xff,
    0xc0,
    0x00,
    0x07,
    0x08,
    height >> 8,
    height & 0xff,
    width >> 8,
    width & 0xff,
  ]);
}

function webpExtendedHeader(width: number, height: number) {
  const bytes = new Uint8Array(30);
  bytes.set(new TextEncoder().encode("RIFF"), 0);
  bytes.set(new TextEncoder().encode("WEBP"), 8);
  bytes.set(new TextEncoder().encode("VP8X"), 12);
  const writeDimension = (offset: number, value: number) => {
    const encoded = value - 1;
    bytes[offset] = encoded & 0xff;
    bytes[offset + 1] = (encoded >> 8) & 0xff;
    bytes[offset + 2] = (encoded >> 16) & 0xff;
  };
  writeDimension(24, width);
  writeDimension(27, height);
  return bytes;
}

describe("profile validation", () => {
  it("normalizes valid required names", () => {
    expect(
      profileDetailsSchema.parse({ firstName: "  Mari\u0301a   José ", lastName: " López " }),
    ).toEqual({
      firstName: "María José",
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
    expect(
      profileDetailsSchema.safeParse({ firstName: "Asha\u202e", lastName: "Patel" }).success,
    ).toBe(false);
    expect(
      profileDetailsSchema.safeParse({ firstName: "Asha\nAdmin", lastName: "Patel" }).success,
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

  it("accepts reasonable image dimensions and rejects resource-abuse dimensions", () => {
    expect(validateProfileImage(pngHeader(1200, 1200))).toEqual({
      contentType: "image/png",
      extension: "png",
      width: 1200,
      height: 1200,
    });
    expect(validateProfileImage(pngHeader(PROFILE_IMAGE_MAX_DIMENSION + 1, 100))).toBeNull();
    expect(validateProfileImage(pngHeader(4000, 4001))).toBeNull();
    expect(PROFILE_IMAGE_MAX_PIXELS).toBe(16_000_000);
  });

  it("reads dimensions from supported JPEG and WebP headers", () => {
    expect(validateProfileImage(jpegHeader(800, 600))).toMatchObject({
      extension: "jpg",
      width: 800,
      height: 600,
    });
    expect(validateProfileImage(webpExtendedHeader(640, 480))).toMatchObject({
      extension: "webp",
      width: 640,
      height: 480,
    });
  });

  it("rejects truncated images that have only a valid signature", () => {
    expect(
      validateProfileImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    ).toBeNull();
  });
});
