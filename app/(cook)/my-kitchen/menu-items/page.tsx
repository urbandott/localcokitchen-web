import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MenuItemCreateForm, MenuItemEditForm } from "@/features/kitchen/kitchen-management-forms";
import { setMenuItemAvailabilityAction } from "@/features/kitchen/actions";
import { getKitchenDashboard, userHasCookWorkspace } from "@/features/kitchen/kitchen-data";
import { requireUser } from "@/lib/auth/session";
import { createMetadata } from "@/lib/seo/metadata";
import { formatCurrency } from "@/lib/utils/format";
import type { CookMenuItem } from "@/types/database";

export const metadata: Metadata = createMetadata({
  title: "Kitchen Menu Items",
  description: "Manage your LocalCoKitchen menu items.",
  path: "/my-kitchen/menu-items/",
  noIndex: true,
});

function menuStatusLabel(item: CookMenuItem): string {
  if (!item.is_active) return "Inactive";
  if (item.is_sold_out) return "Sold out";
  return "Active";
}

export default async function KitchenMenuItemsPage() {
  const user = await requireUser("/my-kitchen/menu-items/");
  if (!(await userHasCookWorkspace(user.id))) redirect("/sell-your-food/");
  const { application, error, menuItems, profile } = await getKitchenDashboard(user.id);
  const canPrepareKitchen = Boolean(
    application && ["draft", "submitted", "rejected", "approved"].includes(application.status),
  );
  const activeMenuCount = menuItems.filter((item) => item.is_active && !item.is_sold_out).length;
  const hasPublicProfile = Boolean(profile);

  return (
    <div className="content-page next-page-grid">
      <section className="page-hero">
        <p className="eyebrow">Cook dashboard</p>
        <h1>My menu items</h1>
        <p className="lede">
          Manage only your own kitchen menu items. Add dishes, update descriptions and inventory,
          publish or unpublish items, and mark items sold out.
        </p>
      </section>

      <div className="section-heading-row">
        <Link className="secondary-action compact-action" href="/my-kitchen/">
          Back to kitchen
        </Link>
      </div>

      {error ? <p className="next-alert">{error}</p> : null}
      {profile?.moderator_disabled_at ? (
        <p className="next-alert">
          The moderator has disabled this kitchen. Please reach out to us at info@localcokitchen.com
          for more information.
        </p>
      ) : null}
      {!error && canPrepareKitchen ? (
        <p className="next-success">
          You can prepare menu items before approval. They are not customer-visible until your
          application is approved and your kitchen is live.
        </p>
      ) : null}
      {!error && canPrepareKitchen && !hasPublicProfile ? (
        <p className="next-alert">Save your public profile first, then add menu items.</p>
      ) : null}

      {!error && canPrepareKitchen ? (
        <section className="next-section kitchen-menu-layout">
          {hasPublicProfile ? <MenuItemCreateForm /> : null}

          <section className="next-section" aria-labelledby="my-menu-inventory-title">
            <div className="section-heading-row">
              <div>
                <h2 id="my-menu-inventory-title">Current menu</h2>
                <p>
                  {menuItems.length} total items · {activeMenuCount} currently customer-visible
                </p>
              </div>
            </div>

            {menuItems.length === 0 ? (
              <p className="empty-state">No menu items yet. Add your first item above.</p>
            ) : null}

            <div className="order-list">
              {menuItems.map((item) => (
                <article className="next-card kitchen-inventory-card" key={item.id}>
                  <div>
                    <span className="status-pill">{menuStatusLabel(item)}</span>
                    <h3 className="text-truncate" title={item.name}>
                      {item.name}
                    </h3>
                    <p className="text-wrap-safe">
                      {formatCurrency(item.price_cents)} · {item.quantity_available} available ·{" "}
                      {item.category}
                    </p>
                    <p className="text-wrap-safe">
                      Ingredients: {item.main_ingredients.join(", ")} · Allergens:{" "}
                      {item.allergens.join(", ")}
                    </p>
                  </div>
                  <div className="kitchen-inventory-actions" aria-label={`Manage ${item.name}`}>
                    <form action={setMenuItemAvailabilityAction}>
                      <input type="hidden" name="itemId" value={item.id} />
                      <input
                        type="hidden"
                        name="isActive"
                        value={item.is_active ? "false" : "true"}
                      />
                      <input type="hidden" name="isSoldOut" value={String(item.is_sold_out)} />
                      <button className="secondary-action compact-action" type="submit">
                        {item.is_active ? "Unpublish" : "Publish"}
                      </button>
                    </form>
                    <form action={setMenuItemAvailabilityAction}>
                      <input type="hidden" name="itemId" value={item.id} />
                      <input type="hidden" name="isActive" value={String(item.is_active)} />
                      <input
                        type="hidden"
                        name="isSoldOut"
                        value={item.is_sold_out ? "false" : "true"}
                      />
                      <button className="secondary-action compact-action" type="submit">
                        {item.is_sold_out ? "Mark available" : "Mark sold out"}
                      </button>
                    </form>
                  </div>
                  <MenuItemEditForm item={item} />
                </article>
              ))}
            </div>
          </section>
        </section>
      ) : null}
    </div>
  );
}
