import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { HeaderAccountNavigation } from "@/components/header-account-navigation";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link href="/" className="shrink-0" aria-label="LocalCoKitchen home">
          <BrandLogo placement="header" priority />
        </Link>
        <HeaderAccountNavigation />
      </div>
    </header>
  );
}
