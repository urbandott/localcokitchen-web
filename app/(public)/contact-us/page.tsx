import type { Metadata } from "next";
import { AppChrome } from "@/components/app-chrome";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Contact Us",
  description: "Contact LocalCoKitchen support.",
  path: "/contact-us/",
});

export default function ContactPage() {
  return (
    <AppChrome>
      <div className="content-page next-page-grid">
        <section className="page-hero">
          <p className="eyebrow">Contact</p>
          <h1>Reach LocalCoKitchen</h1>
          <p className="lede">
            For customer, cook, or moderation questions, contact us at{" "}
            <a href="mailto:info@localcokitchen.com">info@localcokitchen.com</a>.
          </p>
        </section>
      </div>
    </AppChrome>
  );
}
