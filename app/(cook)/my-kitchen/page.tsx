import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CookApplicationForm } from "@/features/kitchen/cook-application-form";
import {
  CookProfileManagementForm,
  MenuItemEditForm,
  MenuItemCreateForm,
  PickupWindowsForm,
} from "@/features/kitchen/kitchen-management-forms";
import { setMenuItemAvailabilityAction } from "@/features/kitchen/actions";
import { getKitchenDashboard, userHasCookWorkspace } from "@/features/kitchen/kitchen-data";
import { requireUser } from "@/lib/auth/session";
import { createMetadata } from "@/lib/seo/metadata";
import { formatCurrency } from "@/lib/utils/format";
import type { AdminCookStatus } from "@/types/database";

export const metadata: Metadata = createMetadata({
  title: "My Kitchen",
  description: "Manage your LocalCoKitchen cook dashboard.",
  path: "/my-kitchen/",
  noIndex: true,
});

function applicationStatusLabel(status: AdminCookStatus | undefined): string {
  if (!status) return "Not submitted";
  const labels: Record<AdminCookStatus, string> = {
    approved: "Approved",
    draft: "Not submitted",
    rejected: "Needs changes",
    submitted: "Submitted for review",
    suspended: "Suspended",
  };
  return labels[status];
}

export default async function MyKitchenPage() {
  const user = await requireUser("/my-kitchen/");
  if (!(await userHasCookWorkspace(user.id))) redirect("/sell-your-food/");
  const { application, profile, menuItems, pickupWindows, error } = await getKitchenDashboard(
    user.id,
  );
  const isApprovedCook = application?.status === "approved";

  return (
    <div className="content-page next-page-grid">
      <section className="page-hero">
        <p className="eyebrow">Cook dashboard</p>
        <h1>My Kitchen</h1>
        <p className="lede">
          Manage application status, public kitchen visibility, and menu items.
        </p>
      </section>
      {error ? <p className="next-alert">{error}</p> : null}
      {profile?.moderator_disabled_at ? (
        <p className="next-alert">
          The moderator has disabled this kitchen. Please reach out to us at info@localcokitchen.com
          for more information.
        </p>
      ) : null}
      <section className="next-card-grid">
        <article className="next-card">
          <h2>Application</h2>
          <p>Status: {applicationStatusLabel(application?.status)}</p>
          <p className="next-muted">
            Application submissions are reviewed by the LocalCoKitchen moderation team before your
            kitchen can go live.
          </p>
        </article>
        <article className="next-card">
          <h2>Public profile</h2>
          <p>{profile?.display_name ?? "No public profile yet"}</p>
          <p>Kitchen live: {profile?.is_public ? "Yes" : "No"}</p>
        </article>
        <article className="next-card">
          <h2>Menu items</h2>
          <p>{menuItems.length} total items</p>
          <Link className="secondary-action compact-action" href="/menu/">
            View public menu
          </Link>
        </article>
      </section>
      {!application || application.status === "draft" || application.status === "rejected" ? (
        <section className="next-section">
          {application?.status === "rejected" ? (
            <p className="next-alert">
              Your application needs changes before approval.
              {application.review_notes ? ` Moderator note: ${application.review_notes}` : ""}
            </p>
          ) : null}
          <CookApplicationForm />
        </section>
      ) : null}
      {application?.status === "submitted" ? (
        <section className="next-section">
          <p className="next-success">
            Your application is submitted. We’ll review your documents and follow up by email.
          </p>
        </section>
      ) : null}
      {application?.status === "suspended" ? (
        <section className="next-section">
          <p className="next-alert">
            Your cook application is suspended. Please reach out to info@localcokitchen.com for more
            information.
          </p>
        </section>
      ) : null}
      {isApprovedCook ? (
        <section className="next-section kitchen-management-grid">
          <CookProfileManagementForm
            moderatorDisabled={Boolean(profile?.moderator_disabled_at)}
            profile={profile}
          />
          <PickupWindowsForm windows={pickupWindows} />
          <MenuItemCreateForm />
        </section>
      ) : null}
      <section className="next-section">
        <h2>Menu inventory</h2>
        {menuItems.length === 0 ? (
          <p className="empty-state">
            {isApprovedCook
              ? "No menu items yet. Add your first item above."
              : "Menu item management unlocks after approval."}
          </p>
        ) : null}
        {menuItems.map((item) => (
          <article className="next-card kitchen-inventory-card" key={item.id}>
            <div>
              <h3>{item.name}</h3>
              <p>
                {formatCurrency(item.price_cents)} · {item.quantity_available} available ·{" "}
                {item.is_sold_out ? "Sold out" : item.is_active ? "Active" : "Inactive"}
              </p>
            </div>
            {isApprovedCook ? (
              <>
                <div className="kitchen-inventory-actions">
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
              </>
            ) : null}
          </article>
        ))}
      </section>
    </div>
  );
}
