import Link from "next/link";
import type { Metadata } from "next";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Sell Your Food",
  description:
    "Apply to become a LocalCoKitchen cook and share homemade meals with your community.",
  path: "/sell-your-food/",
});

export default function SellFoodPage() {
  return (
    <div className="content-page next-page-grid">
      <section className="sell-hero">
        <div>
          <p className="eyebrow">For cooks</p>
          <h1>Turn your kitchen into a trusted local storefront.</h1>
          <p className="lede">
            Create a cook account, submit your application, publish menu items, and manage your
            pickup availability after approval.
          </p>
          <div className="button-row">
            <Link className="primary-action" href="/signup/">
              Create account
            </Link>
            <Link className="secondary-action" href="/my-shop/">
              Manage my kitchen
            </Link>
          </div>
        </div>
      </section>
      <section className="next-card-grid">
        <article className="next-card">
          <h2>Apply</h2>
          <p>Submit required details and documents for review.</p>
        </article>
        <article className="next-card">
          <h2>Publish</h2>
          <p>Approved cooks can manage public profiles and menu items.</p>
        </article>
        <article className="next-card">
          <h2>Serve</h2>
          <p>Set pickup windows and keep item availability current.</p>
        </article>
      </section>
    </div>
  );
}
