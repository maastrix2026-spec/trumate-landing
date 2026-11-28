/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Product from "@/models/Product";
import "@/models/Category"; // Ensures the Category model is registered for populate()
import { recordAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth";

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
export async function POST(req: NextRequest) {
  let actorForError:
    | { id: string; name: string; email: string; role: string }
    | undefined;
  let targetLabelForError: string | null = null;

  try {
    const auth = await requirePermission("products:write");
    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status },
      );
    }
    actorForError = auth.user;

    await connectDB();
    const body = await req.json();

    const productName =
      typeof body?.name === "string" ? body.name.trim() : null;
    const productSku =
      typeof body?.sku === "string" && body.sku.trim()
        ? body.sku.trim()
        : null;
    targetLabelForError = productSku || productName;

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

    // Sync base price (lowest variant) & total stock when variants exist
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
      sku: productSku || undefined,
      image: body.image.trim(),
      gallery,
      variants,
    });

    await recordAuditLog({
      req,
      actor: auth.user,
      action: "product.create",
      requiredPermission: "products:write",
      outcome: "success",
      statusCode: 201,
      targetType: "Product",
      targetId: String(product._id),
      targetLabel: product.sku || product.name || String(product._id),
      before: null,
      after: {
        name: product.name,
        sku: product.sku ?? null,
        price: product.price,
        stock: product.stock,
        variantCount: variants.length,
        isActive: product.isActive,
      },
    });

    return NextResponse.json({ success: true, data: product }, { status: 201 });
  } catch (error: any) {
    const statusCode = error?.name === "ValidationError" ? 400 : 500;
    await recordAuditLog({
      req,
      actor: actorForError,
      action: "product.create",
      requiredPermission: "products:write",
      outcome: "failure",
      statusCode,
      errorMessage: error?.message || "Failed to create product",
      targetType: "Product",
      targetLabel: targetLabelForError,
    });

    return NextResponse.json(
      { success: false, error: error?.message || "Failed to create product" },
      { status: statusCode },
    );
  }
}
