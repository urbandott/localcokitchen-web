import { z } from "zod";

export const PROFILE_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
export const PROFILE_IMAGE_MAX_DIMENSION = 4096;
export const PROFILE_IMAGE_MAX_PIXELS = 16_000_000;
export const PROFILE_NAME_MAX_LENGTH = 80;

const unsupportedNameCharacters = /[\p{Cc}\p{Cf}\p{Cs}\p{Co}]/u;

function profileNameSchema(label: "first" | "last") {
  const displayLabel = `${label.charAt(0).toUpperCase()}${label.slice(1)} name`;

  return z
    .string()
    .transform((value) =>
      value
        .normalize("NFC")
        .trim()
        .replace(/\p{Zs}+/gu, " "),
    )
    .pipe(
      z
        .string()
        .min(1, `Enter your ${label} name.`)
        .max(
          PROFILE_NAME_MAX_LENGTH,
          `${displayLabel} must be ${PROFILE_NAME_MAX_LENGTH} characters or fewer.`,
        )
        .refine((value) => !unsupportedNameCharacters.test(value), {
          message: `${displayLabel} contains unsupported characters.`,
        }),
    );
}

export const profileDetailsSchema = z.object({
  firstName: profileNameSchema("first"),
  lastName: profileNameSchema("last"),
});

export type SupportedProfileImage = {
  contentType: "image/jpeg" | "image/png" | "image/webp";
  extension: "jpg" | "png" | "webp";
};

export type ValidatedProfileImage = SupportedProfileImage & {
  height: number;
  width: number;
};

function byteAt(bytes: Uint8Array, offset: number): number {
  return bytes[offset] ?? 0;
}

export function detectProfileImage(bytes: Uint8Array): SupportedProfileImage | null {
  if (
    bytes.length >= 3 &&
    byteAt(bytes, 0) === 0xff &&
    byteAt(bytes, 1) === 0xd8 &&
    byteAt(bytes, 2) === 0xff
  ) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }

  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (
    bytes.length >= pngSignature.length &&
    pngSignature.every((byte, index) => byteAt(bytes, index) === byte)
  ) {
    return { contentType: "image/png", extension: "png" };
  }

  const isWebp =
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";

  return isWebp ? { contentType: "image/webp", extension: "webp" } : null;
}

function readUint16BigEndian(bytes: Uint8Array, offset: number): number {
  return byteAt(bytes, offset) * 256 + byteAt(bytes, offset + 1);
}

function readUint24LittleEndian(bytes: Uint8Array, offset: number): number {
  return (
    byteAt(bytes, offset) + byteAt(bytes, offset + 1) * 256 + byteAt(bytes, offset + 2) * 65_536
  );
}

function imageDimensions(
  bytes: Uint8Array,
  extension: SupportedProfileImage["extension"],
): { height: number; width: number } | null {
  if (extension === "png") {
    const isIhdr = bytes.length >= 24 && String.fromCharCode(...bytes.slice(12, 16)) === "IHDR";
    if (!isIhdr) return null;

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }

  if (extension === "jpg") {
    const startOfFrameMarkers = new Set([
      0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
    ]);
    let offset = 2;

    while (offset + 3 < bytes.length) {
      if (byteAt(bytes, offset) !== 0xff) {
        offset += 1;
        continue;
      }
      while (offset < bytes.length && byteAt(bytes, offset) === 0xff) offset += 1;
      const marker = byteAt(bytes, offset);
      offset += 1;

      if (marker === 0xd8 || marker === 0xd9) continue;
      if (marker === 0xda || offset + 1 >= bytes.length) return null;

      const segmentLength = readUint16BigEndian(bytes, offset);
      if (segmentLength < 2 || offset + segmentLength > bytes.length) return null;
      if (startOfFrameMarkers.has(marker) && segmentLength >= 7) {
        return {
          height: readUint16BigEndian(bytes, offset + 3),
          width: readUint16BigEndian(bytes, offset + 5),
        };
      }
      offset += segmentLength;
    }
    return null;
  }

  if (bytes.length < 30) return null;
  const chunkType = String.fromCharCode(...bytes.slice(12, 16));

  if (chunkType === "VP8X") {
    return {
      width: readUint24LittleEndian(bytes, 24) + 1,
      height: readUint24LittleEndian(bytes, 27) + 1,
    };
  }

  if (chunkType === "VP8L" && byteAt(bytes, 20) === 0x2f) {
    return {
      width: 1 + ((byteAt(bytes, 21) | (byteAt(bytes, 22) << 8)) & 0x3fff),
      height:
        1 +
        (((byteAt(bytes, 22) >> 6) | (byteAt(bytes, 23) << 2) | (byteAt(bytes, 24) << 10)) &
          0x3fff),
    };
  }

  const isVp8 =
    chunkType === "VP8 " &&
    byteAt(bytes, 23) === 0x9d &&
    byteAt(bytes, 24) === 0x01 &&
    byteAt(bytes, 25) === 0x2a;
  return isVp8
    ? {
        width: (byteAt(bytes, 26) | (byteAt(bytes, 27) << 8)) & 0x3fff,
        height: (byteAt(bytes, 28) | (byteAt(bytes, 29) << 8)) & 0x3fff,
      }
    : null;
}

export function validateProfileImage(bytes: Uint8Array): ValidatedProfileImage | null {
  const format = detectProfileImage(bytes);
  if (!format) return null;

  const dimensions = imageDimensions(bytes, format.extension);
  if (
    !dimensions ||
    dimensions.width < 1 ||
    dimensions.height < 1 ||
    dimensions.width > PROFILE_IMAGE_MAX_DIMENSION ||
    dimensions.height > PROFILE_IMAGE_MAX_DIMENSION ||
    dimensions.width * dimensions.height > PROFILE_IMAGE_MAX_PIXELS
  ) {
    return null;
  }

  return { ...format, ...dimensions };
}
