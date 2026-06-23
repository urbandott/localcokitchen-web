import { describe, expect, it } from "vitest";
import {
  emptyMenuFilters,
  itemMatchesFilters,
  normalizeSearch,
} from "@/features/menu/menu-filters";
import type { CustomerMenuItem } from "@/types/database";

const item: CustomerMenuItem = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  cook_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  name: "Chicken Curry",
  description: "Slow cooked with tomato",
  image_url: null,
  price_cents: 1000,
  quantity_available: 3,
  category: "Dinner",
  allergens: ["Dairy"],
  dietary_tags: ["Halal"],
  main_ingredients: ["Chicken", "Tomato"],
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
};

describe("menu filters", () => {
  it("normalizes search text", () => {
    expect(normalizeSearch(" Chicken\nCURRY ")).toBe("chicken curry");
  });

  it("matches across item, cook, cuisine, tag, and ingredient fields", () => {
    expect(itemMatchesFilters(item, { ...emptyMenuFilters, search: "asha tomato" })).toBe(true);
    expect(
      itemMatchesFilters(item, { ...emptyMenuFilters, dietary: "Halal", cuisine: "Pakistani" }),
    ).toBe(true);
    expect(itemMatchesFilters(item, { ...emptyMenuFilters, allergen: "Dairy" })).toBe(false);
    expect(itemMatchesFilters(item, { ...emptyMenuFilters, minQuantity: 4 })).toBe(false);
  });
});
