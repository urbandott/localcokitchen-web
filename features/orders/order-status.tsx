import Link from "next/link";
import { CancelOrderForm } from "@/features/orders/cancel-order-form";
import { customerOrderStatusCopy, type CustomerOrderDetails } from "@/features/orders/order-data";
import { formatCurrency } from "@/lib/utils/format";

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function OrderStatusBanner({
  checkoutState,
  order,
}: {
  checkoutState?: string;
  order: Pick<CustomerOrderDetails, "latestPaymentStatus" | "status">;
}) {
  const copy = customerOrderStatusCopy(order.status, order.latestPaymentStatus);
  const message =
    checkoutState === "success" && order.status === "pending_payment"
      ? "Stripe returned you to LocalCoKitchen. Payment confirmation may take a moment."
      : checkoutState === "cancelled"
        ? "You left Stripe Checkout before payment was confirmed."
        : copy.message;

  return (
    <div
      className={`order-status-banner order-status-banner--${copy.tone}`}
      role="status"
      aria-live="polite"
    >
      <p className="eyebrow">Order status</p>
      <h2>{copy.label}</h2>
      <p>{message}</p>
    </div>
  );
}

export function OrderDetailsCard({ order }: { order: CustomerOrderDetails }) {
  return (
    <section className="next-section order-detail-card" aria-labelledby="order-detail-title">
      <div className="section-heading-row">
        <div>
          <p className="eyebrow">Order #{order.id.slice(0, 8)}</p>
          <h2 id="order-detail-title">Order details</h2>
        </div>
        <Link className="secondary-action compact-action" href="/profile/orders/">
          Back to orders
        </Link>
      </div>
      <dl className="order-meta-grid">
        <div>
          <dt>Placed</dt>
          <dd>{formatDateTime(order.created_at)}</dd>
        </div>
        <div>
          <dt>Total</dt>
          <dd>{formatCurrency(order.subtotal_cents)}</dd>
        </div>
        <div>
          <dt>Payment window</dt>
          <dd>Expires {formatDateTime(order.expires_at)}</dd>
        </div>
      </dl>
      <div className="order-line-items" aria-label="Order items">
        {order.items.map((item) => (
          <article className="order-line-item" key={item.id}>
            <div>
              <h3 className="text-truncate" title={item.item_name}>
                {item.item_name}
              </h3>
              <p>
                Qty {item.quantity} · {formatCurrency(item.unit_price_cents)} each
              </p>
            </div>
            <strong>{formatCurrency(item.line_total_cents)}</strong>
          </article>
        ))}
      </div>
      <div className="cart-summary">
        <p>Total: {formatCurrency(order.subtotal_cents)}</p>
      </div>
      {order.status === "pending_payment" ? <CancelOrderForm orderId={order.id} /> : null}
    </section>
  );
}
