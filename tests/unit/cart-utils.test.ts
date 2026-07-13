import { describe, expect, it } from "vitest";
import {
  addCartItem,
  clampCartQuantity,
  getSubtotalCents,
  normalizeCartEntries,
  setCartQuantity,
} from "@/features/cart/cart-utils";
import type { CustomerMenuItem } from "@/types/database";

function item(overrides: Partial<CustomerMenuItem> = {}): CustomerMenuItem {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    cook_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    name: "Curry",
    description: "Home cooked curry",
    image_url: null,
    image_urls: [],
    image_names: [],
    price_cents: 1250,
    quantity_available: 4,
    category: "Dinner",
    allergens: ["Dairy"],
    dietary_tags: ["Gluten-free"],
    main_ingredients: ["Chicken"],
    portion_size: null,
    portion_serves: null,
    spice_level: "Medium",
    pickup_window_note: null,
    cook_display_name: "Asha Kitchen",
    cook_profile_image_url: null,
    cook_description: null,
    cook_cuisine_type: "Pakistani",
    cook_order_notes: null,
    cook_rating: 0,
    cook_review_count: 0,
    cook_public_menu_count: 1,
    created_at: "2026-06-23T00:00:00Z",
    ...overrides,
  };
}

describe("cart utilities", () => {
  it("clamps quantities to stock and the global item limit", () => {
    expect(clampCartQuantity(99, item({ quantity_available: 2 }))).toBe(2);
    expect(clampCartQuantity(99, item({ quantity_available: 20 }))).toBe(10);
    expect(clampCartQuantity(Number.NaN, item())).toBe(1);
  });

  it("deduplicates corrupted cart data", () => {
    expect(
      normalizeCartEntries([
        { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", quantity: 2 },
        { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", quantity: 3 },
        { id: "bad", quantity: 1 },
      ]),
    ).toEqual([{ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", quantity: 2 }]);
  });

  it("supports multi-cook carts and subtotal calculation", () => {
    const first = item();
    const second = item({
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      cook_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      price_cents: 500,
    });
    const cart = addCartItem(addCartItem([], first, 2), second, 3);
    const itemsById = new Map([
      [first.id, first],
      [second.id, second],
    ]);
    expect(cart).toHaveLength(2);
    expect(getSubtotalCents(cart, itemsById)).toBe(4000);
  });

  it("removes invalid manual quantities", () => {
    expect(setCartQuantity([{ id: item().id, quantity: 2 }], item(), -1)).toEqual([]);
  });
});
