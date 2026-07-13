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

  it("keeps customer order pages authenticated, noindexed, and owner-scoped", () => {
    const listPage = read("app/(account)/profile/orders/page.tsx");
    const detailPage = read("app/(account)/profile/orders/[id]/page.tsx");
    const data = read("features/orders/order-data.ts");
    const checkout = read("features/checkout/actions.ts");

    expect(listPage).toMatch(/requireUser\("\/profile\/orders\/"\)/);
    expect(listPage).toMatch(/noIndex: true/);
    expect(detailPage).toMatch(/requireUser\("\/profile\/orders\/"\)/);
    expect(detailPage).toMatch(/noIndex: true/);
    expect(data).toMatch(/orderIdSchema = z\.string\(\)\.uuid\(\)/);
    expect(data).toMatch(/\.eq\("customer_id", userId\)/);
    expect(data).toMatch(/\.eq\("id", parsed\.data\)/);
    expect(checkout).toMatch(/\/profile\/orders\/\$\{order\.order_id\}\/\?checkout=success/);
    expect(checkout).toMatch(/\/profile\/orders\/\$\{order\.order_id\}\/\?checkout=cancelled/);
  });

  it("lets customers cancel only their own pending payment orders", () => {
    const migration = read(
      "supabase/migrations/20260708020930_add_customer_pending_order_cancel_rpc.sql",
    );
    const action = read("features/orders/actions.ts");
    const form = read("features/orders/cancel-order-form.tsx");
    const details = read("features/orders/order-status.tsx");

    expect(migration).toMatch(/cancel_own_pending_payment_order/);
    expect(migration).toMatch(/current_customer_id uuid := \(select auth\.uid\(\)\)/);
    expect(migration).toMatch(/customer_order\.customer_id = current_customer_id/);
    expect(migration).toMatch(/target_order\.status <> 'pending_payment'/);
    expect(migration).toMatch(/cancel_customer_order_and_restock\(target_order\.id, now\(\)\)/);
    expect(migration).toMatch(/attempt\.customer_id = current_customer_id/);
    expect(migration).toMatch(
      /grant execute on function lck_marketplace\.cancel_own_pending_payment_order\(uuid\)\s+to authenticated/,
    );
    expect(migration).not.toMatch(
      /grant execute on function lck_marketplace\.cancel_own_pending_payment_order[\s\S]*to anon/i,
    );
    expect(action).toMatch(/orderIdSchema\.safeParse/);
    expect(action).toMatch(/supabase\.auth\.getUser\(\)/);
    expect(action).toMatch(/cancel_own_pending_payment_order/);
    expect(form).toMatch(/useActionState/);
    expect(details).toMatch(/order\.status === "pending_payment"/);
  });

  it("keeps cook order management paid-only and scoped to the cook's own items", () => {
    const migration = read("supabase/migrations/20260708021336_add_cook_order_management.sql");
    const page = read("app/(cook)/my-kitchen/orders/page.tsx");
    const data = read("features/kitchen/cook-orders-data.ts");
    const action = read("features/kitchen/cook-order-actions.ts");

    expect(migration).toMatch(/fulfillment_status in \('pending', 'ready', 'fulfilled'\)/);
    expect(migration).toMatch(/drop policy if exists "Cooks read their own order items"/);
    expect(migration).toMatch(/customer_order\.status in \('paid', 'fulfilled', 'refunded'\)/);
    expect(migration).toMatch(/list_own_cook_order_items/);
    expect(migration).toMatch(/application\.status = 'approved'/);
    expect(migration).toMatch(/order_item\.cook_id = \(select auth\.uid\(\)\)/);
    expect(migration).toMatch(/update_own_cook_order_item_fulfillment/);
    expect(migration).toMatch(/order_item\.cook_id = current_cook_id/);
    expect(migration).toMatch(/target_order\.status <> 'paid'/);
    expect(migration).toMatch(/pending_item_count = 0/);
    expect(migration).not.toMatch(
      /grant execute on function lck_marketplace\.update_own_cook_order_item_fulfillment[\s\S]*to anon/i,
    );
    expect(page).toMatch(/requireUser\("\/my-kitchen\/orders\/"\)/);
    expect(page).toMatch(/noIndex: true/);
    expect(data).toMatch(/list_own_cook_order_items/);
    expect(action).toMatch(/z\.enum\(\["ready", "fulfilled"\]\)/);
    expect(action).toMatch(/supabase\.auth\.getUser\(\)/);
    expect(action).toMatch(/update_own_cook_order_item_fulfillment/);
  });

  it("keeps admin order oversight admin-only and avoids exposing payment secrets", () => {
    const page = read("app/(admin)/admin/orders/page.tsx");
    const portal = read("app/(admin)/admin/page.tsx");
    const data = read("features/admin/admin-data.ts");

    expect(page).toMatch(/requireAdmin\(\)/);
    expect(page).toMatch(/noIndex: true/);
    expect(page).toMatch(/listAdminOrders/);
    expect(portal).toMatch(/\/admin\/orders\//);
    expect(data).toMatch(/customer_orders/);
    expect(data).toMatch(/customer_order_items/);
    expect(data).toMatch(/customer_payment_attempts/);
    expect(data).toMatch(/amount_cents,created_at,currency,order_id,provider,status,updated_at/);
    expect(data).not.toMatch(/provider_reference/);
    expect(page).not.toMatch(/provider_reference|payload|secret/i);
  });

  it("records sensitive order/payment events in private audit tables only", () => {
    const existingAudit = read(
      "supabase/migrations/20260622001814_production_readiness_hardening.sql",
    );
    const migration = read("supabase/migrations/20260708022441_add_order_audit_logging.sql");

    expect(existingAudit).toMatch(/create table if not exists lck_private\.admin_actions/);
    expect(existingAudit).toMatch(/create table if not exists lck_private\.system_events/);
    expect(existingAudit).toMatch(/audit_cook_kitchen_moderation/);
    expect(existingAudit).toMatch(/audit_cook_application_status/);
    expect(existingAudit).toMatch(/revoke all on table lck_private\.admin_actions/);
    expect(migration).toMatch(/record_system_event/);
    expect(migration).toMatch(/audit_customer_order_status/);
    expect(migration).toMatch(/audit_order_item_fulfillment/);
    expect(migration).toMatch(/audit_payment_attempt_status/);
    expect(migration).toMatch(/audit_payment_webhook_event/);
    expect(migration).toMatch(/payment\.webhook_received/);
    expect(migration).toMatch(/after update of status on lck_marketplace\.customer_orders/);
    expect(migration).toMatch(
      /after update of fulfillment_status on lck_marketplace\.customer_order_items/,
    );
    expect(migration).toMatch(
      /after update of status on lck_marketplace\.customer_payment_attempts/,
    );
    expect(migration).toMatch(/after insert on lck_private\.payment_webhook_events/);
    expect(migration).not.toMatch(/grant .*lck_private\.system_events[\s\S]*to anon/i);
    expect(migration).not.toMatch(/grant .*lck_private\.admin_actions[\s\S]*to anon/i);
    expect(migration).toMatch(/revoke all on function lck_private\.record_system_event/);
  });

  it("exposes audit events only through an admin-gated sanitized viewer", () => {
    const migration = read(
      "supabase/migrations/20260708022845_add_admin_audit_event_viewer_rpc.sql",
    );
    const page = read("app/(admin)/admin/audit/page.tsx");
    const portal = read("app/(admin)/admin/page.tsx");
    const data = read("features/admin/admin-data.ts");

    expect(migration).toMatch(/list_admin_audit_events/);
    expect(migration).toMatch(/current_user_is_admin\(\)/);
    expect(migration).toMatch(/safe_limit integer := least\(greatest/);
    expect(migration).toMatch(/safe_event_type not in \('admin_action', 'system_event'\)/);
    expect(migration).toMatch(/safe_target_type not in/);
    expect(migration).toMatch(/metadata - 'payload' - 'provider_reference' - 'token' - 'secret'/);
    expect(migration).toMatch(/revoke all on function lck_identity\.list_admin_audit_events/);
    expect(migration).not.toMatch(
      /grant execute on function lck_identity\.list_admin_audit_events[\s\S]*to anon/i,
    );
    expect(page).toMatch(/requireAdmin\(\)/);
    expect(page).toMatch(/noIndex: true/);
    expect(page).toMatch(/metadataPreview/);
    expect(page).toMatch(/payload\|secret\|token\|provider_reference/i);
    expect(portal).toMatch(/\/admin\/audit\//);
    expect(data).toMatch(/list_admin_audit_events/);
    expect(data).toMatch(/allowedFilter/);
  });

  it("queues order lifecycle notifications in a private outbox only", () => {
    const migration = read("supabase/migrations/20260713022924_add_notification_outbox_hooks.sql");

    expect(migration).toMatch(/create table if not exists lck_private\.notification_outbox/);
    expect(migration).toMatch(
      /alter table lck_private\.notification_outbox enable row level security/,
    );
    expect(migration).toMatch(/revoke all on table lck_private\.notification_outbox/);
    expect(migration).toMatch(/enqueue_notification/);
    expect(migration).toMatch(/order\.payment_confirmed/);
    expect(migration).toMatch(/cook\.order_paid/);
    expect(migration).toMatch(/order_item\.' \|\| new\.fulfillment_status/);
    expect(migration).toMatch(/after update of status on lck_marketplace\.customer_orders/);
    expect(migration).toMatch(
      /after update of fulfillment_status on lck_marketplace\.customer_order_items/,
    );
    expect(migration).toMatch(/claim_pending_notifications/);
    expect(migration).toMatch(/for update skip locked/);
    expect(migration).toMatch(/mark_notification_sent/);
    expect(migration).toMatch(/mark_notification_failed/);
    expect(migration).toMatch(/to service_role/);
    expect(migration).not.toMatch(/grant .*notification_outbox[\s\S]*to anon/i);
    expect(migration).not.toMatch(/grant .*notification_outbox[\s\S]*to authenticated/i);
    expect(migration).toMatch(/- 'payload' - 'provider_reference' - 'token' - 'secret'/);
  });

  it("runs Resend notification delivery only from a protected server worker", () => {
    const route = read("app/api/notifications/resend/route.ts");
    const helper = read("features/notifications/resend.ts");
    const env = read("lib/env.ts");
    const vercelConfig = read("vercel.json");

    expect(env).toMatch(/RESEND_API_KEY/);
    expect(env).toMatch(/RESEND_FROM_EMAIL/);
    expect(env).toMatch(/NOTIFICATION_WORKER_SECRET/);
    expect(route).toMatch(/NOTIFICATION_WORKER_SECRET/);
    expect(route).toMatch(/export async function GET/);
    expect(route).toMatch(/export async function POST/);
    expect(route).toMatch(/vercel-cron\/1\.0/);
    expect(route).toMatch(/x-vercel-cron-schedule/);
    expect(route).toMatch(/createPrivilegedClient/);
    expect(route).toMatch(/claim_pending_notifications/);
    expect(route).toMatch(/mark_notification_sent/);
    expect(route).toMatch(/mark_notification_failed/);
    expect(route).toMatch(/sendResendEmail/);
    expect(vercelConfig).toMatch(/"path": "\/api\/notifications\/resend"/);
    expect(vercelConfig).toMatch(/"schedule": "\*\/5 \* \* \* \*"/);
    expect(helper).toMatch(/https:\/\/api\.resend\.com\/emails/);
    expect(helper).toMatch(/Authorization: `Bearer \$\{request\.apiKey\}`/);
    expect(helper).toMatch(/escapeHtml/);
    expect(helper).not.toMatch(/NEXT_PUBLIC/);
  });

  it("exposes notification observability only through admin-gated sanitized RPCs", () => {
    const migration = read(
      "supabase/migrations/20260713024509_add_admin_notification_observability.sql",
    );
    const page = read("app/(admin)/admin/notifications/page.tsx");
    const portal = read("app/(admin)/admin/page.tsx");
    const data = read("features/admin/admin-data.ts");
    const actions = read("features/admin/actions.ts");

    expect(migration).toMatch(/get_admin_notification_summary/);
    expect(migration).toMatch(/list_admin_notifications/);
    expect(migration).toMatch(/retry_admin_notification/);
    expect(migration).toMatch(/current_user_is_admin\(\)/);
    expect(migration).toMatch(/recipient_email_masked/);
    expect(migration).not.toMatch(/returns table[\s\S]*payload/i);
    expect(migration).not.toMatch(
      /grant execute on function lck_identity\.(?:get_admin_notification_summary|list_admin_notifications|retry_admin_notification)[\s\S]*to anon/i,
    );
    expect(page).toMatch(/requireAdmin\(\)/);
    expect(page).toMatch(/noIndex: true/);
    expect(page).not.toMatch(/notification\.payload|notification\.recipient_email[^_]/i);
    expect(portal).toMatch(/\/admin\/notifications\//);
    expect(data).toMatch(/list_admin_notifications/);
    expect(data).toMatch(/get_admin_notification_summary/);
    expect(actions).toMatch(/retry_admin_notification/);
    expect(actions).toMatch(/z\.string\(\)\.uuid\(\)/);
  });
});
