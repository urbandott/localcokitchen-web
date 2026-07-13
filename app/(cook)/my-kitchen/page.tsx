import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getKitchenDashboard, userHasCookWorkspace } from "@/features/kitchen/kitchen-data";
import { requireUser } from "@/lib/auth/session";
import { createMetadata } from "@/lib/seo/metadata";
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
  const activeMenuCount = menuItems.filter((item) => item.is_active && !item.is_sold_out).length;
  const activePickupWindowCount = pickupWindows.filter((window) => window.is_active).length;

  return (
    <div className="content-page next-page-grid">
      <section className="page-hero">
        <p className="eyebrow">Cook dashboard</p>
        <h1>My Kitchen</h1>
        <p className="lede">
          Manage your application, public kitchen profile, and your own menu items from separate
          workspaces.
        </p>
      </section>

      {error ? <p className="next-alert">{error}</p> : null}
      {profile?.moderator_disabled_at ? (
        <p className="next-alert">
          The moderator has disabled this kitchen. Please reach out to us at info@localcokitchen.com
          for more information.
        </p>
      ) : null}

      <section className="next-card-grid profile-card-grid">
        <article className="next-card">
          <h2>Application</h2>
          <p>Status: {applicationStatusLabel(application?.status)}</p>
          <p>Review your submitted application details and resubmit if changes are requested.</p>
          <Link className="secondary-action compact-action" href="/my-kitchen/application/">
            Manage application
          </Link>
        </article>
        <article className="next-card">
          <h2>Public profile</h2>
          <p className="text-truncate" title={profile?.display_name ?? undefined}>
            {profile?.display_name ?? "No public profile yet"}
          </p>
          <p>
            Kitchen live: {profile?.is_public && !profile.moderator_disabled_at ? "Yes" : "No"} ·
            pickup windows: {activePickupWindowCount}
          </p>
          <Link className="secondary-action compact-action" href="/my-kitchen/profile/">
            Manage public profile
          </Link>
        </article>
        <article className="next-card">
          <h2>Menu items</h2>
          <p>
            {menuItems.length} total items · {activeMenuCount} customer-visible
          </p>
          <p>Add dishes, update descriptions, set inventory, and mark items sold out.</p>
          <Link className="secondary-action compact-action" href="/my-kitchen/menu-items/">
            Manage my menu
          </Link>
        </article>
        {isApprovedCook ? (
          <article className="next-card">
            <h2>Orders</h2>
            <p>View paid order items and update preparation status.</p>
            <Link className="secondary-action compact-action" href="/my-kitchen/orders/">
              Manage orders
            </Link>
          </article>
        ) : null}
      </section>
    </div>
  );
}
