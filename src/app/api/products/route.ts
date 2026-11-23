/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Product from "@/models/Product";
import "@/models/Category"; // Ensures the Category model is registered for populate()

// GET: Fetch all products with populated category information
export async function GET(req: Request) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get("category");

    const query = categoryId ? { category: categoryId } : {};

    const products = await Product.find(query)
      .populate("category", "name slug")
      .sort({ createdAt: -1 });

    return NextResponse.json(
      { success: true, data: products },
      { status: 200 },
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

// POST: Create a new product
export async function POST(req: Request) {
  try {
    await connectDB();
    const body = await req.json();

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const isValidUrl = (val: unknown): val is string =>
      typeof val === "string" &&
      val.trim().length > 0 &&
      (!cloudName ||
        val.startsWith(`https://res.cloudinary.com/${cloudName}/`));

    if (!isValidUrl(body.image)) {
      return NextResponse.json(
        { success: false, error: "Main product image URL is required" },
        { status: 400 },
      );
    }

    const gallery = Array.isArray(body.gallery)
      ? body.gallery.filter(isValidUrl)
      : [];

    const variants = Array.isArray(body.variants)
      ? body.variants
          .filter(
            (v: any) =>
              v && typeof v.label === "string" && v.label.trim().length > 0,
          )
          .map((v: any) => ({
            label: v.label.trim(),
            unitType: v.unitType?.trim() || undefined,
            price: Number(v.price),
            compareAtPrice:
              v.compareAtPrice !== undefined && v.compareAtPrice !== ""
                ? Number(v.compareAtPrice)
                : undefined,
            stock: Number(v.stock ?? 0),
            sku: v.sku?.trim() || undefined,
            image: isValidUrl(v.image) ? v.image.trim() : undefined,
          }))
      : [];

    // 2. If variants exist, sync base price (lowest variant) & total stock
    const basePrice =
      variants.length > 0
        ? Math.min(...variants.map((v: any) => v.price))
        : Number(body.price);

    const totalStock =
      variants.length > 0
        ? variants.reduce((sum: number, v: any) => sum + v.stock, 0)
        : Number(body.stock ?? 0);

    const product = await Product.create({
      ...body,
      price: basePrice,
      stock: totalStock,
      sku: body.sku?.trim() || undefined,
      image: body.image.trim(),
      gallery,
      variants,
    });

    return NextResponse.json({ success: true, data: product }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 },
    );
  }
}
