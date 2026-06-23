import type { CustomerMenuItem } from "@/types/database";

export type MenuFilters = {
  search: string;
  category: string;
  dietary: string;
  allergen: string;
  cuisine: string;
  spice: string;
  cook: string;
  minQuantity: number;
};

export const emptyMenuFilters: MenuFilters = {
  search: "",
  category: "",
  dietary: "",
  allergen: "",
  cuisine: "",
  spice: "",
  cook: "",
  minQuantity: 1,
};

export function normalizeSearch(value: string): string {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
}

function list(value: string[] | null | undefined): string[] {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function itemMatchesFilters(item: CustomerMenuItem, filters: MenuFilters): boolean {
  const searchTerms = normalizeSearch(filters.search).split(" ").filter(Boolean);
  const haystack = normalizeSearch(
    [
      item.name,
      item.description,
      item.category,
      item.cook_display_name,
      item.cook_cuisine_type ?? "",
      ...list(item.dietary_tags),
      ...list(item.main_ingredients),
    ].join(" "),
  );

  if (searchTerms.length > 0 && !searchTerms.every((term) => haystack.includes(term))) return false;
  if (filters.category && item.category.toLowerCase() !== filters.category.toLowerCase())
    return false;
  if (
    filters.dietary &&
    !list(item.dietary_tags)
      .map((tag) => tag.toLowerCase())
      .includes(filters.dietary.toLowerCase())
  )
    return false;
  if (
    filters.allergen &&
    list(item.allergens)
      .map((tag) => tag.toLowerCase())
      .includes(filters.allergen.toLowerCase())
  )
    return false;
  if (
    filters.cuisine &&
    (item.cook_cuisine_type ?? "").toLowerCase() !== filters.cuisine.toLowerCase()
  )
    return false;
  if (filters.spice && (item.spice_level ?? "").toLowerCase() !== filters.spice.toLowerCase())
    return false;
  if (filters.cook && item.cook_id !== filters.cook) return false;
  if (item.quantity_available < filters.minQuantity) return false;
  return true;
}

export function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
}
