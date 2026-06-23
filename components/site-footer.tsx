import Image from "next/image";
import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer" aria-labelledby="footer-title">
      <div className="site-footer__inner">
        <div className="site-footer__brand">
          <Link className="brand" href="/" aria-label="LocalCoKitchen home">
            <Image src="/images/logo.svg" width={1500} height={1379} alt="LocalCoKitchen" />
          </Link>
          <p id="footer-title">
            Great food made closer to home. LocalCoKitchen connects customers with trusted
            independent cooks for homemade meals and scheduled local pickups.
          </p>
        </div>
        <nav className="site-footer__group" aria-label="Explore LocalCoKitchen">
          <h2>Explore</h2>
          <Link href="/menu/">Menu</Link>
          <Link href="/find-a-meal/">Find a meal</Link>
          <Link href="/how-it-works/">How it works</Link>
          <Link href="/mission/">Mission</Link>
        </nav>
        <nav className="site-footer__group" aria-label="Cook resources">
          <h2>Cook</h2>
          <Link href="/sell-your-food/">Sell your food</Link>
          <Link href="/my-shop/">My Kitchen</Link>
          <Link href="/signup/">Create account</Link>
          <Link href="/signin/">Sign in</Link>
        </nav>
        <nav className="site-footer__group" aria-label="Support and legal">
          <h2>Support</h2>
          <Link href="/faq/">FAQ</Link>
          <Link href="/contact-us/">Contact us</Link>
          <Link href="/privacy-policy/">Privacy policy</Link>
          <Link href="/terms-and-conditions/">Terms</Link>
        </nav>
      </div>
      <div className="site-footer__bottom">
        <span>&copy; 2026 LocalCoKitchen. All rights reserved.</span>
        <span>Great food made closer to home.</span>
      </div>
    </footer>
  );
}
