import { z } from "zod";
import type { CustomerMenuItem } from "@/types/database";

export const CART_STORAGE_KEY = "localcokitchen.cart.v2";
export const CART_ITEM_LIMIT = 10;

export type CartEntry = {
  id: string;
  quantity: number;
};

const cartEntrySchema = z.object({
  id: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(CART_ITEM_LIMIT),
});

export function getMaxCartQuantity(item: Pick<CustomerMenuItem, "quantity_available">): number {
  return Math.max(0, Math.min(item.quantity_available, CART_ITEM_LIMIT));
}

export function clampCartQuantity(
  quantity: unknown,
  item: Pick<CustomerMenuItem, "quantity_available">,
): number {
  const parsed = Number(quantity);
  if (!Number.isSafeInteger(parsed)) return 1;
  return Math.max(1, Math.min(parsed, getMaxCartQuantity(item)));
}

export function normalizeCartEntries(
  value: unknown,
  itemsById = new Map<string, CustomerMenuItem>(),
): CartEntry[] {
  const rows = Array.isArray(value) ? value : [];
  const seen = new Set<string>();
  const normalized: CartEntry[] = [];

  for (const row of rows) {
    const parsed = cartEntrySchema.safeParse(row);
    if (!parsed.success || seen.has(parsed.data.id)) continue;
    const item = itemsById.get(parsed.data.id);
    if (itemsById.size > 0 && (!item || item.quantity_available <= 0)) continue;
    normalized.push({
      id: parsed.data.id,
      quantity: item ? clampCartQuantity(parsed.data.quantity, item) : parsed.data.quantity,
    });
    seen.add(parsed.data.id);
  }

  return normalized;
}

export function addCartItem(cart: CartEntry[], item: CustomerMenuItem, quantity = 1): CartEntry[] {
  if (item.quantity_available <= 0) return normalizeCartEntries(cart);
  const existing = normalizeCartEntries(cart).find((entry) => entry.id === item.id);
  const next = normalizeCartEntries(cart).filter((entry) => entry.id !== item.id);
  next.push({
    id: item.id,
    quantity: clampCartQuantity((existing?.quantity ?? 0) + quantity, item),
  });
  return next;
}

export function setCartQuantity(
  cart: CartEntry[],
  item: CustomerMenuItem,
  quantity: unknown,
): CartEntry[] {
  const parsed = Number(quantity);
  const next = normalizeCartEntries(cart).filter((entry) => entry.id !== item.id);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return next;
  next.push({ id: item.id, quantity: clampCartQuantity(parsed, item) });
  return next;
}

export function removeCartItem(cart: CartEntry[], id: string): CartEntry[] {
  return normalizeCartEntries(cart).filter((entry) => entry.id !== id);
}

export function getSubtotalCents(
  cart: CartEntry[],
  itemsById: Map<string, CustomerMenuItem>,
): number {
  return normalizeCartEntries(cart, itemsById).reduce((total, entry) => {
    const item = itemsById.get(entry.id);
    return total + (item?.price_cents ?? 0) * entry.quantity;
  }, 0);
}
