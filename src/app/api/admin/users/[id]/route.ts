import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import AdminUser from "@/models/AdminUser";
import { hashPassword, requirePermission } from "@/lib/auth";
import {
  getEffectivePermissions,
  hasPermission,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  ROLES,
  type AdminRole,
  type Permission,
} from "@/lib/iam";
import connectDB from "@/lib/db";

const ALLOWED_ROLES = new Set<string>(ROLES);
const VALID_PERMISSIONS = new Set<string>(PERMISSIONS);

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requirePermission("users:read");
    if (!auth.ok) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status },
      );
    }

    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: "Invalid user ID" },
        { status: 400 },
      );
    }

    await connectDB();
    const target = await AdminUser.findById(id).select("-passwordHash").lean();
    if (!target) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 },
      );
    }

    const extraPermissions = (target.extraPermissions ?? []) as Permission[];

    return NextResponse.json({
      success: true,
      user: {
        id: String(target._id),
        name: target.name,
        email: target.email,
        role: target.role,
        extraPermissions,
        permissions: getEffectivePermissions(target.role, extraPermissions),
        isActive: target.isActive,
        lastLoginAt: target.lastLoginAt ?? null,
        createdAt: target.createdAt,
        updatedAt: target.updatedAt,
      },
    });
  } catch (err) {
    console.error("Get admin user error:", err);
    return NextResponse.json(
      { success: false, message: "Failed to fetch user" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requirePermission("users:manage");
    if (!auth.ok) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status },
      );
    }

    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: "Invalid user ID" },
        { status: 400 },
      );
    }

    const body = await req.json();

    await connectDB();
    const target = await AdminUser.findById(id).select("+passwordHash");
    if (!target) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 },
      );
    }

    const canManageRoles =
      auth.user.role === "superadmin" ||
      hasPermission(auth.user.permissions, "roles:manage");

    if (typeof body?.name === "string" && body.name.trim()) {
      target.name = body.name.trim();
    }

    if (typeof body?.role === "string") {
      if (!ALLOWED_ROLES.has(body.role)) {
        return NextResponse.json(
          { success: false, message: "Invalid role specified" },
          { status: 400 },
        );
      }
      if (body.role === "superadmin" && !canManageRoles) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Missing roles:manage permission to assign superadmin role",
          },
          { status: 403 },
        );
      }
      target.role = body.role as AdminRole;
    }

    const incomingPerms: unknown[] | null = Array.isArray(
      body?.extraPermissions,
    )
      ? body.extraPermissions
      : Array.isArray(body?.permissions)
        ? body.permissions
        : null;

    if (incomingPerms !== null) {
      if (target.role === "superadmin") {
        target.extraPermissions = [];
      } else {
        const baseRoleSet = new Set<string>(
          ROLE_PERMISSIONS[target.role as AdminRole] ?? [],
        );

        const cleanExtras = Array.from(
          new Set<Permission>(
            incomingPerms.filter(
              (p): p is Permission =>
                typeof p === "string" &&
                VALID_PERMISSIONS.has(p) &&
                !baseRoleSet.has(p),
            ),
          ),
        );

        const nextEffective = getEffectivePermissions(target.role, cleanExtras);
        if (nextEffective.includes("roles:manage") && !canManageRoles) {
          return NextResponse.json(
            {
              success: false,
              message: "Missing roles:manage permission to grant roles:manage",
            },
            { status: 403 },
          );
        }

        target.extraPermissions = cleanExtras;
      }
    } else if (target.role === "superadmin") {
      target.extraPermissions = [];
    }

    if (typeof body?.isActive === "boolean") {
      if (String(target._id) === auth.user.id && body.isActive === false) {
        return NextResponse.json(
          { success: false, message: "You cannot deactivate your own account" },
          { status: 400 },
        );
      }
      target.isActive = body.isActive;
    }

    if (typeof body?.password === "string" && body.password.length > 0) {
      if (body.password.length < 8) {
        return NextResponse.json(
          {
            success: false,
            message: "New password must be at least 8 characters",
          },
          { status: 400 },
        );
      }
      target.passwordHash = hashPassword(body.password);
    }

    await target.save();

    const extraPermissions = (target.extraPermissions ?? []) as Permission[];

    return NextResponse.json({
      success: true,
      user: {
        id: String(target._id),
        name: target.name,
        email: target.email,
        role: target.role,
        extraPermissions,
        permissions: getEffectivePermissions(target.role, extraPermissions),
        isActive: target.isActive,
        lastLoginAt: target.lastLoginAt ?? null,
        updatedAt: target.updatedAt,
      },
    });
  } catch (err) {
    console.error("Update admin user error:", err);
    return NextResponse.json(
      { success: false, message: "Failed to update user" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requirePermission("users:manage");
    if (!auth.ok) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: 401 },
      );
    }

    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: "Invalid user ID" },
        { status: 400 },
      );
    }

    if (id === auth.user.id) {
      return NextResponse.json(
        { success: false, message: "You cannot delete your own account" },
        { status: 400 },
      );
    }

    await connectDB();
    const deleted = await AdminUser.findByIdAndDelete(id).lean();
    if (!deleted) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "User deleted",
    });
  } catch (err) {
    console.error("Delete admin user error:", err);
    return NextResponse.json(
      { success: false, message: "Failed to delete user" },
      { status: 500 },
    );
  }
}
