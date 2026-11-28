/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import Product from "@/models/Product";
import "@/models/Category";
import { requirePermission } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function buildProductSnapshot(product: any) {
  return {
    name: product.name ?? null,
    sku: product.sku ?? null,
    category: product.category ? String(product.category) : null,
    price: product.price ?? null,
    stock: product.stock ?? null,
    variantCount: Array.isArray(product.variants) ? product.variants.length : 0,
    isActive: product.isActive ?? null,
  };
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  let actorForError:
    | { id: string; name: string; email: string; role: string }
    | undefined;
  let targetIdForError: string | null = null;

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
    const { id } = await params;
    targetIdForError = id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid product ID" },
        { status: 400 },
      );
    }

    const existingProduct = await Product.findById(id).lean();
    if (!existingProduct) {
      return NextResponse.json(
        { success: false, error: "Product not found" },
        { status: 404 },
      );
    }

    const beforeSnapshot = buildProductSnapshot(existingProduct);

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

    await recordAuditLog({
      req,
      actor: auth.user,
      action: "product.update",
      requiredPermission: "products:write",
      outcome: "success",
      statusCode: 200,
      targetType: "Product",
      targetId: String(updatedProduct._id),
      targetLabel:
        updatedProduct.sku || updatedProduct.name || String(updatedProduct._id),
      before: beforeSnapshot,
      after: buildProductSnapshot(updatedProduct),
    });

    return NextResponse.json(
      { success: true, data: updatedProduct },
      { status: 200 },
    );
  } catch (error: any) {
    const statusCode = error?.name === "ValidationError" ? 400 : 500;
    await recordAuditLog({
      req,
      actor: actorForError,
      action: "product.update",
      requiredPermission: "products:write",
      outcome: "failure",
      statusCode,
      errorMessage: error?.message || "Failed to update product",
      targetType: "Product",
      targetId: targetIdForError,
    });

    return NextResponse.json(
      { success: false, error: error?.message || "Failed to update product" },
      { status: statusCode },
    );
  }
}

// DELETE: Remove product
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  let actorForError:
    | { id: string; name: string; email: string; role: string }
    | undefined;
  let targetIdForError: string | null = null;

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
    const { id } = await params;
    targetIdForError = id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid product ID" },
        { status: 400 },
      );
    }

    const deletedProduct = await Product.findByIdAndDelete(id).lean();

    if (!deletedProduct) {
      return NextResponse.json(
        { success: false, error: "Product not found" },
        { status: 404 },
      );
    }

    await recordAuditLog({
      req,
      actor: auth.user,
      action: "product.delete",
      requiredPermission: "products:write",
      outcome: "success",
      statusCode: 200,
      targetType: "Product",
      targetId: String(deletedProduct._id),
      targetLabel:
        deletedProduct.sku ||
        deletedProduct.name ||
        String(deletedProduct._id),
      before: buildProductSnapshot(deletedProduct),
      after: null,
    });

    return NextResponse.json(
      { success: true, message: "Product deleted successfully" },
      { status: 200 },
    );
  } catch (error: any) {
    await recordAuditLog({
      req,
      actor: actorForError,
      action: "product.delete",
      requiredPermission: "products:write",
      outcome: "failure",
      statusCode: 500,
      errorMessage: error?.message || "Failed to delete product",
      targetType: "Product",
      targetId: targetIdForError,
    });

    return NextResponse.json(
      { success: false, error: error?.message || "Failed to delete product" },
      { status: 500 },
    );
  }
}