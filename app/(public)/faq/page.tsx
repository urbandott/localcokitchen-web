import type { Metadata } from "next";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "FAQ",
  description: "Frequently asked questions about LocalCoKitchen for customers and cooks.",
  path: "/faq/",
});

const faqs = [
  [
    "Who can sell on LocalCoKitchen?",
    "Cooks must create an account and complete the application review process before publishing a public kitchen.",
  ],
  [
    "Can customers add food from multiple cooks?",
    "Yes. The cart supports multiple cooks, and checkout must revalidate each item server-side.",
  ],
  [
    "How is private cook information handled?",
    "Public pages show only customer-safe cook profile fields and never expose legal names, phone numbers, addresses, documents, or admin notes.",
  ],
];

export default function FaqPage() {
  return (
    <div className="content-page next-page-grid">
      <section className="page-hero">
        <p className="eyebrow">FAQ</p>
        <h1>Frequently asked questions</h1>
      </section>
      <section className="next-section">
        {faqs.map(([question, answer]) => (
          <article className="next-card" key={question}>
            <h2>{question}</h2>
            <p>{answer}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
