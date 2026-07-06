import type { Metadata } from "next";
import { startCookOnboardingAction } from "@/features/auth/actions";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertCircle,
  ArrowRight,
  CalendarClock,
  ChefHat,
  Lock,
  MapPin,
  MessageCircle,
  Search,
  ShieldCheck,
  ShoppingBag,
  Star,
} from "lucide-react";
import { AppChrome } from "@/components/app-chrome";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "localcokitchen — Authentic homemade food near you",
  description:
    "Discover and order fresh homemade meals from trusted local cooks. Schedule a pickup in minutes.",
});

const featuredCooks = [
  {
    name: "Priya Shah",
    cuisine: "North Indian",
    rating: 4.9,
    reviews: 218,
    distance: "0.8 mi",
    dishes: "Samosas · Butter chicken · Dal",
    img: "/images/reference/cook-priya.jpg",
  },
  {
    name: "María González",
    cuisine: "Oaxacan Mexican",
    rating: 5.0,
    reviews: 184,
    distance: "1.2 mi",
    dishes: "Tamales · Mole · Tres leches",
    img: "/images/reference/cook-maria.jpg",
  },
  {
    name: "Marcus Boone",
    cuisine: "Texas BBQ",
    rating: 4.8,
    reviews: 312,
    distance: "2.4 mi",
    dishes: "Ribs · Brisket · Cornbread",
    img: "/images/reference/cook-marcus.jpg",
  },
  {
    name: "Linh Nguyen",
    cuisine: "Vietnamese",
    rating: 4.9,
    reviews: 156,
    distance: "1.7 mi",
    dishes: "Pho · Banh mi · Spring rolls",
    img: "/images/reference/cook-linh.jpg",
  },
];

const categories = [
  { name: "Mexican", emoji: "🌮" },
  { name: "Indian", emoji: "🍛" },
  { name: "BBQ", emoji: "🍖" },
  { name: "Soul Food", emoji: "🍗" },
  { name: "Bakery", emoji: "🥐" },
  { name: "Asian", emoji: "🍜" },
  { name: "Mediterranean", emoji: "🥙" },
  { name: "Vegan", emoji: "🥗" },
];

export default function HomePage() {
  return (
    <AppChrome>
      <Hero />
      <Categories />
      <FeaturedCooks />
      <HowItWorks />
      <TrustSafety />
      <Testimonials />
      <CookCta />
    </AppChrome>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-cream">
      <div className="container-page grid items-center gap-12 py-16 lg:grid-cols-[1.05fr_1fr] lg:py-24">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-background/70 px-3 py-1 text-xs font-medium text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Now serving your neighborhood
          </span>
          <h1 className="mt-5 text-4xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Discover authentic <span className="text-primary">homemade food</span> near you
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Order directly from trusted local cooks in your community. Fresh, made-to-order meals —
            ready when you are.
          </p>

          <form
            action="/search/"
            className="mt-8 rounded-3xl bg-background p-2 shadow-[var(--shadow-card)] ring-1 ring-border"
          >
            <div className="grid gap-2 sm:grid-cols-[1.2fr_1fr_1fr_auto] sm:items-center">
              <SearchField
                icon={<Search className="h-4 w-4" />}
                label="Dish or cuisine"
                name="q"
                placeholder="Tacos, biryani, BBQ…"
              />
              <Divider />
              <SearchField
                icon={<ChefHat className="h-4 w-4" />}
                label="Cook or category"
                name="cook"
                placeholder="Any cook"
              />
              <Divider />
              <SearchField
                icon={<MapPin className="h-4 w-4" />}
                label="ZIP code"
                name="zip"
                placeholder="94110"
              />
              <button className="mt-1 inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-lift)] transition-transform hover:scale-[1.02] sm:mt-0">
                <Search className="h-4 w-4" />
                Find food
              </button>
            </div>
          </form>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href="/search/"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background transition-colors hover:bg-foreground/90"
            >
              <ShoppingBag className="h-4 w-4" />
              Browse cooks
            </Link>
            <Link
              href="/sell-your-food/"
              className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-background px-5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
            >
              Become a cook
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <dl className="mt-10 grid max-w-md grid-cols-3 gap-6">
            <Stat label="Local cooks" value="1,200+" />
            <Stat label="Avg. rating" value="4.9★" />
            <Stat label="Meals served" value="85k+" />
          </dl>
        </div>

        <div className="relative">
          <div className="absolute -left-6 -top-6 hidden h-32 w-32 rounded-full bg-primary/10 blur-2xl lg:block" />
          <div className="absolute -bottom-8 -right-4 hidden h-40 w-40 rounded-full bg-primary/15 blur-3xl lg:block" />
          <div className="relative overflow-hidden rounded-[28px] shadow-[var(--shadow-card)] ring-1 ring-border">
            <Image
              src="/images/reference/hero-dishes.jpg"
              alt="A spread of homemade dishes from local cooks: biryani, tacos, ribs, cornbread, and hummus"
              width={1600}
              height={1280}
              className="h-full w-full object-cover"
              priority
            />
          </div>
          <FloatingCard
            className="absolute -left-4 bottom-8 sm:-left-8"
            avatar="/images/reference/cook-maria.jpg"
            title="María just listed"
            subtitle="Mole rojo · pickup tonight"
          />
          <FloatingCard
            className="absolute -right-3 top-10 sm:-right-6"
            badge={<Star className="h-3.5 w-3.5 fill-primary text-primary" />}
            title="4.9 average rating"
            subtitle="From 12,400+ reviews"
          />
        </div>
      </div>
    </section>
  );
}

function SearchField({
  icon,
  label,
  name,
  placeholder,
}: {
  icon: ReactNode;
  label: string;
  name: string;
  placeholder: string;
}) {
  return (
    <label className="group flex items-center gap-3 rounded-2xl px-4 py-2.5 transition-colors hover:bg-secondary/60">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-secondary text-muted-foreground group-focus-within:bg-primary/10 group-focus-within:text-primary">
        {icon}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <input
          type="text"
          name={name}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
        />
      </span>
    </label>
  );
}

function Divider() {
  return <span className="hidden h-10 w-px self-center bg-border sm:block" />;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-2xl font-bold tracking-tight text-foreground">{value}</dd>
    </div>
  );
}

function FloatingCard({
  className = "",
  avatar,
  badge,
  title,
  subtitle,
}: {
  className?: string;
  avatar?: string;
  badge?: ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl bg-background/95 px-4 py-3 shadow-[var(--shadow-card)] ring-1 ring-border backdrop-blur ${className}`}
    >
      {avatar ? (
        <Image
          src={avatar}
          alt=""
          width={40}
          height={40}
          className="h-10 w-10 rounded-full object-cover"
        />
      ) : (
        <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
          {badge}
        </span>
      )}
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function Categories() {
  return (
    <section className="container-page py-14">
      <SectionHeader
        eyebrow="Popular categories"
        title="What are you craving tonight?"
        action="Browse all"
      />
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {categories.map((category) => (
          <Link
            key={category.name}
            href={`/search/?q=${encodeURIComponent(category.name)}`}
            className="group flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 text-center transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[var(--shadow-soft)]"
          >
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-cream text-2xl transition-transform group-hover:scale-110">
              {category.emoji}
            </span>
            <span className="text-sm font-semibold text-foreground">{category.name}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function FeaturedCooks() {
  return (
    <section id="cooks" className="bg-surface py-16">
      <div className="container-page">
        <SectionHeader
          eyebrow="Featured cooks"
          title="Meet the people behind your next meal"
          action="See all cooks"
        />
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {featuredCooks.map((cook) => (
            <article
              key={cook.name}
              className="group overflow-hidden rounded-3xl bg-card ring-1 ring-border transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-card)]"
            >
              <div className="relative aspect-[4/5] overflow-hidden">
                <Image
                  src={cook.img}
                  alt={`${cook.name}, ${cook.cuisine} home cook`}
                  width={800}
                  height={800}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                />
                <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-background/95 px-2.5 py-1 text-xs font-semibold text-foreground shadow-[var(--shadow-soft)]">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Verified
                </span>
                <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-background/95 px-2.5 py-1 text-xs font-semibold text-foreground shadow-[var(--shadow-soft)]">
                  <MapPin className="h-3.5 w-3.5" /> {cook.distance}
                </span>
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold text-foreground">
                      {cook.name}
                    </h3>
                    <p className="mt-0.5 text-sm text-muted-foreground">{cook.cuisine}</p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-cream px-2.5 py-1 text-xs font-semibold text-cream-foreground">
                    <Star className="h-3.5 w-3.5 fill-primary text-primary" />
                    {cook.rating}
                  </span>
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{cook.dishes}</p>
                <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{cook.reviews} reviews</span>
                  <Link href="/search/" className="font-semibold text-primary">
                    View menu →
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      icon: Search,
      title: "Browse local cooks",
      body: "Explore verified cooks in your area by cuisine, rating, or what's available today.",
    },
    {
      icon: ShoppingBag,
      title: "Order online",
      body: "Pick your dishes, choose a pickup window, and pay securely in seconds.",
    },
    {
      icon: CalendarClock,
      title: "Pick up fresh",
      body: "Grab your meal at the scheduled time. Hot, fresh, made just for you.",
    },
  ];
  return (
    <section id="how" className="container-page py-20">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">How it works</p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Real food, three simple steps
        </h2>
        <p className="mt-3 text-muted-foreground">
          No drivers. No mystery kitchens. Just a direct connection to the cooks in your
          neighborhood.
        </p>
      </div>
      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {steps.map((step, index) => (
          <div
            key={step.title}
            className="relative rounded-3xl border border-border bg-card p-7 shadow-[var(--shadow-soft)]"
          >
            <span className="absolute -top-3 left-7 inline-flex h-7 items-center rounded-full bg-foreground px-3 text-xs font-bold text-background">
              Step {index + 1}
            </span>
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-cream text-primary">
              <step.icon className="h-6 w-6" />
            </span>
            <h3 className="mt-5 text-lg font-semibold">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function TrustSafety() {
  const items = [
    {
      icon: ShieldCheck,
      title: "Verified cooks",
      body: "ID, food handler permit, and kitchen review before any listing goes live.",
    },
    {
      icon: Lock,
      title: "Secure payments",
      body: "Encrypted checkout with full refund protection if something goes wrong.",
    },
    {
      icon: MessageCircle,
      title: "Community reviews",
      body: "Real ratings from real neighbors — no bots, no paid placements.",
    },
    {
      icon: AlertCircle,
      title: "Allergen info",
      body: "Every dish lists ingredients and allergens so you can order with confidence.",
    },
  ];
  return (
    <section id="trust" className="bg-cream py-20">
      <div className="container-page">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">
            Trust & safety
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Built for the people you&apos;d share a meal with
          </h2>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <div key={item.title} className="rounded-3xl bg-background p-6 ring-1 ring-border">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary">
                <item.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-base font-semibold">{item.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Testimonials() {
  const quotes = [
    {
      quote: "It tastes like my grandmother's cooking — I order from Priya every Sunday now.",
      name: "Anita R.",
      role: "Customer · Berkeley",
    },
    {
      quote: "I turned my Saturday tamales into a real business. The platform handles everything.",
      name: "María G.",
      role: "Cook · Oakland",
    },
    {
      quote: "Way better than delivery apps. Fresh, personal, and I know exactly who made my food.",
      name: "James K.",
      role: "Customer · San Jose",
    },
  ];
  return (
    <section className="container-page py-20">
      <SectionHeader eyebrow="From the community" title="Loved by neighbors and cooks alike" />
      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {quotes.map((quote) => (
          <figure
            key={quote.name}
            className="flex h-full flex-col rounded-3xl border border-border bg-card p-7 shadow-[var(--shadow-soft)]"
          >
            <div className="flex gap-0.5 text-primary">
              {Array.from({ length: 5 }).map((_, index) => (
                <Star key={index} className="h-4 w-4 fill-primary" />
              ))}
            </div>
            <blockquote className="mt-4 flex-1 text-[15px] leading-relaxed text-foreground">
              &ldquo;{quote.quote}&rdquo;
            </blockquote>
            <figcaption className="mt-6 border-t border-border pt-4">
              <p className="text-sm font-semibold">{quote.name}</p>
              <p className="text-xs text-muted-foreground">{quote.role}</p>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

function CookCta() {
  return (
    <section id="cook-cta" className="container-page pb-20">
      <div className="relative overflow-hidden rounded-[32px] bg-primary px-8 py-14 text-primary-foreground sm:px-14 sm:py-20">
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-cream/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-10 h-64 w-64 rounded-full bg-cream/10 blur-3xl" />
        <div className="relative grid items-center gap-10 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-background/15 px-3 py-1 text-xs font-medium">
              <ChefHat className="h-3.5 w-3.5" /> For cooks
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              Turn your kitchen into a business
            </h2>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-primary-foreground/85">
              Set your own menu, schedule, and prices. We handle payments, customer support, and
              growing your neighborhood following.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <form action={startCookOnboardingAction}>
                <button
                  className="inline-flex h-12 cursor-pointer items-center gap-2 rounded-full border-0 bg-background px-6 text-sm font-semibold text-foreground transition-colors hover:bg-background/90"
                  type="submit"
                >
                  Apply to become a cook
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
              <Link
                href="/sell-your-food/"
                className="inline-flex h-12 items-center rounded-full border border-primary-foreground/30 px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-background/10"
              >
                Learn more
              </Link>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-4">
            {[
              { value: "$2,400", label: "Avg. monthly earnings" },
              { value: "0%", label: "Setup cost" },
              { value: "48h", label: "Verification time" },
              { value: "24/7", label: "Cook support" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl bg-background/10 p-5 ring-1 ring-background/15"
              >
                <dt className="text-xs uppercase tracking-wide text-primary-foreground/70">
                  {stat.label}
                </dt>
                <dd className="mt-1 text-2xl font-bold">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}

function SectionHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: string;
}) {
  return (
    <div className="flex items-end justify-between gap-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">{eyebrow}</p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
      </div>
      {action ? (
        <Link
          href="/search/"
          className="hidden shrink-0 items-center gap-1.5 text-sm font-semibold text-foreground hover:text-primary sm:inline-flex"
        >
          {action} <ArrowRight className="h-4 w-4" />
        </Link>
      ) : null}
    </div>
  );
}
