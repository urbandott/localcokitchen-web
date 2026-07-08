import Link from "next/link";
import type { Metadata } from "next";
import { customerOrderStatusCopy, listCustomerOrders } from "@/features/orders/order-data";
import { requireUser } from "@/lib/auth/session";
import { createMetadata } from "@/lib/seo/metadata";
import { formatCurrency } from "@/lib/utils/format";

export const metadata: Metadata = createMetadata({
  title: "Orders",
  description: "Review your LocalCoKitchen orders and payment status.",
  path: "/profile/orders/",
  noIndex: true,
});

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value));
}

export default async function OrdersPage() {
  const user = await requireUser("/profile/orders/");
  const { orders, error } = await listCustomerOrders(user.id);

  return (
    <div className="content-page next-page-grid">
      <section className="page-hero">
        <p className="eyebrow">Account</p>
        <h1>Your orders</h1>
        <p className="lede">Track order totals, payment state, and recent checkout activity.</p>
      </section>

      <section className="next-section" aria-labelledby="orders-title">
        <div className="section-heading-row">
          <h2 id="orders-title">Order history</h2>
          <Link className="secondary-action compact-action" href="/menu/">
            Browse menu
          </Link>
        </div>

        {error ? <p className="next-alert">{error}</p> : null}
        {!error && orders.length === 0 ? (
          <div className="empty-state">
            <p>You have not placed any orders yet.</p>
            <Link className="primary-action compact-action" href="/menu/">
              Start an order
            </Link>
          </div>
        ) : null}

        <div className="order-list">
          {orders.map((order) => {
            const copy = customerOrderStatusCopy(order.status, order.latestPaymentStatus);
            return (
              <article className="order-list-card" key={order.id}>
                <div>
                  <span className={`status-pill order-status-pill--${copy.tone}`}>
                    {copy.label}
                  </span>
                  <h3>Order #{order.id.slice(0, 8)}</h3>
                  <p>
                    {formatDate(order.created_at)} · {formatCurrency(order.subtotal_cents)}
                  </p>
                </div>
                <Link
                  className="secondary-action compact-action"
                  href={`/profile/orders/${order.id}/`}
                >
                  View order
                </Link>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
