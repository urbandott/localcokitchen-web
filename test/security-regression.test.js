const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("browser code avoids executable HTML sinks and privileged keys", () => {
  const browserCode = fs
    .readdirSync(path.join(root, "js"))
    .filter((file) => file.endsWith(".js"))
    .map((file) => read(`js/${file}`))
    .join("\n");

  assert.doesNotMatch(browserCode, /\b(?:innerHTML|outerHTML|insertAdjacentHTML|eval)\b/);
  assert.doesNotMatch(browserCode, /service[_-]?role/i);
  assert.doesNotMatch(browserCode, /lck_get_signup_account_status/);
});

test("auth configuration enforces production password, confirmation, session, and MFA controls", () => {
  const config = read("supabase/config.toml");
  assert.match(config, /minimum_password_length = 10/);
  assert.match(config, /password_requirements = "lower_upper_letters_digits_symbols"/);
  assert.match(config, /\[auth\.email\][\s\S]*enable_confirmations = true/);
  assert.match(config, /secure_password_change = true/);
  assert.match(config, /\[auth\.sessions\][\s\S]*timebox = "168h"[\s\S]*inactivity_timeout = "12h"/);
  assert.match(config, /\[auth\.mfa\.totp\][\s\S]*enroll_enabled = true[\s\S]*verify_enabled = true/);
  assert.match(config, /\[functions\.send-cook-review-notifications\][\s\S]*verify_jwt = true/);
});

test("hardening migration closes enumeration and enforces private media and audit logs", () => {
  const migration = read("supabase/migrations/20260622001814_production_readiness_hardening.sql");
  assert.match(migration, /drop function if exists public\.lck_get_signup_account_status/);
  assert.match(migration, /create table if not exists lck_private\.admin_actions/);
  assert.match(migration, /create table if not exists lck_private\.system_events/);
  assert.match(migration, /where id in \('cook-profile-images', 'cook-menu-images'\)/);
  assert.match(migration, /application\.status = 'approved'/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /cook_pickup_windows_one_active_day_idx/);
  assert.match(migration, /save_own_pickup_windows/);
  assert.match(migration, /cook_menu_items_active_allergens_required/);
});

test("all exposed application tables enable RLS and use ownership or visibility predicates", () => {
  const foundation = read("supabase/migrations/20260526234000_lck_app_foundation.sql");
  const tables = [
    "lck_identity.users",
    "lck_identity.user_roles",
    "lck_marketplace.cook_applications",
    "lck_marketplace.cook_profiles",
    "lck_marketplace.cook_account_limits",
    "lck_marketplace.cook_pickup_windows",
    "lck_marketplace.cook_menu_items",
  ];
  tables.forEach((table) => {
    assert.match(foundation, new RegExp(`alter table ${table.replace(".", "\\.")} enable row level security`));
  });
  assert.match(foundation, /\(select auth\.uid\(\)\) = user_id/);
  assert.match(foundation, /application|cook_applications/);
});

test("security headers block framing and isolate privileged browsing contexts", () => {
  const headers = read("_headers");
  assert.match(headers, /Content-Security-Policy:/);
  assert.match(headers, /frame-ancestors 'none'/);
  assert.match(headers, /X-Content-Type-Options: nosniff/);
  assert.match(headers, /Cross-Origin-Opener-Policy: same-origin/);
  assert.match(headers, /Cross-Origin-Resource-Policy: same-site/);
  assert.match(headers, /Strict-Transport-Security:/);
});

test("cook uploads use canonical MIME-derived extensions and signed private media URLs", () => {
  const cook = read("js/cook.js");
  const menu = read("js/menu.js");
  assert.match(cook, /fileExtensions\.get\(file\.type\)/);
  assert.match(cook, /createSignedUrl\(path, 3600\)/);
  assert.match(cook, /removeStorageObjectQuietly/);
  assert.match(menu, /createSignedUrl\(path, 3600\)/);
});
