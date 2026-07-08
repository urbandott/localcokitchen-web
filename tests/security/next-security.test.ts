import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assertNoPrivateCookField } from "@/lib/security/safe-path";

const root = path.resolve(__dirname, "../..");

function read(file: string) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

describe("Next.js security regressions", () => {
  it("does not expose service role keys or unsafe HTML sinks in app code", () => {
    const files = ["app", "components", "features", "lib"]
      .flatMap((directory) =>
        fs
          .readdirSync(path.join(root, directory), { recursive: true })
          .map((file) => path.join(directory, String(file))),
      )
      .filter((file) => /\.(ts|tsx)$/.test(file));
    const source = files.map(read).join("\n");
    expect(source).not.toMatch(/service[_-]?role/i);
    expect(source).not.toMatch(
      /\b(?:innerHTML|outerHTML|insertAdjacentHTML)\b|\beval\s*\(|\bnew\s+Function\s*\(/,
    );
    expect(source).not.toMatch(/dangerouslySetInnerHTML/);
  });

  it("keeps private cook fields out of public menu types", () => {
    expect(assertNoPrivateCookField(["name", "cook_display_name", "cook_cuisine_type"])).toBe(true);
    expect(assertNoPrivateCookField(["legal_name"])).toBe(false);
    expect(read("features/menu/menu-data.ts")).not.toMatch(
      /legal_name|pickup_address|permit_or_certification_url|review_notes/,
    );
  });

  it("sets noindex for private route groups and secure headers in Next config", () => {
    expect(read("app/(auth)/layout.tsx")).toMatch(/index: false/);
    expect(read("app/(account)/layout.tsx")).toMatch(/index: false/);
    expect(read("app/(admin)/layout.tsx")).toMatch(/index: false/);
    expect(read("proxy.ts")).toMatch(/Content-Security-Policy/);
    expect(read("lib/security/content-security-policy.ts")).toMatch(/frame-ancestors 'none'/);
    expect(read("lib/security/content-security-policy.ts")).toMatch(/nonce-/);
    expect(read("lib/security/content-security-policy.ts")).not.toMatch(
      /script-src[^;\n]*unsafe-inline/,
    );
  });

  it("uses the protected My Kitchen route and preserves old bookmarks", () => {
    expect(read("app/(cook)/my-kitchen/page.tsx")).toMatch(/requireUser\("\/my-kitchen\/"\)/);
    expect(read("proxy.ts")).toMatch(/"\/my-kitchen"/);
    expect(read("app/robots.ts")).toMatch(/"\/my-kitchen\/"/);
    expect(read("next.config.ts")).toMatch(/source: "\/my-shop\/:path\*"/);
    expect(read("next.config.ts")).toMatch(/destination: "\/my-kitchen\/:path\*"/);
  });

  it("uses the canonical image asset for visible and browser branding", () => {
    expect(read("lib/brand.ts")).toMatch(/logo: "\/images\/logo\.svg"/);
    expect(read("components/brand-logo.tsx")).toMatch(/BRAND_ASSETS\.logo/);
    expect(read("components/site-header.tsx")).toMatch(/<BrandLogo placement="header" priority/);
    expect(read("components/site-footer.tsx")).toMatch(/<BrandLogo placement="footer"/);
    expect(read("lib/seo/metadata.ts")).toMatch(/icons: \{/);
    expect(read("lib/seo/metadata.ts")).toMatch(/BRAND_ASSETS\.logo/);
    expect(read("components/site-header.tsx")).not.toMatch(/ChefHat/);
    expect(read("components/site-footer.tsx")).not.toMatch(/ChefHat/);
  });

  it("keeps account profile updates owner-scoped and profile images private", () => {
    const migration = read(
      "supabase/migrations/20260703023857_add_customer_profile_management.sql",
    );
    const action = read("features/profile/actions.ts");

    expect(migration).toMatch(/for update\s+to authenticated/);
    expect(migration).toMatch(/auth\.uid\(\)\) = id/);
    expect(migration).toMatch(/grant update \(first_name, last_name, full_name, avatar_path\)/);
    expect(migration).toMatch(/avatar_path like id::text \|\| '\/%'/);
    expect(migration).toMatch(/public = false/);
    expect(action).toMatch(/PROFILE_IMAGE_MAX_BYTES/);
    expect(action).toMatch(/validateProfileImage/);
    expect(action).toMatch(/upsert: false/);
    expect(action).not.toMatch(/newAvatar\.name/);
  });

  it("keeps cook onboarding intent separate from cook authorization", () => {
    const migration = read("supabase/migrations/20260706002918_add_cook_onboarding_intent.sql");
    const authActions = read("features/auth/actions.ts");

    expect(migration).toMatch(/Cook onboarding intent is a navigation preference/);
    expect(migration).toMatch(/grant update \(cook_onboarding_started_at\)/);
    expect(migration).toMatch(
      /avatar_path = coalesce\(excluded\.avatar_path, lck_identity\.users\.avatar_path\)/,
    );
    expect(authActions).toMatch(/postSignInDestination/);
    expect(authActions).toMatch(/cook_onboarding_started_at/);
    expect(authActions).not.toMatch(/user_metadata.*(?:role|admin|approved)/i);
  });

  it("keeps admin application review admin-only and uses short-lived private document links", () => {
    const page = read("app/(admin)/admin/cook-applications/page.tsx");
    const data = read("features/admin/admin-data.ts");
    const actions = read("features/admin/actions.ts");

    expect(page).toMatch(/requireAdmin\(\)/);
    expect(page).toMatch(/listSubmittedCookApplicationsForReview/);
    expect(page).not.toMatch(/(?:certificate|document|selfie|permit)_url/);
    expect(data).toMatch(/createSignedUrl\(safePath, 300\)/);
    expect(data).toMatch(/path\.startsWith\(`\$\{userId\}\/`\)/);
    expect(actions).toMatch(/requireAdmin\(\)/);
    expect(actions).toMatch(/reviewed_by: admin\.id/);
    expect(actions).toMatch(/\.eq\("status", "submitted"\)/);
  });

  it("allows cooks to clean up only their own cook media objects", () => {
    const migration = read("supabase/migrations/20260707025629_add_cook_media_delete_policies.sql");

    expect(migration).toMatch(/for delete\s+to authenticated/);
    expect(migration).toMatch(/bucket_id = 'cook-profile-images'/);
    expect(migration).toMatch(/bucket_id = 'cook-menu-images'/);
    expect(migration).toMatch(
      /\(storage\.foldername\(name\)\)\[1\] = \(select auth\.uid\(\)\)::text/,
    );
  });

  it("creates checkout orders only through an authenticated atomic validation RPC", () => {
    const migration = read("supabase/migrations/20260707030047_add_atomic_customer_checkout.sql");
    const action = read("features/checkout/actions.ts");

    expect(migration).toMatch(/create table if not exists lck_marketplace\.customer_orders/);
    expect(migration).toMatch(/create table if not exists lck_marketplace\.customer_order_items/);
    expect(migration).toMatch(
      /create function lck_marketplace\.create_customer_checkout_order\(p_cart jsonb\)/,
    );
    expect(migration).toMatch(/current_customer_id uuid := \(select auth\.uid\(\)\)/);
    expect(migration).toMatch(/for update of item/);
    expect(migration).toMatch(/application\.status = 'approved'/);
    expect(migration).toMatch(/profile\.moderator_disabled_at is null/);
    expect(migration).toMatch(/item\.quantity_available >= request\.quantity/);
    expect(migration).toMatch(/quantity_available = item\.quantity_available - request\.quantity/);
    expect(migration).toMatch(
      /revoke all on function lck_marketplace\.create_customer_checkout_order\(jsonb\)/,
    );
    expect(migration).toMatch(
      /grant execute on function lck_marketplace\.create_customer_checkout_order\(jsonb\)\s+to authenticated/,
    );
    expect(action).toMatch(/supabase\.auth\.getUser\(\)/);
    expect(action).toMatch(/create_customer_checkout_order/);
  });

  it("keeps payment confirmation webhook-verified and provider events idempotent", () => {
    const migration = read(
      "supabase/migrations/20260707030857_add_payment_lifecycle_foundation.sql",
    );
    const route = read("app/api/webhooks/stripe/route.ts");
    const helper = read("features/payments/stripe-webhook.ts");
    const privileged = read("lib/supabase/privileged.ts");

    expect(migration).toMatch(/customer_payment_attempts/);
    expect(migration).toMatch(/payment_webhook_events/);
    expect(migration).toMatch(/unique \(provider, provider_event_id\)/);
    expect(migration).toMatch(/record_payment_webhook_event/);
    expect(migration).toMatch(/cancel_customer_order_and_restock/);
    expect(migration).toMatch(/expire_pending_payment_orders/);
    expect(migration).toMatch(
      /grant execute on function lck_marketplace\.record_payment_webhook_event/,
    );
    expect(migration).not.toMatch(
      /grant execute on function lck_marketplace\.record_payment_webhook_event[\s\S]*to anon/i,
    );
    expect(migration).not.toMatch(
      /grant execute on function lck_marketplace\.expire_pending_payment_orders[\s\S]*to anon/i,
    );
    expect(route).toMatch(/request\.text\(\)/);
    expect(route).toMatch(/verifyStripeWebhookSignature/);
    expect(route).toMatch(/record_payment_webhook_event/);
    expect(helper).toMatch(/timingSafeEqual/);
    expect(helper).toMatch(/createHmac\("sha256"/);
    expect(privileged).toMatch(/SUPABASE_SECRET_KEY/);
    expect(privileged).not.toMatch(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  });

  it("creates Stripe Checkout Sessions server-side and records attempts through an owner-scoped RPC", () => {
    const migration = read(
      "supabase/migrations/20260708015722_add_checkout_session_payment_attempt_rpc.sql",
    );
    const action = read("features/checkout/actions.ts");
    const helper = read("features/payments/stripe-checkout.ts");

    expect(migration).toMatch(/create_checkout_session_payment_attempt/);
    expect(migration).toMatch(/current_customer_id uuid := \(select auth\.uid\(\)\)/);
    expect(migration).toMatch(/customer_order\.customer_id = current_customer_id/);
    expect(migration).toMatch(/target_order\.status <> 'pending_payment'/);
    expect(migration).toMatch(/target_order\.expires_at <= now\(\)/);
    expect(migration).toMatch(/target_order\.subtotal_cents <> p_amount_cents/);
    expect(migration).toMatch(
      /grant execute on function lck_marketplace\.create_checkout_session_payment_attempt/,
    );
    expect(action).toMatch(/STRIPE_SECRET_KEY/);
    expect(action).toMatch(/create_customer_checkout_order/);
    expect(action).toMatch(/customer_order_items/);
    expect(action).toMatch(/createStripeCheckoutSession/);
    expect(action).toMatch(/create_checkout_session_payment_attempt/);
    expect(helper).toMatch(/https:\/\/api\.stripe\.com\/v1\/checkout\/sessions/);
    expect(helper).toMatch(/payment_intent_data\[metadata\]\[order_id\]/);
    expect(helper).toMatch(/checkout\.stripe\.com/);
    expect(helper).not.toMatch(/NEXT_PUBLIC/);
  });
});
