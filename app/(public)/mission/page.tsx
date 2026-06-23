import Image from "next/image";
import type { Metadata } from "next";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Mission",
  description:
    "LocalCoKitchen's mission is to make great local food easier to discover while supporting trusted home cooks.",
  path: "/mission/",
});

export default function MissionPage() {
  return (
    <div className="content-page next-page-grid">
      <section className="mission-hero">
        <div>
          <p className="eyebrow">Mission</p>
          <h1>Food is local before it is anything else.</h1>
          <p className="lede">
            We are building a marketplace where cooks can share food responsibly and customers can
            discover meals with confidence.
          </p>
        </div>
        <Image
          src="/images/mission-community-table.jpg"
          width={900}
          height={720}
          alt="Community table with shared food"
        />
      </section>
    </div>
  );
}
