const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const menu = require("../js/menu.js");
const root = path.resolve(__dirname, "..");

const cookA = "11111111-1111-4111-8111-111111111111";
const cookB = "22222222-2222-4222-8222-222222222222";

const item = (overrides = {}) => ({
  id: overrides.id || "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  cook_id: overrides.cook_id || cookA,
  name: "Chicken Curry",
  description: "Slow cooked curry",
  category: "Dinner",
  dietary_tags: ["Gluten-free"],
  allergens: ["Dairy"],
  main_ingredients: ["Chicken", "Tomato"],
  spice_level: "Medium",
  cook_display_name: "Asha Kitchen",
  cook_cuisine_type: "Pakistani",
  price_cents: 1299,
  quantity_available: 4,
  is_active: true,
  is_sold_out: false,
  ...overrides,
});

test("search normalization is case-insensitive and collapses whitespace", () => {
  assert.equal(menu.normalizeText("  Chicken\n\tCURRY  "), "chicken curry");
  assert.equal(menu.itemMatchesFilters(item(), { search: "asha pakistani", minQuantity: 1 }), true);
  assert.equal(menu.itemMatchesFilters(item(), { search: "missing", minQuantity: 1 }), false);
});

test("filters combine predictably across category, tags, allergens, cuisine, spice, cook, and quantity", () => {
  const sample = item();
  assert.equal(
    menu.itemMatchesFilters(sample, {
      category: "Dinner",
      dietary: "Gluten-free",
      allergen: "Peanut",
      cuisine: "Pakistani",
      spice: "Medium",
      cook: cookA,
      minQuantity: 2,
    }),
    true,
  );
  assert.equal(menu.itemMatchesFilters(sample, { allergen: "Dairy", minQuantity: 1 }), false);
  assert.equal(menu.itemMatchesFilters(sample, { minQuantity: 5 }), false);
});

test("cart add/update/remove clamps quantities and deduplicates rows", () => {
  const sample = item({ quantity_available: 3 });
  let cart = menu.addOrUpdateCartItem([], sample, 2);
  cart = menu.addOrUpdateCartItem(cart, sample, 2);
  assert.deepEqual(cart, [{ id: sample.id, quantity: 3 }]);

  cart = menu.setCartItemQuantity(cart, sample, 999999);
  assert.deepEqual(cart, [{ id: sample.id, quantity: 3 }]);

  cart = menu.setCartItemQuantity(cart, sample, -1);
  assert.deepEqual(cart, []);
});

test("cart supports items from different cooks", () => {
  const first = item({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", cook_id: cookA });
  const second = item({ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", cook_id: cookB, quantity_available: 8 });
  let cart = menu.addOrUpdateCartItem([], first, 1);
  cart = menu.addOrUpdateCartItem(cart, second, 3);
  assert.deepEqual(cart, [
    { id: first.id, quantity: 1 },
    { id: second.id, quantity: 3 },
  ]);
});

test("corrupted and hostile cart data is recovered safely", () => {
  const storage = {
    getItem: () => "{broken json",
  };
  assert.deepEqual(menu.parseStoredCart(storage), []);

  const sample = item({ quantity_available: 2 });
  const itemsById = new Map([[sample.id, sample]]);
  assert.deepEqual(
    menu.normalizeCartEntries(
      [
        { id: sample.id, quantity: "2" },
        { id: sample.id, quantity: "999" },
        { id: "not-a-uuid", quantity: 1 },
        { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", quantity: 1 },
      ],
      itemsById,
    ),
    [{ id: sample.id, quantity: 2 }],
  );
});

test("unavailable or sold-out items cannot be added", () => {
  assert.deepEqual(menu.addOrUpdateCartItem([], item({ is_active: false }), 1), []);
  assert.deepEqual(menu.addOrUpdateCartItem([], item({ is_sold_out: true }), 1), []);
  assert.deepEqual(menu.addOrUpdateCartItem([], item({ quantity_available: 0 }), 1), []);
});

test("currency and subtotal formatting are safe and deterministic", () => {
  const first = item({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", price_cents: 1250 });
  const second = item({ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", cook_id: cookB, price_cents: 500 });
  const itemsById = new Map([
    [first.id, first],
    [second.id, second],
  ]);
  assert.equal(menu.formatCurrency(1250), "$12.50");
  assert.equal(menu.getCartSubtotalCents([
    { id: first.id, quantity: 2 },
    { id: second.id, quantity: 3 },
  ], itemsById), 4000);
});

test("UUID validation rejects malformed IDs", () => {
  assert.equal(menu.isUuid("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"), true);
  assert.equal(menu.isUuid("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"), false);
  assert.equal(menu.isUuid("../../../etc/passwd"), false);
});

test("customer menu code does not render private cook fields or unsafe executable sinks", () => {
  const source = fs.readFileSync(path.join(root, "js/menu.js"), "utf8");
  assert.doesNotMatch(source, /\b(?:legal_name|phone|pickup_address|permit_or_certification_url|food_handler_certificate_url|review_notes)\b/);
  assert.doesNotMatch(source, /\b(?:innerHTML|outerHTML|insertAdjacentHTML|eval)\b/);
});

test("customer menu RPC exposes only whitelisted public fields and filters disabled kitchens", () => {
  const migration = fs.readFileSync(path.join(root, "supabase/migrations/20260623024739_add_customer_menu_browse_rpc.sql"), "utf8");
  assert.match(migration, /create function lck_marketplace\.get_customer_menu_items/);
  assert.match(migration, /application\.status = 'approved'/);
  assert.match(migration, /profile\.is_public/);
  assert.match(migration, /profile\.moderator_disabled_at is null/);
  assert.match(migration, /not item\.is_sold_out/);
  assert.match(migration, /item\.quantity_available > 0/);
  assert.doesNotMatch(migration, /\b(?:legal_name|phone|pickup_address|permit_or_certification_url|food_handler_certificate_url|review_notes)\b/);
});
