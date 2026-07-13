import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  CookProfileManagementForm,
  PickupWindowsForm,
} from "@/features/kitchen/kitchen-management-forms";
import { getKitchenDashboard, userHasCookWorkspace } from "@/features/kitchen/kitchen-data";
import { requireUser } from "@/lib/auth/session";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Kitchen Public Profile",
  description: "Manage your LocalCoKitchen public cook profile.",
  path: "/my-kitchen/profile/",
  noIndex: true,
});

export default async function KitchenProfilePage() {
  const user = await requireUser("/my-kitchen/profile/");
  if (!(await userHasCookWorkspace(user.id))) redirect("/sell-your-food/");
  const { application, error, menuItems, pickupWindows, profile } = await getKitchenDashboard(
    user.id,
  );
  const canPrepareKitchen = Boolean(
    application && ["draft", "submitted", "rejected", "approved"].includes(application.status),
  );
  const isApprovedCook = application?.status === "approved";
  const hasActiveMenuItem = menuItems.some((item) => item.is_active && !item.is_sold_out);
  const hasActivePickupWindow = pickupWindows.some((window) => window.is_active);
  const liveDisabledReason = profile?.moderator_disabled_at
    ? "The moderator has disabled this kitchen. Please reach out to us at info@localcokitchen.com for more information."
    : !isApprovedCook
      ? "You can prepare this profile now. Kitchen live status unlocks after your cook application is approved."
      : !hasActiveMenuItem
        ? "Add at least one active, available menu item before making your kitchen live."
        : !hasActivePickupWindow
          ? "Add at least one active pickup window before making your kitchen live."
          : null;

  return (
    <div className="content-page next-page-grid">
      <section className="page-hero">
        <p className="eyebrow">Cook dashboard</p>
        <h1>Public profile</h1>
        <p className="lede">
          Manage customer-visible kitchen details, live status, order notes, profile image, and
          pickup windows.
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
      {!error && canPrepareKitchen && !isApprovedCook ? (
        <p className="next-success">
          You can prepare your public profile and pickup windows before approval. They are not
          customer-visible until your application is approved and your kitchen is made public.
        </p>
      ) : null}

      {!error && canPrepareKitchen ? (
        <section className="next-section kitchen-management-grid">
          <CookProfileManagementForm
            liveDisabledReason={liveDisabledReason}
            moderatorDisabled={Boolean(profile?.moderator_disabled_at)}
            profile={profile}
          />
          <PickupWindowsForm windows={pickupWindows} />
        </section>
      ) : null}
    </div>
  );
}
