import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CookOrderControls } from "@/features/kitchen/cook-order-controls";
import { getCookOrdersDashboard } from "@/features/kitchen/cook-orders-data";
import { userHasCookWorkspace } from "@/features/kitchen/kitchen-data";
import { requireUser } from "@/lib/auth/session";
import { createMetadata } from "@/lib/seo/metadata";
import { formatCurrency } from "@/lib/utils/format";
import type { CookOrderItemSummary } from "@/types/database";

export const metadata: Metadata = createMetadata({
  title: "Kitchen Orders",
  description: "Manage paid LocalCoKitchen order items for your kitchen.",
  path: "/my-kitchen/orders/",
  noIndex: true,
});

function formatDateTime(value: string | null): string {
  if (!value) return "Not confirmed";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function fulfillmentLabel(status: CookOrderItemSummary["fulfillment_status"]): string {
  const labels: Record<CookOrderItemSummary["fulfillment_status"], string> = {
    fulfilled: "Fulfilled",
    pending: "Needs prep",
    ready: "Ready",
  };
  return labels[status];
}

export default async function KitchenOrdersPage() {
  const user = await requireUser("/my-kitchen/orders/");
  if (!(await userHasCookWorkspace(user.id))) redirect("/sell-your-food/");

  const { application, error, orderItems } = await getCookOrdersDashboard(user.id);
  const isApprovedCook = application?.status === "approved";

  return (
    <div className="content-page next-page-grid">
      <section className="page-hero">
        <p className="eyebrow">Cook dashboard</p>
        <h1>Kitchen orders</h1>
        <p className="lede">
          View paid order items for your kitchen and update preparation status. Customer payment
          details and private profile data are not shown here.
        </p>
      </section>

      <section className="next-section">
        <div className="section-heading-row">
          <h2>Paid order items</h2>
          <Link className="secondary-action compact-action" href="/my-kitchen/">
            Back to kitchen
          </Link>
        </div>

        {error ? <p className="next-alert">{error}</p> : null}
        {!error && !isApprovedCook ? (
          <p className="next-alert">
            Order management unlocks after your cook application is approved.
          </p>
        ) : null}
        {!error && isApprovedCook && orderItems.length === 0 ? (
          <p className="empty-state">No paid order items yet.</p>
        ) : null}

        <div className="order-list">
          {isApprovedCook
            ? orderItems.map((item) => (
                <article className="order-list-card kitchen-order-card" key={item.order_item_id}>
                  <div>
                    <span className="status-pill">{fulfillmentLabel(item.fulfillment_status)}</span>
                    <h3>{item.item_name}</h3>
                    <p>
                      Order #{item.order_id.slice(0, 8)} · Paid {formatDateTime(item.order_paid_at)}
                    </p>
                    <p>
                      Qty {item.quantity} · {formatCurrency(item.unit_price_cents)} each ·{" "}
                      {formatCurrency(item.line_total_cents)} total
                    </p>
                  </div>
                  <CookOrderControls item={item} />
                </article>
              ))
            : null}
        </div>
      </section>
    </div>
  );
}
