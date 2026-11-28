/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { hasPermission } from "@/lib/iam";
import Category from "@/models/Category";
import Product from "@/models/Product";
import BulkOrder from "@/models/BulkOrder";
import Contact from "@/models/Contact";
import AdminUser from "@/models/AdminUser";
import AuditLog from "@/models/AuditLog";

export async function GET() {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please sign in." },
        { status: 401 },
      );
    }

    await connectDB();

    const canReadUsers = hasPermission(sessionUser.permissions, "users:read");
    const canReadAudit = hasPermission(sessionUser.permissions, "audit:read");

    const [
      totalCategories,
      totalProducts,
      totalBulkOrders,
      contactInquiries,
      productsPerCategory,
      userStats,
      recentAuditLogs,
    ] = await Promise.all([
      Category.countDocuments(),
      Product.countDocuments(),
      BulkOrder.countDocuments().catch(() => 0),
      Contact.countDocuments().catch(() => 0),
      Product.aggregate([
        {
          $group: {
            _id: "$category",
            count: { $sum: 1 },
          },
        },
        {
          $lookup: {
            from: "categories",
            localField: "_id",
            foreignField: "_id",
            as: "categoryInfo",
          },
        },
        {
          $unwind: "$categoryInfo",
        },
        {
          $project: {
            _id: 0,
            categoryId: { $toString: "$_id" },
            categoryName: "$categoryInfo.name",
            categorySlug: "$categoryInfo.slug",
            count: 1,
          },
        },
        { $sort: { count: -1 } },
      ]),
      canReadUsers
        ? Promise.all([
            AdminUser.countDocuments(),
            AdminUser.countDocuments({ isActive: true }),
            AdminUser.find()
              .sort({ lastLoginAt: -1, createdAt: -1 })
              .limit(5)
              .select("name email role isActive lastLoginAt")
              .lean(),
          ])
        : Promise.resolve([null, null, []]),
      canReadAudit
        ? AuditLog.find()
            .sort({ createdAt: -1 })
            .limit(6)
            .select("actorName actorEmail actorRole action outcome targetLabel createdAt")
            .lean()
        : Promise.resolve([]),
    ]);

    const [totalAdminUsers, activeAdminUsers, recentAdminUsers] = userStats as [
      number | null,
      number | null,
      any[],
    ];

    return NextResponse.json({
      success: true,
      user: {
        id: sessionUser.id,
        name: sessionUser.name,
        email: sessionUser.email,
        role: sessionUser.role,
        permissions: sessionUser.permissions,
      },
      data: {
        totalCategories,
        totalProducts,
        totalBulkOrders,
        contact_inquries: contactInquiries,
        productsPerCategory,
        users: canReadUsers
          ? {
              total: totalAdminUsers ?? 0,
              active: activeAdminUsers ?? 0,
              recent: recentAdminUsers.map((u) => ({
                id: String(u._id),
                name: u.name,
                email: u.email,
                role: u.role,
                isActive: u.isActive,
                lastLoginAt: u.lastLoginAt ?? null,
              })),
            }
          : null,
        recentActivity: canReadAudit
          ? recentAuditLogs.map((log) => ({
              id: String(log._id),
              actorName: log.actorName,
              actorEmail: log.actorEmail,
              actorRole: log.actorRole,
              action: log.action,
              outcome: log.outcome,
              targetLabel: log.targetLabel ?? null,
              createdAt: log.createdAt,
            }))
          : null,
      },
    });
  } catch (error: any) {
    console.error("Dashboard Stats Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch stats" },
      { status: 500 },
    );
  }
}