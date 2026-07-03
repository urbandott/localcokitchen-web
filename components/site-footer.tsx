import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { footerNavigation } from "@/lib/navigation/site-navigation";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface" aria-labelledby="footer-title">
      <div className="container-page py-14">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_2fr]">
          <div>
            <Link className="inline-flex" href="/" aria-label="LocalCoKitchen home">
              <BrandLogo placement="footer" />
            </Link>
            <p
              id="footer-title"
              className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground"
            >
              Great food made closer to home. LocalCoKitchen connects customers with trusted
              independent cooks for homemade meals and scheduled local pickups.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {footerNavigation.map((column) => (
              <nav key={column.title} aria-label={column.title}>
                <p className="text-sm font-semibold text-foreground">{column.title}</p>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className="transition-colors hover:text-foreground">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>
        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} localcokitchen. Made with care for local cooks.</p>
          <div className="flex gap-5">
            <Link href="/privacy-policy/" className="hover:text-foreground">
              Privacy
            </Link>
            <Link href="/terms-and-conditions/" className="hover:text-foreground">
              Terms
            </Link>
            <Link href="/faq/" className="hover:text-foreground">
              Help
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
