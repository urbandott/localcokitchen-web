import { z } from "zod";

const unsupportedCharacters = /[\p{Cc}\p{Cf}\p{Cs}\p{Co}]/u;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

function textField(label: string, min: number, max: number) {
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

function optionalTextField(label: string, max: number) {
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
        .max(max, `${label} must be ${max} characters or fewer.`)
        .refine((value) => !unsupportedCharacters.test(value), {
          message: `${label} contains unsupported characters.`,
        }),
    )
    .transform((value) => value || null);
}

export function parseCommaList(value: string, maxItems: number, maxLength: number): string[] {
  const items = value
    .normalize("NFC")
    .split(",")
    .map((item) => item.trim().replace(/\p{Zs}+/gu, " "))
    .filter(Boolean);
  const unique = [...new Set(items)];
  if (unique.length > maxItems) throw new Error(`Use ${maxItems} or fewer values.`);
  if (unique.some((item) => item.length > maxLength || unsupportedCharacters.test(item))) {
    throw new Error(`Each value must be ${maxLength} characters or fewer.`);
  }
  return unique;
}

function centsFromDollars(value: string): number {
  const normalized = value.trim();
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(normalized)) return Number.NaN;
  return Math.round(Number(normalized) * 100);
}

export const cookProfileSchema = z.object({
  displayName: textField("Display name", 2, 120),
  description: optionalTextField("Description", 3500),
  cuisineType: optionalTextField("Cuisine type", 80),
  pickupZipCode: z
    .string()
    .trim()
    .regex(/^[0-9]{5}$/, "Enter a valid 5-digit pickup ZIP code."),
  preorderCutoffHours: z.coerce
    .number()
    .int("Preorder cutoff must be a whole number.")
    .min(1, "Preorder cutoff must be at least 1 hour.")
    .max(168, "Preorder cutoff must be 168 hours or fewer."),
  orderNotes: optionalTextField("Order notes", 800),
  isPublic: z.boolean(),
});

export const menuItemSchema = z.object({
  name: textField("Item name", 1, 120),
  description: textField("Description", 1, 1200),
  priceCents: z.string().transform(centsFromDollars).pipe(z.number().int().min(1).max(10_000_000)),
  quantityAvailable: z.coerce.number().int().min(1).max(10_000),
  category: textField("Category", 1, 80),
  dietaryTags: z.string().transform((value, context) => {
    try {
      return parseCommaList(value, 10, 40);
    } catch (error) {
      context.addIssue({ code: "custom", message: (error as Error).message });
      return z.NEVER;
    }
  }),
  allergens: z.string().transform((value, context) => {
    try {
      const allergens = parseCommaList(value, 12, 40);
      return allergens.length > 0 ? allergens : ["None declared"];
    } catch (error) {
      context.addIssue({ code: "custom", message: (error as Error).message });
      return z.NEVER;
    }
  }),
  mainIngredients: z.string().transform((value, context) => {
    try {
      const ingredients = parseCommaList(value, 20, 60);
      if (ingredients.length === 0) {
        context.addIssue({ code: "custom", message: "Add at least one main ingredient." });
        return z.NEVER;
      }
      return ingredients;
    } catch (error) {
      context.addIssue({ code: "custom", message: (error as Error).message });
      return z.NEVER;
    }
  }),
  portionSize: optionalTextField("Portion size", 120),
  portionServes: z.coerce.number().int().min(1).max(50),
  spiceLevel: z.enum(["Not spicy", "Mild", "Medium", "Hot", "Extra hot"]),
  pickupWindowNote: optionalTextField("Pickup note", 500),
  isActive: z.boolean(),
});

export const pickupWindowSchema = z
  .object({
    dayOfWeek: z.coerce.number().int().min(0).max(6),
    startTime: z.string().regex(timePattern, "Enter a valid start time."),
    endTime: z.string().regex(timePattern, "Enter a valid end time."),
    isActive: z.boolean(),
  })
  .refine((value) => value.startTime < value.endTime, {
    message: "Start time must be before end time.",
    path: ["endTime"],
  });

export type CookProfileInput = z.infer<typeof cookProfileSchema>;
export type MenuItemInput = z.infer<typeof menuItemSchema>;
export type PickupWindowInput = z.infer<typeof pickupWindowSchema>;
