import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCustomerOrderDetails } from "@/features/orders/order-data";
import { OrderDetailsCard, OrderStatusBanner } from "@/features/orders/order-status";
import { requireUser } from "@/lib/auth/session";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Order status",
  description: "Review your LocalCoKitchen order and payment status.",
  path: "/profile/orders/",
  noIndex: true,
});

export default async function OrderDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ checkout?: string }>;
}) {
  const emptyQuery: { checkout?: string } = {};
  const [{ id }, query, user] = await Promise.all([
    params,
    searchParams ?? Promise.resolve(emptyQuery),
    requireUser("/profile/orders/"),
  ]);
  const { order, error } = await getCustomerOrderDetails(user.id, id);

  if (!order && error === "Order not found.") notFound();

  return (
    <div className="content-page next-page-grid">
      <section className="page-hero">
        <p className="eyebrow">Checkout</p>
        <h1>Order status</h1>
        <p className="lede">
          Payment confirmation is handled by Stripe webhooks. Refresh this page if the payment
          status is still pending.
        </p>
      </section>

      {order ? (
        <>
          <OrderStatusBanner checkoutState={query.checkout} order={order} />
          <OrderDetailsCard order={order} />
        </>
      ) : (
        <section className="next-section">
          <p className="next-alert">{error ?? "Your order could not be loaded."}</p>
          <Link className="secondary-action compact-action" href="/profile/orders/">
            Back to orders
          </Link>
        </section>
      )}
    </div>
  );
}
