import type { Metadata } from "next";
import ProductModel from "@/models/Product";
import CategoryModel from "@/models/Category";
import ProductDetailClient from "./ProductDetailClient";
import connectDB from "@/lib/db";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.trumategroup.com";

async function loadProduct(slug: string) {
  await connectDB();
  void CategoryModel;
  const doc = await ProductModel.findOne({ slug: decodeURIComponent(slug) })
    .populate("category", "name slug")
    .lean();
  return doc ? JSON.parse(JSON.stringify(doc)) : null;
}


export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await loadProduct(slug);

  if (!product) {
    return { title: "Product Not Found" };
  }

  const plainText = (product.description || "")
    .replace(/[#*_`>-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const description = plainText
    ? `${plainText.slice(0, 145)} — Trumate Bhubaneswar.`
    : `${product.name} available in Bhubaneswar, Odisha from Trumate.`;

  const image = product.image || product.gallery?.[0] || "/og-image.jpg";
  const urlPath = `/products/${encodeURIComponent(product.slug)}`;

  return {
    title: product.name,
    description,
    alternates: { canonical: urlPath },
    openGraph: {
      title: product.name,
      description,
      url: `${SITE_URL}${urlPath}`,
      images: [{ url: image, alt: product.name }],
    },
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await loadProduct(slug);

  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const variantPrices = variants
    .map((v: { price?: number }) => v.price)
    .filter((n: unknown): n is number => typeof n === "number" && n > 0);
  const price = variantPrices.length > 0 ? Math.min(...variantPrices) : product?.price;

  const jsonLd = product
    ? {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.name,
        image: product.image ? [product.image] : undefined,
        sku: variants[0]?.sku || product.sku || undefined,
        ...(price
          ? {
              offers: {
                "@type": "Offer",
                priceCurrency: "INR",
                price,
                availability: "https://schema.org/InStock",
              },
            }
          : {}),
      }
    : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
          }}
        />
      )}
      <ProductDetailClient />
    </>
  );
}