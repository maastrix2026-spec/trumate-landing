import { NextRequest, NextResponse } from "next/server";
import AdminUser from "@/models/AdminUser";
import {
  createSessionToken,
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
  verifyPassword,
} from "@/lib/auth";
import { getEffectivePermissions } from "@/lib/iam";
import { recordAuditLog } from "@/lib/audit";
import connectDB from "@/lib/db";

export async function POST(req: NextRequest) {
  let attemptedEmail = "unknown@trumategroup.com";

  try {
    const body = await req.json();
    const email =
      typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    if (email) {
      attemptedEmail = email;
    }

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: "Email and password are required" },
        { status: 400 },
      );
    }

    await connectDB();

    const user = await AdminUser.findOne({ email }).select("+passwordHash");
    if (
      !user ||
      !user.passwordHash ||
      !verifyPassword(password, user.passwordHash)
    ) {
      await recordAuditLog({
        req,
        actor: {
          id: user ? String(user._id) : null,
          email,
          name: user?.name || email,
          role: user?.role || "unknown",
        },
        action: "auth.login",
        outcome: "failure",
        statusCode: 401,
        errorMessage: "Invalid email or password",
        targetType: "Session",
        targetId: user ? String(user._id) : null,
        targetLabel: email,
      });

      return NextResponse.json(
        { success: false, message: "Invalid email or password" },
        { status: 401 },
      );
    }

    if (!user.isActive) {
      await recordAuditLog({
        req,
        actor: {
          id: String(user._id),
          email: user.email,
          name: user.name,
          role: user.role,
        },
        action: "auth.login",
        outcome: "denied",
        statusCode: 403,
        errorMessage: "Account is disabled",
        targetType: "Session",
        targetId: String(user._id),
        targetLabel: user.email,
      });

      return NextResponse.json(
        {
          success: false,
          message: "Account is disabled. Contact an administrator.",
        },
        { status: 403 },
      );
    }

    user.lastLoginAt = new Date();
    await user.save();

    const effectivePermissions = getEffectivePermissions(
      user.role,
      user.extraPermissions ?? [],
    );

    await recordAuditLog({
      req,
      actor: {
        id: String(user._id),
        email: user.email,
        name: user.name,
        role: user.role,
      },
      action: "auth.login",
      outcome: "success",
      statusCode: 200,
      targetType: "Session",
      targetId: String(user._id),
      targetLabel: user.email,
      after: {
        lastLoginAt: user.lastLoginAt,
        role: user.role,
      },
    });

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
    await recordAuditLog({
      req,
      actor: {
        id: null,
        email: attemptedEmail,
        name: attemptedEmail,
        role: "unknown",
      },
      action: "auth.login",
      outcome: "failure",
      statusCode: 500,
      errorMessage: err instanceof Error ? err.message : "Unable to process login",
      targetType: "Session",
      targetLabel: attemptedEmail,
    });

    return NextResponse.json(
      { success: false, message: "Unable to process login" },
      { status: 500 },
    );
  }
}