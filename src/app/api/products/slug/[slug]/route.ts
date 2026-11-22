/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Product from "@/models/Product";
import "@/models/Category"; // makes sure the Category model is registered for populate()

interface RouteParams {
    params: Promise<{ slug: string }>;
}

// GET: Fetch a single product by slug, plus related products from the same category
export async function GET(_req: Request, { params }: RouteParams) {
    try {
        await connectDB();
        const { slug } = await params;

        const product: any = await Product.findOne({ slug: slug.toLowerCase() })
            .populate("category", "name slug")
            .lean();

        if (!product) {
            return NextResponse.json(
                { success: false, error: "Product not found" },
                { status: 404 }
            );
        }

        const related = await Product.find({
            _id: { $ne: product._id },
            category: product.category?._id ?? product.category,
            status: "Published",
        })
            .sort({ isFeatured: -1, createdAt: -1 })
            .limit(4)
            .populate("category", "name slug")
            .lean();

        return NextResponse.json(
            { success: true, data: product, related },
            { status: 200 }
        );
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}