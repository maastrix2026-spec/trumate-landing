"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Search, X, ImageOff } from "lucide-react";

/* ---------- Types ---------- */

type Category = {
  _id: string;
  name: string;
  slug: string;
};

type Product = {
  _id: string;
  name: string;
  slug: string;
  description: string;
  category: Category | string | null;
  price?: number;
  compareAtPrice?: number;
  stock?: number;
  sku?: string;
  image?: string;
  gallery?: string[];
  status?: string;
  isFeatured?: boolean;
  createdAt?: string;
};

type SortKey = "featured" | "newest" | "price-asc" | "price-desc";

/* ---------- Helpers ---------- */

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const categorySlug = (p: Product) =>
  typeof p.category === "object" && p.category ? p.category.slug : p.category ?? "";

const categoryName = (p: Product) =>
  typeof p.category === "object" && p.category ? p.category.name : "";

const isLive = (p: Product) => p.status?.toLowerCase() === "published";

const discountPercent = (p: Product) =>
  p.compareAtPrice && p.price && p.compareAtPrice > p.price
    ? Math.round(((p.compareAtPrice - p.price) / p.compareAtPrice) * 100)
    : 0;

/* ---------- Page ---------- */

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("featured");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        setLoading(true);
        setError(false);
        const [prodRes, catRes] = await Promise.all([
          fetch("/api/products", { signal: controller.signal }),
          fetch("/api/categories", { signal: controller.signal }),
        ]);
        const prodJson = await prodRes.json();
        const catJson = await catRes.json();

        if (!prodJson.success) throw new Error("products");
        setProducts(prodJson.data);
        if (catJson.success) setCategories(catJson.data);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    load();
    return () => controller.abort();
  }, [reloadKey]);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    products.forEach((p) => {
      const slug = categorySlug(p);
      map[slug] = (map[slug] ?? 0) + 1;
    });
    return map;
  }, [products]);

  const visibleProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const list = products.filter((p) => {
      const inCategory =
        selectedCategory === "all" || categorySlug(p) === selectedCategory;
      const matches =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q);
      return inCategory && matches;
    });

    const sorted = [...list];
    switch (sort) {
      case "price-asc":
        sorted.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
        break;
      case "price-desc":
        sorted.sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
        break;
      case "newest":
        sorted.sort(
          (a, b) =>
            new Date(b.createdAt ?? 0).getTime() -
            new Date(a.createdAt ?? 0).getTime()
        );
        break;
      default:
        // Featured first, then live products before upcoming ones
        sorted.sort(
          (a, b) =>
            Number(!!b.isFeatured) - Number(!!a.isFeatured) ||
            Number(isLive(b)) - Number(isLive(a))
        );
    }
    return sorted;
  }, [products, selectedCategory, searchQuery, sort]);

  const hasFilters = selectedCategory !== "all" || searchQuery.trim() !== "";

  const clearFilters = () => {
    setSelectedCategory("all");
    setSearchQuery("");
  };

  return (
    <main className="min-h-screen bg-[#F3F4EF] text-[#18230F]">
      <div className="mx-auto max-w-7xl px-4 pb-20 pt-10 sm:px-6 lg:px-10 lg:pt-14">
        {/* Header */}
        <header className="max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Eco tableware and kitchen supplies for hospitality
          </h1>
          <p className="mt-3 text-sm leading-6 text-stone-600 sm:text-base">
            Compostable plates, bowls, cutlery and housekeeping consumables,
            supplied in bulk to restaurants, caterers and hotels.
          </p>
        </header>

        {/* Toolbar */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-md">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-stone-400"
            />
            <input
              type="search"
              aria-label="Search products"
              placeholder="Search by name or SKU"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-11 w-full rounded-lg border border-stone-300 bg-white pl-10 pr-4 text-sm outline-none transition-colors placeholder:text-stone-400 focus:border-[#1C3516] focus-visible:ring-2 focus-visible:ring-[#1C3516]/20"
            />
          </div>

          <div className="flex items-center gap-2 sm:ml-auto">
            <label htmlFor="sort" className="text-sm text-stone-500">
              Sort by
            </label>
            <select
              id="sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="h-11 rounded-lg border border-stone-300 bg-white px-3 text-sm outline-none focus:border-[#1C3516] focus-visible:ring-2 focus-visible:ring-[#1C3516]/20"
            >
              <option value="featured">Featured</option>
              <option value="newest">Newest</option>
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
            </select>
          </div>
        </div>

        {/* Mobile categories: horizontal scroll */}
        <nav
          aria-label="Product categories"
          className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <CategoryChip
            active={selectedCategory === "all"}
            onClick={() => setSelectedCategory("all")}
          >
            All
          </CategoryChip>
          {categories.map((cat) => (
            <CategoryChip
              key={cat._id}
              active={selectedCategory === cat.slug}
              onClick={() => setSelectedCategory(cat.slug)}
            >
              {cat.name}
            </CategoryChip>
          ))}
        </nav>

        <div className="mt-8 grid gap-10 lg:grid-cols-[220px_1fr]">
          {/* Desktop sidebar */}
          <aside className="hidden lg:block">
            <nav aria-label="Product categories" className="sticky top-24">
              <h2 className="mb-3 text-sm font-semibold">Categories</h2>
              <ul className="space-y-0.5">
                <li>
                  <SidebarItem
                    active={selectedCategory === "all"}
                    onClick={() => setSelectedCategory("all")}
                    label="All products"
                    count={products.length}
                  />
                </li>
                {categories.map((cat) => (
                  <li key={cat._id}>
                    <SidebarItem
                      active={selectedCategory === cat.slug}
                      onClick={() => setSelectedCategory(cat.slug)}
                      label={cat.name}
                      count={counts[cat.slug] ?? 0}
                      note={cat.slug.includes("spice") ? "Coming soon" : undefined}
                    />
                  </li>
                ))}
              </ul>
            </nav>
          </aside>

          {/* Results */}
          <section aria-live="polite">
            {!loading && !error && (
              <div className="mb-5 flex items-center justify-between text-sm text-stone-500">
                <p>
                  {visibleProducts.length}{" "}
                  {visibleProducts.length === 1 ? "product" : "products"}
                </p>
                {hasFilters && (
                  <button
                    onClick={clearFilters}
                    className="inline-flex cursor-pointer items-center gap-1 text-[#1C3516] underline-offset-4 hover:underline"
                  >
                    <X className="size-3.5" />
                    Clear filters
                  </button>
                )}
              </div>
            )}

            {loading ? (
              <SkeletonGrid />
            ) : error ? (
              <StateMessage
                title="We couldn't load the catalog"
                body="Check your connection and try again."
                actionLabel="Try again"
                onAction={() => setReloadKey((k) => k + 1)}
              />
            ) : visibleProducts.length === 0 ? (
              <StateMessage
                title="No products match your search"
                body="Try a different keyword or browse another category."
                actionLabel={hasFilters ? "Clear filters" : undefined}
                onAction={clearFilters}
              />
            ) : (
              <ul className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 xl:grid-cols-3">
                {visibleProducts.map((product) => (
                  <li key={product._id}>
                    <ProductCard product={product} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

/* ---------- Product card ---------- */

function ProductCard({ product }: { product: Product }) {
  const [imgFailed, setImgFailed] = useState(false);
  const live = isLive(product);
  const discount = discountPercent(product);
  const outOfStock = live && product.stock !== undefined && product.stock <= 0;
  const lowStock =
    live && product.stock !== undefined && product.stock > 0 && product.stock <= 10;

  const primary = product.image || product.gallery?.[0];
  const secondary = product.gallery?.find((src) => src !== primary);
  const quoteHref = `/bulk-orders?product=${encodeURIComponent(product.slug ?? product._id)}`;

  return (
    <article className="group flex h-full flex-col">
      {/* Image */}
      <div className="relative aspect-square overflow-hidden rounded-lg border border-stone-200 bg-white">
        {primary && !imgFailed ? (
          <>
            <Image
              src={primary}
              alt={product.name}
              fill
              sizes="(min-width: 1280px) 30vw, (min-width: 1024px) 40vw, 50vw"
              onError={() => setImgFailed(true)}
              className={`object-contain p-5 mix-blend-multiply transition-opacity duration-300 motion-reduce:transition-none ${
                secondary ? "group-hover:opacity-0" : ""
              } ${live ? "" : "grayscale-[40%]"}`}
            />
            {secondary && (
              <Image
                src={secondary}
                alt=""
                aria-hidden
                fill
                sizes="(min-width: 1280px) 30vw, (min-width: 1024px) 40vw, 50vw"
                className="object-contain p-5 mix-blend-multiply opacity-0 transition-opacity duration-300 group-hover:opacity-100 motion-reduce:transition-none"
              />
            )}
          </>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-stone-400">
            <ImageOff className="size-6" />
            <span className="text-xs">No image yet</span>
          </div>
        )}

        {/* Badges */}
        <div className="absolute left-2.5 top-2.5 flex flex-col items-start gap-1.5">
          {!live && (
            <span className="rounded-md bg-white/95 px-2 py-1 text-xs font-medium text-stone-700">
              Coming soon
            </span>
          )}
          {outOfStock && (
            <span className="rounded-md bg-white/95 px-2 py-1 text-xs font-medium text-stone-700">
              Out of stock
            </span>
          )}
          {live && discount > 0 && !outOfStock && (
            <span className="rounded-md bg-[#1C3516] px-2 py-1 text-xs font-medium text-white">
              {discount}% off
            </span>
          )}
        </div>
      </div>

      {/* Details */}
      <div className="mt-3 flex flex-1 flex-col">
        {categoryName(product) && (
          <p className="text-xs text-stone-500">{categoryName(product)}</p>
        )}
        <h3 className="mt-1 text-[15px] font-medium leading-snug sm:text-base">
          {product.name}
        </h3>
        <p className="mt-1 line-clamp-2 text-sm leading-5 text-stone-600">
          {product.description}
        </p>

        <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          {product.price ? (
            <>
              <span className="text-base font-semibold">{inr.format(product.price)}</span>
              {discount > 0 && (
                <span className="text-sm text-stone-400 line-through">
                  {inr.format(product.compareAtPrice!)}
                </span>
              )}
              <span className="text-xs text-stone-500">per unit</span>
            </>
          ) : (
            <span className="text-sm text-stone-600">Price on request</span>
          )}
        </div>

        {lowStock && (
          <p className="mt-1 text-xs font-medium text-amber-700">
            Only {product.stock} left
          </p>
        )}

        <div className="mt-auto pt-4">
          {live && !outOfStock ? (
            <Link
              href={quoteHref}
              className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-[#1C3516] text-sm font-medium text-[#1C3516] transition-colors hover:bg-[#1C3516] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1C3516] motion-reduce:transition-none"
            >
              Request bulk quote
            </Link>
          ) : (
            <button
              disabled
              className="inline-flex h-10 w-full cursor-not-allowed items-center justify-center rounded-lg border border-stone-200 text-sm font-medium text-stone-400"
            >
              {outOfStock ? "Currently unavailable" : "Not available yet"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

/* ---------- Small pieces ---------- */

function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`h-9 shrink-0 cursor-pointer whitespace-nowrap rounded-lg px-3.5 text-sm transition-colors ${
        active
          ? "bg-[#1C3516] text-white"
          : "bg-white text-stone-700 ring-1 ring-inset ring-stone-200 hover:bg-stone-50"
      }`}
    >
      {children}
    </button>
  );
}

function SidebarItem({
  active,
  onClick,
  label,
  count,
  note,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  note?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex w-full cursor-pointer items-start justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
        active
          ? "bg-[#1C3516] text-white"
          : "text-stone-700 hover:bg-[#E4E8DC]"
      }`}
    >
      <span>
        {label}
        {note && (
          <span className={`block text-xs ${active ? "text-white/70" : "text-stone-500"}`}>
            {note}
          </span>
        )}
      </span>
      <span className={`tabular-nums ${active ? "text-white/70" : "text-stone-400"}`}>
        {count}
      </span>
    </button>
  );
}

function SkeletonGrid() {
  return (
    <ul
      role="status"
      aria-label="Loading products"
      className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 xl:grid-cols-3"
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i} className="animate-pulse motion-reduce:animate-none">
          <div className="aspect-square rounded-lg border border-stone-200 bg-stone-100" />
          <div className="mt-3 h-3 w-1/3 rounded bg-[#E4E8DC]" />
          <div className="mt-2 h-4 w-3/4 rounded bg-[#E4E8DC]" />
          <div className="mt-2 h-3 w-full rounded bg-[#E4E8DC]" />
          <div className="mt-4 h-10 rounded-lg bg-[#E4E8DC]" />
        </li>
      ))}
    </ul>
  );
}

function StateMessage({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-lg border border-dashed border-stone-300 px-6 py-16 text-center">
      <p className="text-base font-medium">{title}</p>
      <p className="mt-1 text-sm text-stone-600">{body}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-5 h-10 cursor-pointer rounded-lg bg-[#1C3516] px-5 text-sm font-medium text-white transition-colors hover:bg-[#244620]"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}