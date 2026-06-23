import type { Metadata } from "next";
import { AppChrome } from "@/components/app-chrome";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Terms and Conditions",
  description: "LocalCoKitchen terms and conditions.",
  path: "/terms-and-conditions/",
});

export default function TermsPage() {
  return (
    <AppChrome>
      <div className="content-page next-page-grid">
        <section className="page-hero">
          <p className="eyebrow">Legal</p>
          <h1>Terms and conditions</h1>
        </section>
        <section className="next-card">
          <p>
            Use of LocalCoKitchen requires compliance with applicable food, safety, marketplace, and
            account rules. Cooks are responsible for accurate listings, ingredients, allergens,
            availability, and pickup information.
          </p>
        </section>
      </div>
    </AppChrome>
  );
}
