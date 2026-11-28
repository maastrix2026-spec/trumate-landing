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
import { recordAuditLog } from "@/lib/audit";

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
  let actorForError:
    | { id: string; name: string; email: string; role: string }
    | undefined;
  let targetIdForError: string | null = null;

  try {
    const auth = await requirePermission("users:manage");
    if (!auth.ok) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status },
      );
    }
    actorForError = auth.user;

    const { id } = await context.params;
    targetIdForError = id;
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

    // 1. Capture original state before any mutations
    const beforeSnapshot = {
      name: target.name,
      role: target.role,
      extraPermissions: [...((target.extraPermissions ?? []) as string[])],
      isActive: target.isActive,
    };

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
        await recordAuditLog({
          req,
          actor: auth.user,
          action: "admin_user.update",
          requiredPermission: "roles:manage",
          outcome: "denied",
          statusCode: 403,
          errorMessage:
            "Missing roles:manage permission to assign superadmin role",
          targetType: "AdminUser",
          targetId: String(target._id),
          targetLabel: target.email,
          before: beforeSnapshot,
          after: { attemptedRole: body.role },
        });
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

    const baseRoleSet = new Set<string>(
      ROLE_PERMISSIONS[target.role as AdminRole] ?? [],
    );

    if (target.role === "superadmin") {
      target.extraPermissions = [];
    } else if (incomingPerms !== null) {
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
        await recordAuditLog({
          req,
          actor: auth.user,
          action: "admin_user.update",
          requiredPermission: "roles:manage",
          outcome: "denied",
          statusCode: 403,
          errorMessage: "Missing roles:manage permission to grant roles:manage",
          targetType: "AdminUser",
          targetId: String(target._id),
          targetLabel: target.email,
          before: beforeSnapshot,
          after: { attemptedExtraPermissions: cleanExtras },
        });
        return NextResponse.json(
          {
            success: false,
            message: "Missing roles:manage permission to grant roles:manage",
          },
          { status: 403 },
        );
      }

      target.extraPermissions = cleanExtras;
    } else {
      // Role may have changed without explicit permissions payload: prune duplicates
      target.extraPermissions = (
        (target.extraPermissions ?? []) as Permission[]
      ).filter((p) => !baseRoleSet.has(p));
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

    const passwordRotated =
      typeof body?.password === "string" && body.password.length > 0;
    if (passwordRotated) {
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

    const afterSnapshot = {
      name: target.name,
      role: target.role,
      extraPermissions: [...extraPermissions],
      isActive: target.isActive,
      passwordRotated,
    };

    await recordAuditLog({
      req,
      actor: auth.user,
      action: "admin_user.update",
      requiredPermission: "users:manage",
      outcome: "success",
      statusCode: 200,
      targetType: "AdminUser",
      targetId: String(target._id),
      targetLabel: target.email,
      before: beforeSnapshot,
      after: afterSnapshot,
    });

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
    await recordAuditLog({
      req,
      actor: actorForError,
      action: "admin_user.update",
      requiredPermission: "users:manage",
      outcome: "failure",
      statusCode: 500,
      errorMessage:
        err instanceof Error ? err.message : "Failed to update user",
      targetType: "AdminUser",
      targetId: targetIdForError,
    });
    return NextResponse.json(
      { success: false, message: "Failed to update user" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  let actorForError:
    | { id: string; name: string; email: string; role: string }
    | undefined;
  let targetIdForError: string | null = null;

  try {
    const auth = await requirePermission("users:manage");
    if (!auth.ok) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status },
      );
    }
    actorForError = auth.user;

    const { id } = await context.params;
    targetIdForError = id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: "Invalid user ID" },
        { status: 400 },
      );
    }

    if (id === auth.user.id) {
      await recordAuditLog({
        req,
        actor: auth.user,
        action: "admin_user.soft_delete",
        requiredPermission: "users:manage",
        outcome: "denied",
        statusCode: 400,
        errorMessage: "Attempted to delete own account",
        targetType: "AdminUser",
        targetId: id,
        targetLabel: auth.user.email,
      });
      return NextResponse.json(
        { success: false, message: "You cannot delete your own account" },
        { status: 400 },
      );
    }

    await connectDB();
    const target = await AdminUser.findById(id);
    if (!target) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 },
      );
    }

    const canManageRoles =
      auth.user.role === "superadmin" ||
      hasPermission(auth.user.permissions, "roles:manage");

    if (target.role === "superadmin" && !canManageRoles) {
      await recordAuditLog({
        req,
        actor: auth.user,
        action: "admin_user.soft_delete",
        requiredPermission: "roles:manage",
        outcome: "denied",
        statusCode: 403,
        errorMessage:
          "Missing roles:manage permission to delete superadmin account",
        targetType: "AdminUser",
        targetId: String(target._id),
        targetLabel: target.email,
        before: {
          name: target.name,
          role: target.role,
          extraPermissions: [...((target.extraPermissions ?? []) as string[])],
          isActive: target.isActive,
        },
      });
      return NextResponse.json(
        {
          success: false,
          message:
            "Missing roles:manage permission to remove a superadmin account",
        },
        { status: 403 },
      );
    }

    const beforeSnapshot = {
      name: target.name,
      role: target.role,
      extraPermissions: [...((target.extraPermissions ?? []) as string[])],
      isActive: target.isActive,
    };

    target.isActive = false;
    await target.save();

    const afterSnapshot = {
      name: target.name,
      role: target.role,
      extraPermissions: [...((target.extraPermissions ?? []) as string[])],
      isActive: target.isActive,
    };

    await recordAuditLog({
      req,
      actor: auth.user,
      action: "admin_user.soft_delete",
      requiredPermission: "users:manage",
      outcome: "success",
      statusCode: 200,
      targetType: "AdminUser",
      targetId: String(target._id),
      targetLabel: target.email,
      before: beforeSnapshot,
      after: afterSnapshot,
    });

    return NextResponse.json({
      success: true,
      message: "User deactivated (soft deleted)",
      user: {
        id: String(target._id),
        name: target.name,
        email: target.email,
        role: target.role,
        isActive: target.isActive,
      },
    });
  } catch (err) {
    console.error("Soft delete admin user error:", err);
    await recordAuditLog({
      req,
      actor: actorForError,
      action: "admin_user.soft_delete",
      requiredPermission: "users:manage",
      outcome: "failure",
      statusCode: 500,
      errorMessage:
        err instanceof Error ? err.message : "Failed to delete user",
      targetType: "AdminUser",
      targetId: targetIdForError,
    });
    return NextResponse.json(
      { success: false, message: "Failed to delete user" },
      { status: 500 },
    );
  }
}
