export type SiteLink = {
  href: string;
  label: string;
};

export type SiteLinkGroup = {
  title: string;
  links: SiteLink[];
};

export const primaryNavigation: SiteLink[] = [
  { href: "/search/", label: "Browse cooks" },
  { href: "/#how", label: "How it works" },
  { href: "/#trust", label: "Trust & safety" },
  { href: "/#cook-cta", label: "Become a cook" },
];

export const mobileUtilityNavigation: SiteLink[] = [
  { href: "/faq/", label: "FAQ" },
  { href: "/contact-us/", label: "Contact" },
];

export const accountNavigation: SiteLink[] = [
  { href: "/profile/", label: "My profile" },
  { href: "/menu/", label: "Available menu" },
  { href: "/faq/", label: "Help and FAQ" },
];

export const cookAccountNavigation: SiteLink = {
  href: "/my-shop/",
  label: "My kitchen",
};

export const footerNavigation: SiteLinkGroup[] = [
  {
    title: "Eat",
    links: [
      { label: "Browse cooks", href: "/search/" },
      { label: "Available menu", href: "/menu/" },
      { label: "Find a meal", href: "/find-a-meal/" },
      { label: "How it works", href: "/how-it-works/" },
    ],
  },
  {
    title: "Cook",
    links: [
      { label: "Become a cook", href: "/sell-your-food/" },
      { label: "My kitchen", href: "/my-shop/" },
      { label: "Create account", href: "/signup/" },
      { label: "Sign in", href: "/signin/" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Mission", href: "/mission/" },
      { label: "FAQ", href: "/faq/" },
      { label: "Contact", href: "/contact-us/" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "/privacy-policy/" },
      { label: "Terms", href: "/terms-and-conditions/" },
      { label: "Trust & safety", href: "/#trust" },
    ],
  },
];
