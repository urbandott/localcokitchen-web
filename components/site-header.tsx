import Image from "next/image";
import Link from "next/link";
import { getCurrentUser, currentUserIsAdmin } from "@/lib/auth/session";

const navLinks = [
  { href: "/menu/", label: "Menu" },
  { href: "/find-a-meal/", label: "Find a meal" },
  { href: "/sell-your-food/", label: "Sell your food" },
  { href: "/how-it-works/", label: "How it works" },
  { href: "/mission/", label: "Mission" },
  { href: "/faq/", label: "FAQ" },
];

export async function SiteHeader() {
  const [user, isAdmin] = await Promise.all([getCurrentUser(), currentUserIsAdmin()]);

  return (
    <header className="top-nav">
      <Link className="brand nav-brand" href="/" aria-label="LocalCoKitchen home">
        <Image src="/images/logo.svg" width={1500} height={1379} alt="LocalCoKitchen" priority />
      </Link>
      <nav className="nav-actions" aria-label="Primary navigation">
        <Link className="nav-icon-link" href="/menu/" aria-label="Open available menu">
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="m21 21-4.35-4.35" />
            <circle cx="11" cy="11" r="7" />
          </svg>
          <span>Menu</span>
        </Link>
        {user ? (
          <>
            <Link className="nav-button" href="/profile/">
              Profile
            </Link>
            {isAdmin ? (
              <Link className="nav-button" href="/admin/">
                Admin
              </Link>
            ) : null}
          </>
        ) : (
          <Link className="nav-button" href="/signin/">
            Sign in
          </Link>
        )}
        <div className="nav-more">
          <button
            className="nav-more__button nav-more__button--icon"
            type="button"
            aria-expanded="false"
            aria-label="Open navigation menu"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M4 7h16" />
              <path d="M4 12h16" />
              <path d="M4 17h16" />
            </svg>
          </button>
          <div className="nav-more__menu">
            <Link href="/">Home</Link>
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                {link.label}
              </Link>
            ))}
            <Link href="/contact-us/">Contact us</Link>
          </div>
        </div>
      </nav>
    </header>
  );
}
