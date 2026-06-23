import { z } from "zod";

export const uuidSchema = z.string().uuid();
export const safeRedirectPathSchema = z
  .string()
  .default("/")
  .transform((value) => (value.startsWith("/") && !value.startsWith("//") ? value : "/"));

export const cartQuantitySchema = z.coerce.number().int().min(1).max(10);
export const searchSchema = z
  .string()
  .max(160)
  .transform((value) => value.normalize("NFKC").replace(/\s+/g, " ").trim());

export const stringListSchema = z.array(z.string().trim().min(1).max(80)).max(20).default([]);
