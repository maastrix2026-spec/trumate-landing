"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronRight, ImageOff, ArrowLeft } from "lucide-react";
import Markdown from "@/components/Markdown";

/* ---------- Types ---------- */

type Category = { _id: string; name: string; slug: string };

type Variant = {
  _id: string;
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
  variants?: Variant[];
  status?: string;
  isFeatured?: boolean;
};

type LoadState = "loading" | "ready" | "not-found" | "error";
type Tone = "ok" | "warn" | "off";

/* ---------- Helpers ---------- */

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const getCategory = (p: Product): Category | null =>
  typeof p.category === "object" && p.category ? p.category : null;

const isLive = (p: Product) => p.status?.toLowerCase() === "published";

const discountOf = (price?: number, compareAt?: number) =>
  price && compareAt && compareAt > price
    ? Math.round(((compareAt - price) / compareAt) * 100)
    : 0;

function getAvailability(
  live: boolean,
  stock?: number,
): { label: string; tone: Tone } {
  if (!live) return { label: "Coming soon", tone: "off" };
  if (stock !== undefined && stock <= 0)
    return { label: "Out of stock", tone: "off" };
  if (stock !== undefined && stock <= 10)
    return { label: `Low stock, ${stock} left`, tone: "warn" };
  return { label: "In stock", tone: "ok" };
}

const toneDot: Record<Tone, string> = {
  ok: "bg-emerald-600",
  warn: "bg-amber-500",
  off: "bg-stone-400",
};

/** The variant shown first: the one in the URL, else the first that is in stock, else the first. */
function pickVariant(
  variants: Variant[],
  id: string | null,
): Variant | undefined {
  return (
    variants.find((v) => v._id === id) ??
    variants.find((v) => v.stock === undefined || v.stock > 0) ??
    variants[0]
  );
}

/** Price text for listing-style cards: "From ₹X" when variants have different prices. */
function priceLabel(p: Product): string {
  const variants = p.variants ?? [];
  if (variants.length > 0) {
    const prices = variants.map((v) => v.price).filter((n) => typeof n === "number" && n > 0);
    if (prices.length > 1) {
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      if (min !== max) return `From ${inr.format(min)}`;
    }
    if (prices.length === 1) return `${inr.format(prices[0])} per unit`;
    return "Price on request";
  }

  return p.price ? `${inr.format(p.price)} per unit` : "Price on request";
}

/* ---------- Page ---------- */

export default function ProductDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = decodeURIComponent(params.slug);

  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        setState("loading");
        const res = await fetch(
          `/api/products/slug/${encodeURIComponent(slug)}`,
          {
            signal: controller.signal,
          },
        );
        if (res.status === 404) {
          setState("not-found");
          return;
        }
        const json = await res.json();
        if (!json.success) throw new Error("Request failed");
        setProduct(json.data);
        setRelated(json.related ?? []);
        setState("ready");
      } catch (err) {
        if ((err as Error).name !== "AbortError") setState("error");
      }
    }

    load();
    return () => controller.abort();
  }, [slug, reloadKey]);

  useEffect(() => {
    if (product) document.title = `${product.name} | Trumate`;
  }, [product]);

  return (
    <main className="min-h-screen bg-[#F3F4EF] text-[#18230F]">
      <div className="mx-auto max-w-7xl px-4 pb-28 pt-8 sm:px-6 lg:px-10 lg:pb-20 lg:pt-10">
        {state === "loading" && <DetailSkeleton />}

        {state === "error" && (
          <Message
            title="We couldn't load this product"
            body="Check your connection and try again."
            actionLabel="Try again"
            onAction={() => setReloadKey((k) => k + 1)}
          />
        )}

        {state === "not-found" && (
          <Message
            title="Product not found"
            body="It may have been removed or the link may be incorrect."
            actionHref="/products"
            actionLabel="Back to catalog"
          />
        )}

        {state === "ready" && product && (
          <>
            <Breadcrumb product={product} />
            <ProductDetail key={product._id} product={product} />

            {related.length > 0 && (
              <section className="mt-16 border-t border-stone-300/70 pt-10">
                <h2 className="text-xl font-semibold tracking-tight">
                  More from {getCategory(product)?.name ?? "this catalog"}
                </h2>
                <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 lg:grid-cols-4">
                  {related.map((p) => (
                    <li key={p._id}>
                      <RelatedCard product={p} />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}

/* ---------- Breadcrumb ---------- */

function Breadcrumb({ product }: { product: Product }) {
  const cat = getCategory(product);
  return (
    <nav aria-label="Breadcrumb" className="mb-6 text-sm text-stone-500">
      <ol className="flex flex-wrap items-center gap-1.5">
        <li>
          <Link
            href="/products"
            className="hover:text-[#1C3516] hover:underline"
          >
            Products
          </Link>
        </li>
        {cat && (
          <>
            <ChevronRight className="size-3.5" aria-hidden />
            <li>
              <Link
                href={`/products?category=${encodeURIComponent(cat.slug)}`}
                className="hover:text-[#1C3516] hover:underline"
              >
                {cat.name}
              </Link>
            </li>
          </>
        )}
        <ChevronRight className="size-3.5" aria-hidden />
        <li aria-current="page" className="text-stone-800">
          {product.name}
        </li>
      </ol>
    </nav>
  );
}

/* ---------- Main product block ---------- */

function ProductDetail({ product }: { product: Product }) {
  const variants = useMemo(() => product.variants ?? [], [product.variants]);
  const hasVariants = variants.length > 0;

  /* Selected variant, remembered in the URL (?variant=<id>) so links can be shared */
  const [variantId, setVariantId] = useState<string | null>(() =>
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("variant"),
  );
  const variant = hasVariants ? pickVariant(variants, variantId) : undefined;

  /* Gallery: one stable list, so thumbnails don't reshuffle when the variant changes */
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const images = useMemo(() => {
    const all = [
      product.image,
      ...(product.gallery ?? []),
      ...variants.map((v) => v.image),
    ].filter((src): src is string => Boolean(src));
    return Array.from(new Set(all)).filter((src) => !failed.has(src));
  }, [product.image, product.gallery, variants, failed]);

  const [activeSrc, setActiveSrc] = useState<string | null>(
    () => variant?.image || product.image || null,
  );
  const currentSrc =
    activeSrc && images.includes(activeSrc) ? activeSrc : images[0];

  const markFailed = useCallback((src: string) => {
    setFailed((prev) => new Set(prev).add(src));
  }, []);

  const selectVariant = (v: Variant) => {
    setVariantId(v._id);
    if (v.image) setActiveSrc(v.image);
    const url = new URL(window.location.href);
    url.searchParams.set("variant", v._id);
    window.history.replaceState(null, "", url);
  };

  /* Values that follow the selected variant, falling back to product-level fields */
  const live = isLive(product);
  const category = getCategory(product);
  const price = hasVariants ? variant?.price : product.price;
  const compareAt = hasVariants
    ? variant?.compareAtPrice
    : product.compareAtPrice;
  const stock = hasVariants ? variant?.stock : product.stock;
  const sku = (hasVariants ? variant?.sku : product.sku) || product.sku;
  const discount = discountOf(price, compareAt);
  const availability = getAvailability(live, stock);
  const canRequest = live && availability.label !== "Out of stock";

  const quoteParams = new URLSearchParams({ product: product.slug });
  if (variant) quoteParams.set("variant", variant._id);
  const quoteHref = `/bulk-orders?${quoteParams.toString()}`;

  const specs: { label: string; value: string }[] = [
    { label: "SKU", value: sku || "-" },
    { label: "Category", value: category?.name || "-" },
    ...(variant
      ? [
          {
            label: variant.unitType || "Option",
            value: variant.label,
          },
        ]
      : []),
    { label: "Availability", value: availability.label },
    { label: "Pricing", value: price ? "Per unit," : "On request" },
  ];

  return (
    <>
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-14">
        <Gallery
          name={product.name}
          live={live}
          images={images}
          current={currentSrc}
          onSelect={setActiveSrc}
          onFail={markFailed}
        />

        <div>
          {category && (
            <p className="text-sm text-stone-500">{category.name}</p>
          )}
          <h1 className="mt-1 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
            {product.name}
          </h1>
          {sku && <p className="mt-2 text-sm text-stone-500">SKU {sku}</p>}

          {/* Price */}
          <div className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {price ? (
              <>
                <span className="text-3xl font-semibold">
                  {inr.format(price)}
                </span>
                {discount > 0 && (
                  <>
                    <span className="text-lg text-stone-400 line-through">
                      {inr.format(compareAt!)}
                    </span>
                    <span className="rounded-md bg-[#1C3516] px-2 py-0.5 text-sm font-medium text-white">
                      {discount}% off
                    </span>
                  </>
                )}
                <span className="w-full text-sm text-stone-500">per unit</span>
              </>
            ) : (
              <span className="text-xl font-medium text-stone-700">
                Price on request
              </span>
            )}
          </div>

          {/* Variants */}
          {hasVariants && variant && (
            <VariantSelector
              variants={variants}
              selectedId={variant._id}
              onSelect={selectVariant}
            />
          )}

          {/* Availability */}
          <p
            className="mt-6 flex items-center gap-2 text-sm font-medium"
            aria-live="polite"
          >
            <span
              className={`size-2 rounded-full ${toneDot[availability.tone]}`}
            />
            {availability.label}
          </p>

          {/* Actions */}
          <div className="mt-5 hidden gap-3 sm:flex">
            {canRequest ? (
              <Link
                href={quoteHref}
                className="inline-flex h-12 flex-1 items-center justify-center rounded-lg bg-[#1C3516] px-6 text-sm font-medium text-white transition-colors hover:bg-[#244620] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1C3516]"
              >
                Request bulk quote
              </Link>
            ) : (
              <button
                disabled
                className="inline-flex h-12 flex-1 cursor-not-allowed items-center justify-center rounded-lg border border-stone-300 text-sm font-medium text-stone-400"
              >
                {live ? "Currently unavailable" : "Not available yet"}
              </button>
            )}
            <Link
              href="/products"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white px-5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
            >
              <ArrowLeft className="size-4" />
              Catalog
            </Link>
          </div>

          {/* Specs */}
          <section className="mt-8">
            <h2 className="mb-3 text-sm font-semibold">Product details</h2>
            <dl className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white">
              {specs.map((row) => (
                <div
                  key={row.label}
                  className="grid grid-cols-[130px_1fr] gap-4 px-4 py-3 text-sm sm:grid-cols-[160px_1fr]"
                >
                  <dt className="text-stone-500">{row.label}</dt>
                  <dd className="font-medium text-stone-800">{row.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </div>

      {/* Description: full width below, so long content reads comfortably */}
      {product.description && (
        <section className="mt-12 max-w-3xl border-t border-stone-300/70 pt-8">
          <h2 className="mb-4 text-xl font-semibold tracking-tight">
            Description
          </h2>
          <Markdown>{product.description}</Markdown>
        </section>
      )}

      {/* Sticky mobile action bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/95 px-4 py-3 backdrop-blur sm:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs text-stone-500">
              {product.name}
              {variant ? ` · ${variant.label}` : ""}
            </p>
            <p className="text-base font-semibold">
              {price ? inr.format(price) : "Price on request"}
            </p>
          </div>
          {canRequest ? (
            <Link
              href={quoteHref}
              className="ml-auto inline-flex h-11 shrink-0 items-center justify-center rounded-lg bg-[#1C3516] px-5 text-sm font-medium text-white"
            >
              Request quote
            </Link>
          ) : (
            <button
              disabled
              className="ml-auto h-11 shrink-0 rounded-lg border border-stone-300 px-5 text-sm font-medium text-stone-400"
            >
              Unavailable
            </button>
          )}
        </div>
      </div>
    </>
  );
}

/* ---------- Variant selector ---------- */

function VariantSelector({
  variants,
  selectedId,
  onSelect,
}: {
  variants: Variant[];
  selectedId: string;
  onSelect: (v: Variant) => void;
}) {
  const selected = variants.find((v) => v._id === selectedId);
  const types = Array.from(
    new Set(variants.map((v) => v.unitType).filter(Boolean)),
  );
  const heading = types.length === 1 ? types[0]! : "Option";
  const pricesDiffer = new Set(variants.map((v) => v.price)).size > 1;

  // A single option needs no choice, so it is shown as plain text
  if (variants.length === 1) {
    return (
      <p className="mt-6 text-sm text-stone-600">
        {heading}:{" "}
        <span className="font-medium text-stone-900">{variants[0].label}</span>
      </p>
    );
  }

  return (
    <div className="mt-6">
      <p className="mb-2.5 text-sm text-stone-600">
        {heading}:{" "}
        <span className="font-medium text-stone-900">{selected?.label}</span>
      </p>
      <div
        role="group"
        aria-label={`Select ${heading.toLowerCase()}`}
        className="flex flex-wrap gap-2"
      >
        {variants.map((v) => {
          const active = v._id === selectedId;
          const soldOut = v.stock !== undefined && v.stock <= 0;
          return (
            <button
              key={v._id}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(v)}
              className={`min-w-24 cursor-pointer rounded-lg border px-4 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1C3516] ${
                active
                  ? "border-[#1C3516] bg-[#1C3516]/5 ring-1 ring-[#1C3516]"
                  : "border-stone-300 bg-white hover:border-stone-500"
              } ${soldOut ? "opacity-60" : ""}`}
            >
              <span className="block text-sm font-medium text-stone-900">
                {v.label}
              </span>
              {(pricesDiffer || soldOut) && (
                <span className="mt-0.5 block text-xs text-stone-500">
                  {soldOut ? "Out of stock" : inr.format(v.price)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Gallery ---------- */

function Gallery({
  name,
  live,
  images,
  current,
  onSelect,
  onFail,
}: {
  name: string;
  live: boolean;
  images: string[];
  current?: string;
  onSelect: (src: string) => void;
  onFail: (src: string) => void;
}) {
  return (
    <div className="lg:sticky lg:top-24 lg:self-start">
      <div className="relative aspect-square overflow-hidden rounded-xl border border-stone-200 bg-white">
        {current ? (
          <Image
            key={current}
            src={current}
            alt={name}
            fill
            priority
            sizes="(min-width: 1024px) 45vw, 100vw"
            onError={() => onFail(current)}
            className={`object-contain p-6 mix-blend-multiply sm:p-10 ${
              live ? "" : "grayscale-[40%]"
            }`}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-stone-400">
            <ImageOff className="size-8" />
            <span className="text-sm">No image available</span>
          </div>
        )}
        {!live && (
          <span className="absolute left-3 top-3 rounded-md bg-white/95 px-2.5 py-1 text-xs font-medium text-stone-700">
            Coming soon
          </span>
        )}
      </div>

      {images.length > 1 && (
        <ul
          className="mt-3 grid grid-cols-5 gap-2 sm:gap-3"
          aria-label="Product images"
        >
          {images.map((src, i) => {
            const selected = src === current;
            return (
              <li key={src}>
                <button
                  type="button"
                  onClick={() => onSelect(src)}
                  aria-label={`Show image ${i + 1}`}
                  aria-current={selected}
                  className={`relative block aspect-square w-full cursor-pointer overflow-hidden rounded-lg bg-white transition-shadow ${
                    selected
                      ? "ring-2 ring-[#1C3516]"
                      : "ring-1 ring-stone-200 hover:ring-stone-400"
                  }`}
                >
                  <Image
                    src={src}
                    alt=""
                    fill
                    sizes="100px"
                    className="object-contain p-1.5 mix-blend-multiply"
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ---------- Related card ---------- */

function RelatedCard({ product }: { product: Product }) {
  const [failed, setFailed] = useState(false);
  const src = product.image || product.gallery?.[0];

  return (
    <Link href={`/products/${product.slug}`} className="group block">
      <div className="relative aspect-square overflow-hidden rounded-lg border border-stone-200 bg-white">
        {src && !failed ? (
          <Image
            src={src}
            alt={product.name}
            fill
            sizes="(min-width: 1024px) 22vw, 45vw"
            onError={() => setFailed(true)}
            className="object-contain p-4 mix-blend-multiply"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-stone-400">
            <ImageOff className="size-6" />
          </div>
        )}
      </div>
      <h3 className="mt-3 text-sm font-medium leading-snug group-hover:underline sm:text-[15px]">
        {product.name}
      </h3>
      <p className="mt-1 text-sm text-stone-600">{priceLabel(product)}</p>
    </Link>
  );
}

/* ---------- States ---------- */

function DetailSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading product"
      className="animate-pulse motion-reduce:animate-none"
    >
      <div className="mb-6 h-4 w-56 rounded bg-[#E4E8DC]" />
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-14">
        <div>
          <div className="aspect-square rounded-xl border border-stone-200 bg-stone-100" />
          <div className="mt-3 grid grid-cols-5 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-lg bg-[#E4E8DC]" />
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div className="h-4 w-32 rounded bg-[#E4E8DC]" />
          <div className="h-9 w-3/4 rounded bg-[#E4E8DC]" />
          <div className="h-10 w-40 rounded bg-[#E4E8DC]" />
          <div className="h-12 w-2/3 rounded-lg bg-[#E4E8DC]" />
          <div className="h-12 rounded-lg bg-[#E4E8DC]" />
          <div className="h-24 rounded bg-[#E4E8DC]" />
        </div>
      </div>
    </div>
  );
}

function Message({
  title,
  body,
  actionLabel,
  actionHref,
  onAction,
}: {
  title: string;
  body: string;
  actionLabel: string;
  actionHref?: string;
  onAction?: () => void;
}) {
  const cls =
    "mt-5 inline-flex h-10 cursor-pointer items-center justify-center rounded-lg bg-[#1C3516] px-5 text-sm font-medium text-white transition-colors hover:bg-[#244620]";
  return (
    <div className="mx-auto mt-10 max-w-lg rounded-xl border border-dashed border-stone-300 px-6 py-16 text-center">
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="mt-1 text-sm text-stone-600">{body}</p>
      {actionHref ? (
        <Link href={actionHref} className={cls}>
          {actionLabel}
        </Link>
      ) : (
        <button onClick={onAction} className={cls}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
