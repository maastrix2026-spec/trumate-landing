import { NextRequest, NextResponse } from "next/server";
import AdminUser from "@/models/AdminUser";
import { hashPassword, requirePermission } from "@/lib/auth";
import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  ROLES,
  getEffectivePermissions,
  hasPermission,
  type AdminRole,
  type Permission,
} from "@/lib/iam";
import connectDB from "@/lib/db";

const ALLOWED_ROLES = new Set<string>(ROLES);
const VALID_PERMISSIONS = new Set<string>(PERMISSIONS);

export async function GET() {
  try {
    const auth = await requirePermission("users:read");
    if (!auth.ok) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status },
      );
    }

    await connectDB();
    const users = await AdminUser.find({})
      .select("-passwordHash")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      users: users.map((u) => {
        const extraPermissions = (u.extraPermissions ?? []) as Permission[];
        return {
          id: String(u._id),
          name: u.name,
          email: u.email,
          role: u.role,
          extraPermissions,
          permissions: getEffectivePermissions(u.role, extraPermissions),
          isActive: u.isActive,
          lastLoginAt: u.lastLoginAt ?? null,
          createdAt: u.createdAt,
        };
      }),
    });
  } catch (err) {
    console.error("List admin users error:", err);
    return NextResponse.json(
      { success: false, message: "Failed to load admin users" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission("users:manage");
    if (!auth.ok) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status },
      );
    }

    const body = await req.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const email =
      typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const role = typeof body?.role === "string" ? body.role : "viewer";
    const isActive = typeof body?.isActive === "boolean" ? body.isActive : true;

    if (!name || !email || password.length < 8) {
      return NextResponse.json(
        {
          success: false,
          message: "Name, valid email, and password (min 8 chars) are required",
        },
        { status: 400 },
      );
    }

    if (!ALLOWED_ROLES.has(role)) {
      return NextResponse.json(
        { success: false, message: "Invalid role specified" },
        { status: 400 },
      );
    }

    const canManageRoles =
      auth.user.role === "superadmin" ||
      hasPermission(auth.user.permissions, "roles:manage");

    if (role === "superadmin" && !canManageRoles) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing roles:manage permission to assign superadmin role",
        },
        { status: 403 },
      );
    }

    const rawExtras: unknown = Array.isArray(body?.extraPermissions)
      ? body.extraPermissions
      : Array.isArray(body?.permissions)
        ? body.permissions
        : [];

    const baseRoleSet = new Set<string>(
      ROLE_PERMISSIONS[role as AdminRole] ?? [],
    );

    // Superadmin already includes all permissions; store empty extraPermissions
    const extraPermissions: Permission[] =
      role === "superadmin"
        ? []
        : Array.from(
            new Set<Permission>(
              (rawExtras as unknown[]).filter(
                (p): p is Permission =>
                  typeof p === "string" &&
                  VALID_PERMISSIONS.has(p) &&
                  !baseRoleSet.has(p),
              ),
            ),
          );

    const effectivePermissions = getEffectivePermissions(role, extraPermissions);

    if (effectivePermissions.includes("roles:manage") && !canManageRoles) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing roles:manage permission to grant roles:manage",
        },
        { status: 403 },
      );
    }

    await connectDB();

    const existing = await AdminUser.findOne({ email }).lean();
    if (existing) {
      return NextResponse.json(
        { success: false, message: "A user with this email already exists" },
        { status: 409 },
      );
    }

    const created = await AdminUser.create({
      name,
      email,
      passwordHash: hashPassword(password),
      role: role as AdminRole,
      extraPermissions,
      isActive,
    });

    return NextResponse.json(
      {
        success: true,
        user: {
          id: String(created._id),
          name: created.name,
          email: created.email,
          role: created.role,
          extraPermissions: created.extraPermissions,
          permissions: effectivePermissions,
          isActive: created.isActive,
          createdAt: created.createdAt,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("Create admin user error:", err);
    return NextResponse.json(
      { success: false, message: "Failed to create admin user" },
      { status: 500 },
    );
  }
}