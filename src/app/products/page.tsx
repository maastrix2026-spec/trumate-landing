/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X, ImageOff, SlidersHorizontal } from "lucide-react";
import Markdown from "@/components/Markdown";
import MarkdownPreview from "@/components/MarkdownPreview";

/* ---------- Types ---------- */

type Category = {
  _id: string;
  name: string;
  slug: string;
};

type ProductVariant = {
  _id?: string;
  label: string;
  unitType?: string;
  price: number;
  compareAtPrice?: number;
  stock?: number;
  sku?: string;
  image?: string;
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
  variants?: ProductVariant[];
  status?: string;
  isFeatured?: boolean;
  createdAt?: string;
};

type SortKey = "featured" | "newest" | "price-asc" | "price-desc";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
];

const PAGE_SIZE = 12;

/* ---------- Helpers ---------- */

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const categorySlug = (p: Product) =>
  typeof p.category === "object" && p.category
    ? p.category.slug
    : (p.category ?? "");

const categoryName = (p: Product) =>
  typeof p.category === "object" && p.category ? p.category.name : "";

const isLive = (p: Product) => p.status?.toLowerCase() === "published";

const isAvailable = (p: Product) =>
  isLive(p) && (p.stock === undefined || p.stock > 0);

const discountPercent = (p: Product) =>
  p.compareAtPrice && p.price && p.compareAtPrice > p.price
    ? Math.round(((p.compareAtPrice - p.price) / p.compareAtPrice) * 100)
    : 0;

function getCardPricingAndStock(p: Product) {
  const variants = p.variants ?? [];

  if (variants.length > 0) {
    // Pick lowest-priced variant (or first in-stock variant if tied/needed)
    const sortedByPrice = [...variants].sort((a, b) => a.price - b.price);
    const cheapest = sortedByPrice[0];
    const hasMultiplePrices =
      new Set(
        variants
          .map((v) => v.price)
          .filter((n) => typeof n === "number" && n > 0),
      ).size > 1;

    const effectivePrice = cheapest?.price;
    const effectiveCompareAt = cheapest?.compareAtPrice;
    const effectiveStock = variants.reduce(
      (sum, v) => sum + (typeof v.stock === "number" ? v.stock : 0),
      0,
    );
    const discount =
      effectivePrice &&
      effectiveCompareAt &&
      effectiveCompareAt > effectivePrice
        ? Math.round(
            ((effectiveCompareAt - effectivePrice) / effectiveCompareAt) * 100,
          )
        : 0;

    return {
      price: effectivePrice,
      compareAtPrice: effectiveCompareAt,
      stock: effectiveStock,
      discount,
      isFromPrice: hasMultiplePrices,
      variantCount: variants.length,
    };
  }

  // Fallback for products without variants
  const discount = discountPercent(p);
  return {
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    stock: p.stock,
    discount,
    isFromPrice: false,
    variantCount: 0,
  };
}

const toNumber = (value: string | null) => {
  if (value === null || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/* ---------- Page (Suspense is required for useSearchParams) ---------- */

export default function ProductsPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <ProductsView />
    </Suspense>
  );
}

function ProductsView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  /* ----- Filters live in the URL, so Back and shared links keep them ----- */
  const q = searchParams.get("q") ?? "";
  const selectedCategory = searchParams.get("category") ?? "all";
  const sortParam = searchParams.get("sort") as SortKey | null;
  const sort: SortKey = SORT_OPTIONS.some((o) => o.value === sortParam)
    ? (sortParam as SortKey)
    : "featured";
  const inStockOnly = searchParams.get("stock") === "1";
  const minParam = searchParams.get("min") ?? "";
  const maxParam = searchParams.get("max") ?? "";
  const minPrice = toNumber(minParam);
  const maxPrice = toNumber(maxParam);

  const setParams = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      });
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [searchParams, pathname, router],
  );

  /* ----- Data ----- */
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
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

  /* ----- Search box: typing is local, URL updates after a short pause ----- */
  const [searchInput, setSearchInput] = useState(q);
  const lastCommittedQ = useRef(q);

  useEffect(() => {
    if (q !== lastCommittedQ.current) {
      lastCommittedQ.current = q;
      setSearchInput(q);
    }
  }, [q]);

  useEffect(() => {
    if (searchInput.trim() === q) return;
    const timer = setTimeout(() => {
      lastCommittedQ.current = searchInput.trim();
      setParams({ q: searchInput.trim() || null });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, q, setParams]);

  /* ----- Price inputs: applied on blur or Enter ----- */
  const [minInput, setMinInput] = useState(minParam);
  const [maxInput, setMaxInput] = useState(maxParam);
  useEffect(() => setMinInput(minParam), [minParam]);
  useEffect(() => setMaxInput(maxParam), [maxParam]);

  const applyPrice = () =>
    setParams({
      min: toNumber(minInput) !== null ? String(toNumber(minInput)) : null,
      max: toNumber(maxInput) !== null ? String(toNumber(maxInput)) : null,
    });

  /* ----- Derived data ----- */
  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    products.forEach((p) => {
      const slug = categorySlug(p);
      map[slug] = (map[slug] ?? 0) + 1;
    });
    return map;
  }, [products]);

  const priceCeiling = useMemo(
    () => Math.max(0, ...products.map((p) => p.price ?? 0)),
    [products],
  );

  const visibleProducts = useMemo(() => {
    const query = q.trim().toLowerCase();

    const list = products.filter((p) => {
      if (selectedCategory !== "all" && categorySlug(p) !== selectedCategory)
        return false;
      if (inStockOnly && !isAvailable(p)) return false;
      if (minPrice !== null && (p.price ?? 0) < minPrice) return false;
      if (maxPrice !== null && (p.price ?? Infinity) > maxPrice) return false;
      if (!query) return true;
      return (
        p.name.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query) ||
        p.sku?.toLowerCase().includes(query)
      );
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
            new Date(a.createdAt ?? 0).getTime(),
        );
        break;
      default:
        sorted.sort(
          (a, b) =>
            Number(!!b.isFeatured) - Number(!!a.isFeatured) ||
            Number(isLive(b)) - Number(isLive(a)),
        );
    }
    return sorted;
  }, [products, selectedCategory, q, inStockOnly, minPrice, maxPrice, sort]);

  /* ----- Show more ----- */
  const [limit, setLimit] = useState(PAGE_SIZE);
  const filterKey = searchParams.toString();
  useEffect(() => setLimit(PAGE_SIZE), [filterKey]);
  const shownProducts = visibleProducts.slice(0, limit);

  /* ----- Active filters ----- */
  const activeCategory = categories.find((c) => c.slug === selectedCategory);
  const hasPriceFilter = minPrice !== null || maxPrice !== null;
  const activeFilterCount =
    (selectedCategory !== "all" ? 1 : 0) +
    (inStockOnly ? 1 : 0) +
    (hasPriceFilter ? 1 : 0);
  const hasFilters = activeFilterCount > 0 || q.trim() !== "";

  const clearFilters = () => {
    setSearchInput("");
    router.replace(pathname, { scroll: false });
  };

  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) =>
      e.key === "Escape" && setSheetOpen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [sheetOpen]);

  const filterPanelProps = {
    categories,
    counts,
    total: products.length,
    selectedCategory,
    onCategory: (slug: string) =>
      setParams({ category: slug === "all" ? null : slug }),
    inStockOnly,
    onInStock: (value: boolean) => setParams({ stock: value ? "1" : null }),
    minInput,
    maxInput,
    onMinInput: setMinInput,
    onMaxInput: setMaxInput,
    onApplyPrice: applyPrice,
    priceCeiling,
  };

  return (
    <main className="min-h-screen bg-[#F3F4EF] text-[#18230F]">
      <div className="mx-auto max-w-7xl px-4 pb-20 pt-8 sm:px-6 lg:px-10 lg:pt-12">
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
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="h-11 w-full rounded-lg border border-stone-300 bg-white pl-10 pr-4 text-sm outline-none transition-colors placeholder:text-stone-400 focus:border-[#1C3516] focus-visible:ring-2 focus-visible:ring-[#1C3516]/20"
            />
          </div>

          <div className="flex items-center gap-2 sm:ml-auto">
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg border border-stone-300 bg-white px-3.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50 lg:hidden"
            >
              <SlidersHorizontal className="size-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="flex size-5 items-center justify-center rounded-full bg-[#1C3516] text-xs text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>

            <label
              htmlFor="sort"
              className="ml-auto hidden text-sm text-stone-500 sm:block"
            >
              Sort by
            </label>
            <select
              id="sort"
              value={sort}
              onChange={(e) =>
                setParams({
                  sort: e.target.value === "featured" ? null : e.target.value,
                })
              }
              className="h-11 flex-1 rounded-lg border border-stone-300 bg-white px-3 text-sm outline-none focus:border-[#1C3516] focus-visible:ring-2 focus-visible:ring-[#1C3516]/20 sm:flex-none"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Mobile category chips */}
        <nav
          aria-label="Product categories"
          className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <CategoryChip
            active={selectedCategory === "all"}
            onClick={() => filterPanelProps.onCategory("all")}
          >
            All
          </CategoryChip>
          {categories.map((cat) => (
            <CategoryChip
              key={cat._id}
              active={selectedCategory === cat.slug}
              onClick={() => filterPanelProps.onCategory(cat.slug)}
            >
              {cat.name}
            </CategoryChip>
          ))}
        </nav>

        <div className="mt-8 grid gap-10 lg:grid-cols-[240px_1fr]">
          {/* Desktop filters */}
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <FilterPanel {...filterPanelProps} showCategories />
            </div>
          </aside>

          {/* Results */}
          <section aria-live="polite">
            {!loading && !error && (
              <div className="mb-5 space-y-3">
                <div className="flex items-center justify-between text-sm text-stone-500">
                  <p>
                    {visibleProducts.length}{" "}
                    {visibleProducts.length === 1 ? "product" : "products"}
                  </p>
                  {hasFilters && (
                    <button
                      onClick={clearFilters}
                      className="cursor-pointer text-[#1C3516] underline-offset-4 hover:underline"
                    >
                      Clear all
                    </button>
                  )}
                </div>

                {hasFilters && (
                  <ul className="flex flex-wrap gap-2">
                    {q.trim() && (
                      <FilterTag
                        label={`“${q.trim()}”`}
                        onRemove={() => {
                          setSearchInput("");
                          setParams({ q: null });
                        }}
                      />
                    )}
                    {selectedCategory !== "all" && (
                      <FilterTag
                        label={activeCategory?.name ?? selectedCategory}
                        onRemove={() => setParams({ category: null })}
                      />
                    )}
                    {inStockOnly && (
                      <FilterTag
                        label="In stock"
                        onRemove={() => setParams({ stock: null })}
                      />
                    )}
                    {hasPriceFilter && (
                      <FilterTag
                        label={
                          minPrice !== null && maxPrice !== null
                            ? `${inr.format(minPrice)} to ${inr.format(maxPrice)}`
                            : minPrice !== null
                              ? `From ${inr.format(minPrice)}`
                              : `Up to ${inr.format(maxPrice!)}`
                        }
                        onRemove={() => setParams({ min: null, max: null })}
                      />
                    )}
                  </ul>
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
                title="No products match your filters"
                body="Try a different keyword, or remove some filters."
                actionLabel={hasFilters ? "Clear all filters" : undefined}
                onAction={clearFilters}
              />
            ) : (
              <>
                <ul className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 xl:grid-cols-3">
                  {shownProducts.map((product, index) => (
                    <li key={product._id}>
                      <ProductCard product={product} priority={index < 3} />
                    </li>
                  ))}
                </ul>

                {visibleProducts.length > shownProducts.length && (
                  <div className="mt-12 flex flex-col items-center gap-2">
                    <p className="text-sm text-stone-500">
                      Showing {shownProducts.length} of {visibleProducts.length}
                    </p>
                    <button
                      onClick={() => setLimit((l) => l + PAGE_SIZE)}
                      className="h-11 cursor-pointer rounded-lg border border-[#1C3516] px-6 text-sm font-medium text-[#1C3516] transition-colors hover:bg-[#1C3516] hover:text-white"
                    >
                      Show more products
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>

      {/* Mobile filter sheet */}
      {sheetOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-stone-900/50 lg:hidden"
          onMouseDown={(e) =>
            e.target === e.currentTarget && setSheetOpen(false)
          }
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Filters"
            className="flex max-h-[85vh] w-full flex-col rounded-t-2xl bg-[#F3F4EF]"
          >
            <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
              <h2 className="text-base font-semibold">Filters</h2>
              <button
                onClick={() => setSheetOpen(false)}
                aria-label="Close filters"
                className="-mr-2 cursor-pointer rounded-lg p-2 text-stone-500 hover:bg-stone-200/60"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5">
              <FilterPanel {...filterPanelProps} showCategories={false} />
            </div>
            <div className="flex gap-3 border-t border-stone-200 bg-white px-5 py-3.5">
              <button
                onClick={clearFilters}
                className="h-11 cursor-pointer rounded-lg border border-stone-300 px-4 text-sm font-medium text-stone-700"
              >
                Clear all
              </button>
              <button
                onClick={() => {
                  applyPrice();
                  setSheetOpen(false);
                }}
                className="h-11 flex-1 cursor-pointer rounded-lg bg-[#1C3516] text-sm font-medium text-white"
              >
                Show {visibleProducts.length}{" "}
                {visibleProducts.length === 1 ? "product" : "products"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/* ---------- Filter panel (desktop sidebar + mobile sheet) ---------- */

type FilterPanelProps = {
  categories: Category[];
  counts: Record<string, number>;
  total: number;
  selectedCategory: string;
  onCategory: (slug: string) => void;
  inStockOnly: boolean;
  onInStock: (value: boolean) => void;
  minInput: string;
  maxInput: string;
  onMinInput: (v: string) => void;
  onMaxInput: (v: string) => void;
  onApplyPrice: () => void;
  priceCeiling: number;
  showCategories: boolean;
};

function FilterPanel(props: FilterPanelProps) {
  const onEnter = (e: React.KeyboardEvent) =>
    e.key === "Enter" && props.onApplyPrice();

  return (
    <div className="space-y-7">
      {props.showCategories && (
        <nav aria-label="Product categories">
          <h2 className="mb-3 text-sm font-semibold">Categories</h2>
          <ul className="space-y-0.5">
            <li>
              <SidebarItem
                active={props.selectedCategory === "all"}
                onClick={() => props.onCategory("all")}
                label="All products"
                count={props.total}
              />
            </li>
            {props.categories.map((cat) => (
              <li key={cat._id}>
                <SidebarItem
                  active={props.selectedCategory === cat.slug}
                  onClick={() => props.onCategory(cat.slug)}
                  label={cat.name}
                  count={props.counts[cat.slug] ?? 0}
                  note={cat.slug.includes("spice") ? "Coming soon" : undefined}
                />
              </li>
            ))}
          </ul>
        </nav>
      )}

      <div>
        <h2 className="mb-3 text-sm font-semibold">Availability</h2>
        <label className="flex cursor-pointer items-center gap-3 text-sm text-stone-700">
          <input
            type="checkbox"
            checked={props.inStockOnly}
            onChange={(e) => props.onInStock(e.target.checked)}
            className="size-4 cursor-pointer rounded border-stone-300 accent-[#1C3516]"
          />
          In stock only
        </label>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold">Price per unit</h2>
        <div className="flex items-center gap-2">
          <PriceField
            label="Minimum price"
            placeholder="Min"
            value={props.minInput}
            onChange={props.onMinInput}
            onBlur={props.onApplyPrice}
            onKeyDown={onEnter}
          />
          <span className="text-stone-400">to</span>
          <PriceField
            label="Maximum price"
            placeholder={
              props.priceCeiling ? String(props.priceCeiling) : "Max"
            }
            value={props.maxInput}
            onChange={props.onMaxInput}
            onBlur={props.onApplyPrice}
            onKeyDown={onEnter}
          />
        </div>
      </div>
    </div>
  );
}

function PriceField({
  label,
  placeholder,
  value,
  onChange,
  onBlur,
  onKeyDown,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}) {
  return (
    <div className="relative min-w-0 flex-1">
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-stone-400">
        ₹
      </span>
      <input
        type="number"
        min="0"
        inputMode="numeric"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        className="h-10 w-full rounded-lg border border-stone-300 bg-white pl-6 pr-2 text-sm outline-none placeholder:text-stone-400 focus:border-[#1C3516] focus-visible:ring-2 focus-visible:ring-[#1C3516]/20"
      />
    </div>
  );
}

/* ---------- Product card ---------- */

function ProductCard({
  product,
  priority = false,
}: {
  product: Product;
  priority?: boolean;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const live = isLive(product);

  const {
    price: displayPrice,
    compareAtPrice: displayCompareAt,
    stock: displayStock,
    discount,
    isFromPrice,
    variantCount,
  } = getCardPricingAndStock(product);

  const outOfStock = live && displayStock !== undefined && displayStock <= 0;
  const lowStock =
    live &&
    displayStock !== undefined &&
    displayStock > 0 &&
    displayStock <= 10;

  const primary = product.image || product.gallery?.[0];
  const secondary = product.gallery?.find((src) => src !== primary);
  const detailHref = `/products/${product.slug}`;
  const quoteHref = `/bulk-orders?product=${encodeURIComponent(product.slug ?? product._id)}`;
  const sizes = "(min-width: 1280px) 28vw, (min-width: 1024px) 38vw, 50vw";

  return (
    // The product name is a stretched link, so the whole card opens the detail page
    <article className="group relative flex h-full flex-col">
      <div className="relative aspect-square overflow-hidden rounded-lg border border-stone-200 bg-white">
        {primary && !imgFailed ? (
          <>
            <Image
              src={primary}
              alt={product.name}
              fill
              sizes={sizes}
              loading={priority ? "eager" : "lazy"}
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
                sizes={sizes}
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
          {live && product.isFeatured && !outOfStock && (
            <span className="rounded-md bg-white/95 px-2 py-1 text-xs font-medium text-[#1C3516]">
              Featured
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-1 flex-col">
        {categoryName(product) && (
          <p className="text-xs text-stone-500">{categoryName(product)}</p>
        )}
        <h3 className="mt-1 text-[15px] font-medium leading-snug sm:text-base">
          <Link
            href={detailHref}
            className="outline-none after:absolute after:inset-0 after:rounded-lg hover:underline focus-visible:after:ring-2 focus-visible:after:ring-[#1C3516]"
          >
            {product.name}
          </Link>
        </h3>
        <MarkdownPreview className="mt-1 line-clamp-2 text-sm leading-5 text-stone-600">
          {product.description}
        </MarkdownPreview>

        <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          {displayPrice ? (
            <>
              {isFromPrice && (
                <span className="text-xs font-medium text-stone-500">From</span>
              )}
              <span className="text-lg font-semibold">
                {inr.format(displayPrice)}
              </span>
              {discount > 0 && displayCompareAt && (
                <span className="text-sm text-stone-400 line-through">
                  {inr.format(displayCompareAt)}
                </span>
              )}
              <span className="text-xs text-stone-500">per unit</span>
            </>
          ) : (
            <span className="text-sm text-stone-600">Price on request</span>
          )}

          {variantCount > 0 && (
            <span className="text-xs font-medium text-stone-500">
              ({variantCount} {variantCount === 1 ? "variant" : "variants"})
            </span>
          )}
        </div>

        {lowStock && (
          <p className="mt-1 text-xs font-medium text-amber-700">
            Only {displayStock} left
          </p>
        )}

        <div className="mt-auto pt-4">
          {live && !outOfStock ? (
            <Link
              href={quoteHref}
              className="relative z-10 inline-flex h-10 w-full items-center justify-center rounded-lg bg-[#1C3516] text-sm font-medium text-white transition-colors hover:bg-[#244620] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1C3516] motion-reduce:transition-none"
            >
              Request bulk quote
            </Link>
          ) : (
            <button
              disabled
              className="relative z-10 inline-flex h-10 w-full cursor-not-allowed items-center justify-center rounded-lg border border-stone-200 text-sm font-medium text-stone-400"
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

function FilterTag({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <li>
      <button
        onClick={onRemove}
        aria-label={`Remove filter: ${label}`}
        className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-white pl-3 pr-2 text-sm text-stone-700 ring-1 ring-inset ring-stone-200 transition-colors hover:bg-stone-50"
      >
        {label}
        <X className="size-3.5 text-stone-400" />
      </button>
    </li>
  );
}

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
        active ? "bg-[#1C3516] text-white" : "text-stone-700 hover:bg-[#E4E8DC]"
      }`}
    >
      <span>
        {label}
        {note && (
          <span
            className={`block text-xs ${active ? "text-white/70" : "text-stone-500"}`}
          >
            {note}
          </span>
        )}
      </span>
      <span
        className={`tabular-nums ${active ? "text-white/70" : "text-stone-400"}`}
      >
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

function PageFallback() {
  return (
    <main className="min-h-screen bg-[#F3F4EF]">
      <div className="mx-auto max-w-7xl px-4 pb-20 pt-8 sm:px-6 lg:px-10 lg:pt-12">
        <div className="h-10 w-2/3 max-w-xl animate-pulse rounded bg-[#E4E8DC]" />
        <div className="mt-10">
          <SkeletonGrid />
        </div>
      </div>
    </main>
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
