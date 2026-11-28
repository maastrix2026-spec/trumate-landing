import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import AuditLog from "@/models/AuditLog";
import { requirePermission } from "@/lib/auth";

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission("audit:read");
    if (!auth.ok) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status },
      );
    }

    await connectDB();

    const { searchParams } = req.nextUrl;
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 20));
    const q = (searchParams.get("q") || "").trim();
    const outcome = (searchParams.get("outcome") || "").trim();
    const targetType = (searchParams.get("targetType") || "").trim();
    const action = (searchParams.get("action") || "").trim();
    const from = (searchParams.get("from") || "").trim();
    const to = (searchParams.get("to") || "").trim();

    const filter: Record<string, unknown> = {};

    if (outcome && ["success", "failure", "denied"].includes(outcome)) {
      filter.outcome = outcome;
    }

    if (targetType && targetType !== "all") {
      filter.targetType = targetType;
    }

    if (action && action !== "all") {
      filter.action = action;
    }

    if (from || to) {
      const createdAt: Record<string, Date> = {};
      if (from) {
        const start = new Date(`${from}T00:00:00.000Z`);
        if (!Number.isNaN(start.getTime())) createdAt.$gte = start;
      }
      if (to) {
        const end = new Date(`${to}T23:59:59.999Z`);
        if (!Number.isNaN(end.getTime())) createdAt.$lte = end;
      }
      if (Object.keys(createdAt).length > 0) {
        filter.createdAt = createdAt;
      }
    }

    if (q) {
      const regex = new RegExp(escapeRegex(q), "i");
      filter.$or = [
        { actorName: regex },
        { actorEmail: regex },
        { action: regex },
        { targetLabel: regex },
        { targetId: regex },
        { path: regex },
        { ipAddress: regex },
      ];
    }

    const skip = (page - 1) * limit;

    const [logs, total, distinctActions, distinctTargetTypes] =
      await Promise.all([
        AuditLog.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        AuditLog.countDocuments(filter),
        AuditLog.distinct("action"),
        AuditLog.distinct("targetType"),
      ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return NextResponse.json({
      success: true,
      logs: logs.map((log) => ({
        id: String(log._id),
        actorId: log.actorId ? String(log.actorId) : null,
        actorEmail: log.actorEmail,
        actorName: log.actorName,
        actorRole: log.actorRole,
        action: log.action,
        requiredPermission: log.requiredPermission ?? null,
        outcome: log.outcome,
        errorMessage: log.errorMessage ?? null,
        targetType: log.targetType ?? null,
        targetId: log.targetId ?? null,
        targetLabel: log.targetLabel ?? null,
        changes: log.changes ?? { before: null, after: null },
        metadata: log.metadata ?? null,
        method: log.method ?? null,
        path: log.path ?? null,
        statusCode: log.statusCode ?? null,
        ipAddress: log.ipAddress ?? null,
        userAgent: log.userAgent ?? null,
        createdAt: log.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasPrev: page > 1,
        hasNext: page < totalPages,
      },
      facets: {
        actions: (distinctActions as string[]).filter(Boolean).sort(),
        targetTypes: (distinctTargetTypes as string[]).filter(Boolean).sort(),
      },
    });
  } catch (err) {
    console.error("Fetch audit logs error:", err);
    return NextResponse.json(
      { success: false, message: "Failed to load audit logs" },
      { status: 500 },
    );
  }
}