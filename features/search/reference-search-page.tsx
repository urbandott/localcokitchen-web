"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  Clock,
  Flame,
  Heart,
  Inbox,
  Loader2,
  MapPin,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  X,
} from "lucide-react";

type Cook = {
  name: string;
  cuisine: string;
  rating: number;
  reviews: number;
  distance: number;
  prepTime: string;
  signature: string;
  priceFrom: number;
  verified: boolean;
  popular?: boolean;
  badges: string[];
  img: string;
};

const ALL_COOKS: Cook[] = [
  {
    name: "Priya Shah",
    cuisine: "Indian",
    rating: 4.9,
    reviews: 218,
    distance: 0.8,
    prepTime: "Ready in 45m",
    signature: "Butter chicken · Samosas · Dal makhani",
    priceFrom: 12,
    verified: true,
    popular: true,
    badges: ["Vegetarian options", "Family-friendly"],
    img: "/images/reference/cook-priya.jpg",
  },
  {
    name: "María González",
    cuisine: "Mexican",
    rating: 5.0,
    reviews: 184,
    distance: 1.2,
    prepTime: "Ready in 60m",
    signature: "Mole negro · Tamales · Tres leches",
    priceFrom: 14,
    verified: true,
    popular: true,
    badges: ["Heritage recipes", "Gluten-free options"],
    img: "/images/reference/cook-maria.jpg",
  },
  {
    name: "Marcus Boone",
    cuisine: "BBQ",
    rating: 4.8,
    reviews: 312,
    distance: 2.4,
    prepTime: "Ready in 90m",
    signature: "Brisket · St. Louis ribs · Cornbread",
    priceFrom: 18,
    verified: true,
    badges: ["Slow-smoked", "Pickup only"],
    img: "/images/reference/cook-marcus.jpg",
  },
  {
    name: "Linh Nguyen",
    cuisine: "Asian",
    rating: 4.9,
    reviews: 156,
    distance: 1.7,
    prepTime: "Ready in 35m",
    signature: "Pho bo · Bánh mì · Spring rolls",
    priceFrom: 11,
    verified: true,
    badges: ["Made-to-order broth"],
    img: "/images/reference/cook-linh.jpg",
  },
  {
    name: "Adaeze Okafor",
    cuisine: "Soul Food",
    rating: 4.7,
    reviews: 92,
    distance: 3.1,
    prepTime: "Ready in 75m",
    signature: "Jollof rice · Fried chicken · Plantains",
    priceFrom: 13,
    verified: true,
    badges: ["Halal"],
    img: "/images/reference/cook-priya.jpg",
  },
  {
    name: "Sofia Romano",
    cuisine: "Mediterranean",
    rating: 4.6,
    reviews: 68,
    distance: 4.2,
    prepTime: "Ready in 50m",
    signature: "Lasagna · Tiramisu · Focaccia",
    priceFrom: 15,
    verified: false,
    badges: ["Bakery"],
    img: "/images/reference/cook-maria.jpg",
  },
  {
    name: "Daniel Park",
    cuisine: "Asian",
    rating: 4.85,
    reviews: 141,
    distance: 0.5,
    prepTime: "Ready in 40m",
    signature: "Bibimbap · Korean fried chicken",
    priceFrom: 13,
    verified: true,
    popular: true,
    badges: ["New this month"],
    img: "/images/reference/cook-marcus.jpg",
  },
  {
    name: "Yasmin Haddad",
    cuisine: "Mediterranean",
    rating: 4.95,
    reviews: 203,
    distance: 1.9,
    prepTime: "Ready in 55m",
    signature: "Mansaf · Kibbeh · Baklava",
    priceFrom: 16,
    verified: true,
    badges: ["Vegetarian options"],
    img: "/images/reference/cook-linh.jpg",
  },
];

const CUISINES = [
  "Mexican",
  "Indian",
  "BBQ",
  "Asian",
  "Soul Food",
  "Mediterranean",
  "Bakery",
  "Vegan",
];
const DIETARY = ["Vegetarian", "Vegan", "Gluten-free", "Halal", "Dairy-free"];
const SORTS = [
  "Recommended",
  "Top rated",
  "Nearest",
  "Fastest pickup",
  "Price: low to high",
] as const;
type Sort = (typeof SORTS)[number];

export function ReferenceSearchPage() {
  const [query, setQuery] = useState("");
  const [zip, setZip] = useState("94110");
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [dietary, setDietary] = useState<string[]>([]);
  const [minRating, setMinRating] = useState(0);
  const [maxDistance, setMaxDistance] = useState(5);
  const [sort, setSort] = useState<Sort>("Recommended");
  const [openFilters, setOpenFilters] = useState(false);
  const [state, setState] = useState<"results" | "loading" | "empty" | "error">("results");
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  const results = useMemo(() => {
    let r = ALL_COOKS.filter((c) => {
      if (
        query &&
        !`${c.name} ${c.cuisine} ${c.signature}`.toLowerCase().includes(query.toLowerCase())
      ) {
        return false;
      }
      if (cuisines.length && !cuisines.includes(c.cuisine)) return false;
      if (c.rating < minRating) return false;
      if (c.distance > maxDistance) return false;
      return true;
    });
    switch (sort) {
      case "Top rated":
        r = [...r].sort((a, b) => b.rating - a.rating);
        break;
      case "Nearest":
        r = [...r].sort((a, b) => a.distance - b.distance);
        break;
      case "Price: low to high":
        r = [...r].sort((a, b) => a.priceFrom - b.priceFrom);
        break;
      case "Fastest pickup":
        r = [...r].sort(
          (a, b) =>
            Number.parseInt(a.prepTime.match(/\d+/)?.[0] ?? "0", 10) -
            Number.parseInt(b.prepTime.match(/\d+/)?.[0] ?? "0", 10),
        );
        break;
      default:
        break;
    }
    return r;
  }, [query, cuisines, minRating, maxDistance, sort]);

  const activeFilters =
    cuisines.length + dietary.length + (minRating > 0 ? 1 : 0) + (maxDistance < 5 ? 1 : 0);

  function toggleSaved(name: string) {
    setSaved((s) => {
      const n = new Set(s);
      if (n.has(name)) {
        n.delete(name);
        setToast(`Removed ${name} from saved`);
      } else {
        n.add(name);
        setToast(`Saved ${name} to favorites`);
      }
      window.setTimeout(() => setToast(null), 2200);
      return n;
    });
  }

  function clearAll() {
    setCuisines([]);
    setDietary([]);
    setMinRating(0);
    setMaxDistance(5);
    setQuery("");
  }

  const visible = state === "empty" ? [] : results;

  return (
    <div className="min-h-screen bg-background">
      <section className="border-b border-border/70 bg-surface">
        <div className="container-page py-5 lg:py-7">
          <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr_auto] lg:items-center">
            <label className="flex h-12 items-center gap-3 rounded-2xl bg-card px-4 shadow-soft ring-1 ring-border">
              <span className="sr-only">Search dishes, cuisine, or cook name</span>
              <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search dishes, cuisine, or cook name"
                className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="text-muted-foreground hover:text-foreground"
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </label>
            <label className="flex h-12 items-center gap-3 rounded-2xl bg-card px-4 shadow-soft ring-1 ring-border">
              <span className="sr-only">ZIP code</span>
              <MapPin className="h-5 w-5 shrink-0 text-muted-foreground" />
              <input
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                placeholder="ZIP code"
                className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
              />
              <span className="hidden text-xs text-muted-foreground sm:inline">
                Within {maxDistance} mi
              </span>
            </label>
            <button className="hidden h-12 items-center justify-center rounded-2xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-lift transition-transform hover:-translate-y-0.5 lg:inline-flex">
              Search
            </button>
          </div>

          <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setOpenFilters(true)}
              className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium shadow-soft lg:hidden"
              type="button"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {activeFilters > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                  {activeFilters}
                </span>
              )}
            </button>
            {CUISINES.slice(0, 6).map((c) => {
              const on = cuisines.includes(c);
              return (
                <button
                  key={c}
                  onClick={() =>
                    setCuisines((prev) => (on ? prev.filter((x) => x !== c) : [...prev, c]))
                  }
                  className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                    on
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-foreground hover:border-foreground/30"
                  }`}
                  type="button"
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="container-page py-8 lg:py-10">
        <div className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <FilterPanel
              activeFilters={activeFilters}
              cuisines={cuisines}
              dietary={dietary}
              maxDistance={maxDistance}
              minRating={minRating}
              onClear={clearAll}
              setCuisines={setCuisines}
              setDietary={setDietary}
              setMaxDistance={setMaxDistance}
              setMinRating={setMinRating}
            />
          </aside>

          <div className="min-w-0">
            <div className="mb-5 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 sm:flex sm:flex-wrap sm:justify-between">
              <div className="min-w-0">
                <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">
                  {state === "loading"
                    ? "Searching nearby cooks…"
                    : state === "error"
                      ? "Something went wrong"
                      : `${visible.length} home cook${visible.length === 1 ? "" : "s"} near ${zip}`}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pickup only · Verified neighbors · Updated just now
                </p>
              </div>
              <SortMenu sort={sort} setSort={setSort} />
            </div>

            <div className="mb-5 flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-border bg-surface px-3 py-2 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Preview state:</span>
              {(["results", "loading", "empty", "error"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setState(s)}
                  className={`rounded-full px-3 py-1 transition-colors ${
                    state === s ? "bg-foreground text-background" : "hover:bg-card"
                  }`}
                  type="button"
                >
                  {s}
                </button>
              ))}
            </div>

            {state === "loading" && <LoadingGrid />}
            {state === "error" && <ErrorState onRetry={() => setState("results")} />}
            {state === "empty" && <EmptyState onClear={clearAll} />}
            {state === "results" && visible.length === 0 && <EmptyState onClear={clearAll} />}
            {state === "results" && visible.length > 0 && (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {visible.map((c) => (
                  <CookCard
                    key={c.name}
                    cook={c}
                    saved={saved.has(c.name)}
                    onSave={() => toggleSaved(c.name)}
                  />
                ))}
              </div>
            )}

            {state === "results" && visible.length > 0 && (
              <div className="mt-10 flex items-center justify-center">
                <button className="inline-flex h-12 items-center rounded-full border border-border bg-card px-6 text-sm font-semibold shadow-soft transition-colors hover:bg-secondary">
                  Load more cooks
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {openFilters && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-foreground/40"
            onClick={() => setOpenFilters(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-3xl bg-background p-5 shadow-lift">
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-border" />
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Filters</h2>
              <button
                onClick={() => setOpenFilters(false)}
                aria-label="Close filters"
                className="grid h-9 w-9 place-items-center rounded-full border border-border"
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <FilterPanel
              activeFilters={activeFilters}
              cuisines={cuisines}
              dietary={dietary}
              maxDistance={maxDistance}
              minRating={minRating}
              onClear={clearAll}
              setCuisines={setCuisines}
              setDietary={setDietary}
              setMaxDistance={setMaxDistance}
              setMinRating={setMinRating}
            />
            <div className="sticky bottom-0 -mx-5 mt-6 flex gap-3 border-t border-border bg-background/95 px-5 py-4 backdrop-blur">
              <button
                onClick={clearAll}
                className="h-12 flex-1 rounded-full border border-border text-sm font-semibold"
                type="button"
              >
                Clear all
              </button>
              <button
                onClick={() => setOpenFilters(false)}
                className="h-12 flex-[1.4] rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-lift"
                type="button"
              >
                Show {results.length} results
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <div className="inline-flex items-center gap-3 rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background shadow-lift">
            <Check className="h-4 w-4 text-success" />
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}

function SortMenu({ sort, setSort }: { sort: Sort; setSort: (s: Sort) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-medium shadow-soft hover:bg-secondary"
        type="button"
      >
        Sort: <span className="font-semibold text-foreground">{sort}</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-2xl border border-border bg-popover p-1.5 shadow-card">
            {SORTS.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setSort(s);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                  sort === s ? "bg-secondary font-semibold" : "hover:bg-secondary"
                }`}
                type="button"
              >
                {s}
                {sort === s && <Check className="h-4 w-4 text-primary" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function FilterPanel(props: {
  cuisines: string[];
  setCuisines: (v: string[]) => void;
  dietary: string[];
  setDietary: (v: string[]) => void;
  minRating: number;
  setMinRating: (v: number) => void;
  maxDistance: number;
  setMaxDistance: (v: number) => void;
  onClear: () => void;
  activeFilters: number;
}) {
  const {
    cuisines,
    setCuisines,
    dietary,
    setDietary,
    minRating,
    setMinRating,
    maxDistance,
    setMaxDistance,
    onClear,
    activeFilters,
  } = props;

  return (
    <div className="space-y-7 rounded-3xl border border-border bg-card p-6 shadow-soft lg:sticky lg:top-24">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold">Filters</h2>
        {activeFilters > 0 && (
          <button
            onClick={onClear}
            className="text-xs font-semibold text-primary hover:underline"
            type="button"
          >
            Clear all ({activeFilters})
          </button>
        )}
      </div>

      <FilterGroup title="Cuisine">
        <div className="flex flex-wrap gap-2">
          {CUISINES.map((c) => {
            const on = cuisines.includes(c);
            return (
              <button
                key={c}
                onClick={() => setCuisines(on ? cuisines.filter((x) => x !== c) : [...cuisines, c])}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  on
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-foreground hover:border-foreground/30"
                }`}
                type="button"
              >
                {c}
              </button>
            );
          })}
        </div>
      </FilterGroup>

      <FilterGroup title="Dietary">
        <div className="space-y-2.5">
          {DIETARY.map((d) => {
            const on = dietary.includes(d);
            return (
              <label key={d} className="flex cursor-pointer items-center gap-3 text-sm">
                <span
                  className={`grid h-5 w-5 place-items-center rounded-md border transition-colors ${
                    on
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background"
                  }`}
                >
                  {on && <Check className="h-3.5 w-3.5" />}
                </span>
                <input
                  checked={on}
                  className="sr-only"
                  onChange={() => setDietary(on ? dietary.filter((x) => x !== d) : [...dietary, d])}
                  type="checkbox"
                />
                {d}
              </label>
            );
          })}
        </div>
      </FilterGroup>

      <FilterGroup title="Minimum rating">
        <div className="grid grid-cols-4 gap-2">
          {[0, 4.0, 4.5, 4.8].map((r) => {
            const on = minRating === r;
            return (
              <button
                key={r}
                onClick={() => setMinRating(r)}
                className={`flex items-center justify-center gap-1 rounded-xl border px-2 py-2 text-xs font-semibold transition-colors ${
                  on
                    ? "border-primary bg-cream text-primary"
                    : "border-border hover:border-foreground/30"
                }`}
                type="button"
              >
                {r === 0 ? (
                  "Any"
                ) : (
                  <>
                    <Star className="h-3.5 w-3.5 fill-current" />
                    {r.toFixed(1)}+
                  </>
                )}
              </button>
            );
          })}
        </div>
      </FilterGroup>

      <FilterGroup title="Distance">
        <div className="space-y-2">
          <input
            className="w-full accent-[oklch(0.43_0.14_22)]"
            max={10}
            min={1}
            onChange={(e) => setMaxDistance(Number.parseInt(e.target.value, 10))}
            step={1}
            type="range"
            value={maxDistance}
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>1 mi</span>
            <span className="font-semibold text-foreground">Within {maxDistance} mi</span>
            <span>10 mi</span>
          </div>
        </div>
      </FilterGroup>

      <FilterGroup title="Pickup window">
        <div className="grid grid-cols-2 gap-2">
          {["Today", "Tomorrow", "This week", "Any time"].map((w, i) => (
            <button
              key={w}
              className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                i === 0
                  ? "border-primary bg-cream text-primary"
                  : "border-border hover:border-foreground/30"
              }`}
              type="button"
            >
              {w}
            </button>
          ))}
        </div>
      </FilterGroup>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      {children}
    </div>
  );
}

function CookCard({ cook, saved, onSave }: { cook: Cook; saved: boolean; onSave: () => void }) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-soft transition-all hover:-translate-y-1 hover:shadow-card">
      <div className="relative aspect-[5/4] overflow-hidden bg-muted">
        <Image
          alt={`Homemade ${cook.cuisine} food by ${cook.name}`}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          height={640}
          loading="lazy"
          src={cook.img}
          width={800}
        />
        <button
          onClick={onSave}
          aria-label={saved ? "Remove from saved" : "Save cook"}
          className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-background/90 backdrop-blur transition-colors hover:bg-background"
          type="button"
        >
          <Heart
            className={`h-5 w-5 transition-colors ${saved ? "fill-primary text-primary" : "text-foreground"}`}
          />
        </button>
        {cook.popular && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-foreground/90 px-3 py-1 text-xs font-semibold text-background backdrop-blur">
            <Flame className="h-3.5 w-3.5 text-[oklch(0.78_0.16_55)]" /> Popular
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-[17px] font-bold tracking-tight">{cook.name}</h3>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{cook.cuisine}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1 rounded-full bg-cream px-2.5 py-1 text-xs font-bold text-primary">
            <Star className="h-3.5 w-3.5 fill-current" />
            {cook.rating.toFixed(1)}
            <span className="font-medium text-muted-foreground">({cook.reviews})</span>
          </div>
        </div>

        <p className="mt-3 line-clamp-2 text-sm text-foreground/80">{cook.signature}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {cook.verified && (
            <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-semibold text-success">
              <ShieldCheck className="h-3 w-3" /> Verified
            </span>
          )}
          {cook.badges.slice(0, 1).map((b) => (
            <span
              key={b}
              className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-foreground"
            >
              {b}
            </span>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-border pt-4">
          <div className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> {cook.distance.toFixed(1)} mi away
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> {cook.prepTime}
            </span>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[11px] text-muted-foreground">From</p>
            <p className="text-base font-bold tracking-tight">${cook.priceFrom}</p>
          </div>
        </div>

        <button className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background transition-transform hover:-translate-y-0.5">
          View menu
        </button>
      </div>
    </article>
  );
}

function LoadingGrid() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-3xl border border-border bg-card p-0 shadow-soft"
        >
          <div className="aspect-[5/4] animate-pulse bg-muted" />
          <div className="space-y-3 p-5">
            <div className="h-4 w-2/3 animate-pulse rounded-full bg-muted" />
            <div className="h-3 w-1/3 animate-pulse rounded-full bg-muted" />
            <div className="h-3 w-full animate-pulse rounded-full bg-muted" />
            <div className="h-10 w-full animate-pulse rounded-full bg-muted" />
          </div>
        </div>
      ))}
      <div className="col-span-full flex items-center justify-center gap-2 pt-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Finding cooks within range…
      </div>
    </div>
  );
}

function EmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-surface p-10 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-cream text-primary">
        <Inbox className="h-7 w-7" />
      </div>
      <h3 className="mt-5 text-lg font-bold">No cooks match those filters</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
        Try widening the distance, lowering the minimum rating, or removing a cuisine.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          onClick={onClear}
          className="inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-lift"
          type="button"
        >
          Clear all filters
        </button>
        <button className="inline-flex h-11 items-center rounded-full border border-border bg-card px-5 text-sm font-semibold">
          Notify me when new cooks join
        </button>
      </div>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-3xl border border-destructive/20 bg-destructive/5 p-10 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertCircle className="h-7 w-7" />
      </div>
      <h3 className="mt-5 text-lg font-bold">We couldn&apos;t load nearby cooks</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
        Check your connection and try again. Your filters are saved.
      </p>
      <button
        onClick={onRetry}
        className="mt-6 inline-flex h-11 items-center rounded-full bg-foreground px-5 text-sm font-semibold text-background"
        type="button"
      >
        Try again
      </button>
    </div>
  );
}
