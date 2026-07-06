import Link from "next/link";
import type { Metadata } from "next";
import { AppChrome } from "@/components/app-chrome";
import { startCookOnboardingAction } from "@/features/auth/actions";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Sell Your Food",
  description:
    "Apply to become a LocalCoKitchen cook and share homemade meals with your community.",
  path: "/sell-your-food/",
});

export default async function SellFoodPage({
  searchParams,
}: {
  searchParams: Promise<{ setup?: string }>;
}) {
  const setupFailed = (await searchParams).setup === "error";

  return (
    <AppChrome>
      <div className="content-page next-page-grid">
        <section className="sell-hero">
          <div>
            <p className="eyebrow">For cooks</p>
            <h1>Turn your kitchen into a trusted local storefront.</h1>
            <p className="lede">
              Create a cook account, submit your application, publish menu items, and manage your
              pickup availability after approval.
            </p>
            {setupFailed ? (
              <p className="next-alert" role="alert">
                Cook setup could not be started. Refresh the page and try again.
              </p>
            ) : null}
            <div className="button-row">
              <form action={startCookOnboardingAction}>
                <button className="primary-action" type="submit">
                  Apply to become a cook
                </button>
              </form>
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
    </AppChrome>
  );
}
