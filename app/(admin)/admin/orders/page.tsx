import type { Metadata } from "next";
import { listAdminOrders } from "@/features/admin/admin-data";
import { requireAdmin } from "@/lib/auth/session";
import { createMetadata } from "@/lib/seo/metadata";
import { formatCurrency } from "@/lib/utils/format";
import type { AdminOrderSummary } from "@/features/admin/admin-data";

export const metadata: Metadata = createMetadata({
  title: "Admin Orders",
  description: "Review LocalCoKitchen marketplace orders.",
  path: "/admin/orders/",
  noIndex: true,
});

function formatDateTime(value: string | null): string {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function customerLabel(order: AdminOrderSummary): string {
  const customer = order.customer;
  if (!customer) return "Unknown customer";
  return (
    customer.full_name ||
    [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
    customer.email
  );
}

function statusCounts(orders: AdminOrderSummary[]) {
  return orders.reduce<Record<string, number>>((counts, order) => {
    counts[order.status] = (counts[order.status] ?? 0) + 1;
    return counts;
  }, {});
}

export default async function AdminOrdersPage() {
  await requireAdmin();
  const { orders, error } = await listAdminOrders();
  const counts = statusCounts(orders);

  return (
    <div className="content-page next-page-grid">
      <section className="page-hero">
        <p className="eyebrow">Admin</p>
        <h1>Orders</h1>
        <p className="lede">
          Review marketplace order state, payment confirmation, and cook fulfillment progress for
          support and moderation.
        </p>
      </section>

      {error ? <p className="next-alert">{error}</p> : null}

      <section className="next-card-grid" aria-label="Order status summary">
        {["pending_payment", "paid", "fulfilled", "cancelled", "refunded"].map((status) => (
          <article className="next-card" key={status}>
            <h2>{status.replaceAll("_", " ")}</h2>
            <p>{counts[status] ?? 0}</p>
          </article>
        ))}
      </section>

      <section className="next-section" aria-labelledby="admin-orders-title">
        <h2 id="admin-orders-title">Recent orders</h2>
        {!error && orders.length === 0 ? <p className="empty-state">No orders found.</p> : null}
        <div className="order-list">
          {orders.map((order) => (
            <article className="order-list-card admin-order-card" key={order.id}>
              <div className="admin-order-card__summary">
                <span className="status-pill">{order.status.replaceAll("_", " ")}</span>
                <h3>Order #{order.id.slice(0, 8)}</h3>
                <p className="text-wrap-safe">
                  {customerLabel(order)} · {formatCurrency(order.subtotal_cents)} ·{" "}
                  {formatDateTime(order.created_at)}
                </p>
                <p>
                  Payment: {order.latestPayment?.provider ?? "none"} /{" "}
                  {order.latestPayment?.status ?? "not started"} · Paid{" "}
                  {formatDateTime(order.paid_at)}
                </p>
              </div>
              <div className="admin-order-items" aria-label={`Order ${order.id} items`}>
                {order.items.map((item) => (
                  <div className="admin-order-item-row" key={item.id}>
                    <div>
                      <strong className="text-truncate" title={item.item_name}>
                        {item.item_name}
                      </strong>
                      <p className="text-wrap-safe">
                        Cook: {item.cookDisplayName ?? item.cook_id.slice(0, 8)} · Qty{" "}
                        {item.quantity} · {formatCurrency(item.line_total_cents)}
                      </p>
                    </div>
                    <span className="status-pill">{item.fulfillment_status}</span>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
