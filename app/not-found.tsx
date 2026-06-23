import Link from "next/link";
import { AppChrome } from "@/components/app-chrome";

export default function NotFound() {
  return (
    <AppChrome>
      <div className="content-page next-page-grid">
        <section className="page-hero">
          <p className="eyebrow">404</p>
          <h1>Page not found</h1>
          <p className="lede">The page you requested does not exist or may have moved.</p>
          <Link className="primary-action" href="/">
            Return home
          </Link>
        </section>
      </div>
    </AppChrome>
  );
}
