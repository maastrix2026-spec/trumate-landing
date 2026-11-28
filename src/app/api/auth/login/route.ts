import { NextRequest, NextResponse } from "next/server";
import AdminUser from "@/models/AdminUser";
import {
  SESSION_COOKIE_NAME,
  createSessionToken,
  getSessionCookieOptions,
  verifyPassword,
} from "@/lib/auth";
import { getEffectivePermissions } from "@/lib/iam";
import connectDB from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: "Email and password are required" },
        { status: 400 }
      );
    }

    await connectDB();

    const user = await AdminUser.findOne({ email }).select("+passwordHash");
    if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json(
        { success: false, message: "Invalid email or password" },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { success: false, message: "Account is disabled. Contact an administrator." },
        { status: 403 }
      );
    }

    user.lastLoginAt = new Date();
    await user.save();

    const effectivePermissions = getEffectivePermissions(
      user.role,
      user.extraPermissions ?? []
    );

    const token = createSessionToken(String(user._id));
    const res = NextResponse.json({
      success: true,
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        role: user.role,
        extraPermissions: user.extraPermissions ?? [],
        permissions: effectivePermissions,
      },
    });

    res.cookies.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions());
    return res;
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json(
      { success: false, message: "Unable to process login" },
      { status: 500 }
    );
  }
}