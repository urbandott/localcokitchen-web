import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { HeaderAccountNavigation } from "@/components/header-account-navigation";
import { primaryNavigation } from "@/lib/navigation/site-navigation";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link href="/" className="shrink-0" aria-label="LocalCoKitchen home">
          <BrandLogo placement="header" priority />
        </Link>
        <nav
          className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex"
          aria-label="Primary navigation"
        >
          {primaryNavigation.map((link) => (
            <Link
              className="transition-colors hover:text-foreground"
              href={link.href}
              key={link.href}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <HeaderAccountNavigation />
        </div>
      </div>
    </header>
  );
}
