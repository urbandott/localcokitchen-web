import Link from "next/link";
import { ChefHat, Menu } from "lucide-react";
import { mobileUtilityNavigation, primaryNavigation } from "@/lib/navigation/site-navigation";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2" aria-label="LocalCoKitchen home">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <ChefHat className="h-5 w-5" />
          </span>
          <span className="text-[17px] font-bold tracking-tight">
            localco<span className="text-primary">kitchen</span>
          </span>
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
          <Link
            href="/signin/"
            className="hidden h-10 items-center rounded-full px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary sm:inline-flex"
          >
            Sign in
          </Link>
          <Link
            href="/signup/"
            className="inline-flex h-10 items-center rounded-full bg-foreground px-4 text-sm font-semibold text-background transition-colors hover:bg-foreground/90"
          >
            Get started
          </Link>
          <details className="group relative md:hidden">
            <summary
              aria-label="Open menu"
              className="grid h-10 w-10 cursor-pointer list-none place-items-center rounded-full border border-border [&::-webkit-details-marker]:hidden"
            >
              <Menu className="h-5 w-5" />
            </summary>
            <nav
              aria-label="Mobile navigation"
              className="absolute right-0 top-12 z-50 grid w-64 gap-1 rounded-2xl border border-border bg-background p-2 shadow-card"
            >
              {[...primaryNavigation, ...mobileUtilityNavigation].map((link) => (
                <Link
                  className="rounded-xl px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
                  href={link.href}
                  key={link.href}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
