/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Product from "@/models/Product";
import "@/models/Category";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(req: Request, { params }: RouteParams) {
  try {
    await connectDB();
    const { id } = await params;
    const body = await req.json();

    // Strip immutable fields if sent by the client
    const { _id, __v, createdAt, ...updateData } = body;

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const isValidUrl = (val: unknown): val is string =>
      typeof val === "string" &&
      val.trim().length > 0 &&
      (!cloudName ||
        val.startsWith(`https://res.cloudinary.com/${cloudName}/`));

    // Normalize gallery if sent
    if (Array.isArray(updateData.gallery)) {
      updateData.gallery = updateData.gallery.filter(isValidUrl);
    }

    // Normalize variants if sent
    if (Array.isArray(updateData.variants)) {
      updateData.variants = updateData.variants
        .filter(
          (v: any) =>
            v && typeof v.label === "string" && v.label.trim().length > 0,
        )
        .map((v: any) => ({
          ...(v._id ? { _id: v._id } : {}), // Preserve existing variant _id on edit
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
        }));

      // Sync base price & total stock whenever variants exist
      if (updateData.variants.length > 0) {
        updateData.price = Math.min(
          ...updateData.variants.map((v: any) => v.price),
        );
        updateData.stock = updateData.variants.reduce(
          (sum: number, v: any) => sum + v.stock,
          0,
        );
      }
    }

    // Properly unset `sku` in MongoDB if cleared to empty string
    const updateQuery: any = { ...updateData };
    if (updateData.sku === "" || updateData.sku === null) {
      delete updateQuery.sku;
      updateQuery.$unset = { sku: 1 };
    }

    const updatedProduct = await Product.findByIdAndUpdate(id, updateQuery, {
      returnDocument: "after",
      runValidators: true,
    }).populate("category", "name slug");

    if (!updatedProduct) {
      return NextResponse.json(
        { success: false, error: "Product not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { success: true, data: updatedProduct },
      { status: 200 },
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 },
    );
  }
}

// DELETE: Remove product
export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    await connectDB();
    const { id } = await params;

    const deletedProduct = await Product.findByIdAndDelete(id);

    if (!deletedProduct) {
      return NextResponse.json(
        { success: false, error: "Product not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { success: true, message: "Product deleted successfully" },
      { status: 200 },
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
