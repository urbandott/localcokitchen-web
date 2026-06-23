import type { Metadata } from "next";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Privacy Policy",
  description: "LocalCoKitchen privacy policy.",
  path: "/privacy-policy/",
});

export default function PrivacyPage() {
  return (
    <div className="content-page next-page-grid">
      <section className="page-hero">
        <p className="eyebrow">Legal</p>
        <h1>Privacy policy</h1>
      </section>
      <section className="next-card">
        <p>
          LocalCoKitchen stores only the information needed to operate customer, cook, and admin
          workflows. Private cook application details are restricted by authorization and RLS
          policies.
        </p>
        <p>
          Payment data, when introduced, must be processed through a PCI-compliant provider and must
          not be stored directly unless explicitly required and secured.
        </p>
      </section>
    </div>
  );
}
