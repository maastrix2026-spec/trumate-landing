/* eslint-disable @typescript-eslint/no-explicit-any */
import type { MetadataRoute } from "next";
import Product from "@/models/Product";
import Category from "@/models/Category";
import connectDB from "@/lib/db";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.trumategroup.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: new Date(), changeFrequency: "weekly", priority: 1.0 },
    { url: `${SITE_URL}/products`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/bulk-orders`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
  ];

  try {
    await connectDB();

    const [products, categories] = await Promise.all([
      Product.find({ status: { $regex: /^published$/i } })
        .select("slug updatedAt")
        .lean(),
      Category.find({ isActive: true }).select("slug updatedAt").lean(),
    ]);

    const productRoutes: MetadataRoute.Sitemap = products.map((p: any) => ({
      url: `${SITE_URL}/products/${encodeURIComponent(p.slug)}`,
      lastModified: p.updatedAt ? new Date(p.updatedAt) : new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    }));

    const categoryRoutes: MetadataRoute.Sitemap = categories.map((c: any) => ({
      url: `${SITE_URL}/products?category=${encodeURIComponent(c.slug)}`,
      lastModified: c.updatedAt ? new Date(c.updatedAt) : new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    }));

    return [...staticRoutes, ...categoryRoutes, ...productRoutes];
  } catch {
    return staticRoutes;
  }
}