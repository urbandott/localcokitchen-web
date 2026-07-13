import { z } from "zod";

export const COOK_APPLICATION_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const COOK_APPLICATION_MAX_TOTAL_FILE_BYTES = 15 * 1024 * 1024;

const unsupportedCharacters = /[\p{Cc}\p{Cf}\p{Cs}\p{Co}]/u;
const alphabeticCharacters = /\p{L}/u;

function normalizedText(label: string, min: number, max: number) {
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
        .min(min, `${label} must be at least ${min} characters.`)
        .max(max, `${label} must be ${max} characters or fewer.`)
        .refine((value) => !unsupportedCharacters.test(value), {
          message: `${label} contains unsupported characters.`,
        }),
    );
}

function optionalNormalizedText(label: string, min: number, max: number) {
  return z
    .string()
    .transform((value) =>
      value
        .normalize("NFC")
        .trim()
        .replace(/\p{Zs}+/gu, " "),
    )
    .pipe(
      z.string().superRefine((value, context) => {
        if (!value) return;
        if (value.length < min) {
          context.addIssue({
            code: "custom",
            message: `${label} must be at least ${min} characters.`,
          });
        }
        if (value.length > max) {
          context.addIssue({
            code: "custom",
            message: `${label} must be ${max} characters or fewer.`,
          });
        }
        if (unsupportedCharacters.test(value)) {
          context.addIssue({
            code: "custom",
            message: `${label} contains unsupported characters.`,
          });
        }
      }),
    )
    .transform((value) => value || null);
}

export function normalizeUsPhone(value: string): string {
  if (alphabeticCharacters.test(value)) return value.trim();
  const digits = value.replace(/\D/g, "");
  const withoutCountryCode =
    digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;

  if (withoutCountryCode.length !== 10) return value.trim();

  return `+1 ${withoutCountryCode.slice(0, 3)}-${withoutCountryCode.slice(
    3,
    6,
  )}-${withoutCountryCode.slice(6)}`;
}

export const cookApplicationSchema = z.object({
  legalName: normalizedText("Legal name", 2, 120),
  phone: z
    .string()
    .transform((value) => normalizeUsPhone(value))
    .pipe(z.string().regex(/^\+1 [0-9]{3}-[0-9]{3}-[0-9]{4}$/, "Enter a valid US phone number.")),
  pickupAddress: normalizedText("Pickup address", 8, 240),
  pickupZipCode: z
    .string()
    .trim()
    .regex(/^[0-9]{5}$/, "Enter a valid 5-digit ZIP code."),
  foodHandlerTrainingCompleted: z.literal(true, {
    error: "Confirm that you have completed food handler training.",
  }),
});

export const cookApplicationDraftSchema = z.object({
  legalName: optionalNormalizedText("Legal name", 2, 120),
  phone: z
    .string()
    .transform((value) => {
      const trimmed = value.trim();
      return trimmed ? normalizeUsPhone(trimmed) : null;
    })
    .pipe(
      z
        .string()
        .regex(/^\+1 [0-9]{3}-[0-9]{3}-[0-9]{4}$/, "Enter a valid US phone number.")
        .nullable(),
    ),
  pickupAddress: optionalNormalizedText("Pickup address", 8, 240),
  pickupZipCode: z
    .string()
    .trim()
    .transform((value) => value || null)
    .pipe(
      z
        .string()
        .regex(/^[0-9]{5}$/, "Enter a valid 5-digit ZIP code.")
        .nullable(),
    ),
  foodHandlerTrainingCompleted: z.boolean(),
});

export type CookApplicationInput = z.infer<typeof cookApplicationSchema>;
export type CookApplicationDraftInput = z.infer<typeof cookApplicationDraftSchema>;

export type SupportedCookApplicationFile = {
  contentType: "application/pdf" | "image/jpeg" | "image/png" | "image/webp";
  extension: "pdf" | "jpg" | "png" | "webp";
};

function byteAt(bytes: Uint8Array, offset: number): number {
  return bytes[offset] ?? 0;
}

export function detectCookApplicationFile(bytes: Uint8Array): SupportedCookApplicationFile | null {
  if (
    bytes.length >= 5 &&
    byteAt(bytes, 0) === 0x25 &&
    byteAt(bytes, 1) === 0x50 &&
    byteAt(bytes, 2) === 0x44 &&
    byteAt(bytes, 3) === 0x46 &&
    byteAt(bytes, 4) === 0x2d
  ) {
    return { contentType: "application/pdf", extension: "pdf" };
  }

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

export function validateCookApplicationFileBytes(
  bytes: Uint8Array,
  options: { imagesOnly?: boolean } = {},
): SupportedCookApplicationFile | null {
  const detected = detectCookApplicationFile(bytes);
  if (!detected) return null;
  if (options.imagesOnly && detected.contentType === "application/pdf") return null;

  return detected;
}
