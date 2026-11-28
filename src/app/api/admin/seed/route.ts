import { NextRequest, NextResponse } from "next/server";
import AdminUser from "@/models/AdminUser";
import { hashPassword } from "@/lib/auth";
import { getEffectivePermissions } from "@/lib/iam";
import connectDB from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const existingCount = await AdminUser.countDocuments();
    if (existingCount > 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Seed already completed. Admin users already exist.",
        },
        { status: 403 },
      );
    }

    const body = await req.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const email =
      typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!name || !email || password.length < 8) {
      return NextResponse.json(
        {
          success: false,
          message: "Name, email, and password (min 8 chars) are required",
        },
        { status: 400 },
      );
    }
    
    const superadmin = await AdminUser.create({
      name,
      email,
      passwordHash: hashPassword(password),
      role: "superadmin",
      extraPermissions: [],
      isActive: true,
    });

    const effectivePermissions = getEffectivePermissions(
      superadmin.role,
      superadmin.extraPermissions ?? [],
    );

    return NextResponse.json(
      {
        success: true,
        message: "Initial superadmin created",
        user: {
          id: String(superadmin._id),
          name: superadmin.name,
          email: superadmin.email,
          role: superadmin.role,
          extraPermissions: superadmin.extraPermissions,
          permissions: effectivePermissions,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("Seed admin error:", err);
    return NextResponse.json(
      { success: false, message: "Failed to seed superadmin" },
      { status: 500 },
    );
  }
}
