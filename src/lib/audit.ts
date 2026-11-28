import type { NextRequest } from "next/server";
import AuditLog, { type AuditOutcome } from "@/models/AuditLog";
import type { CurrentAdminUser } from "@/lib/auth";
import connectDB from "@/lib/db";

const REDACTED_KEYS = new Set([
  "password",
  "passwordHash",
  "token",
  "secret",
  "authorization",
  "cookie",
]);

export function sanitizeAuditData<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAuditData(item)) as unknown as T;
  }
  if (value instanceof Date) {
    return value.toISOString() as unknown as T;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (REDACTED_KEYS.has(k)) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = sanitizeAuditData(v);
      }
    }
    return out as T;
  }
  return value;
}

export function getRequestContext(req?: NextRequest) {
  if (!req) {
    return {
      method: null,
      path: null,
      ipAddress: null,
      userAgent: null,
    };
  }

  const forwardedFor = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  const ipAddress =
    forwardedFor?.split(",")[0]?.trim() || realIp?.trim() || null;

  return {
    method: req.method,
    path: req.nextUrl.pathname,
    ipAddress,
    userAgent: req.headers.get("user-agent"),
  };
}

export interface RecordAuditInput {
  req?: NextRequest;
  actor?:
    | Pick<CurrentAdminUser, "id" | "email" | "name" | "role">
    | {
        id?: string | null;
        email: string;
        name: string;
        role: string;
      };
  action: string;
  requiredPermission?: string | null;
  outcome: AuditOutcome;
  statusCode?: number | null;
  errorMessage?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  targetLabel?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown> | null;
}

export async function recordAuditLog(input: RecordAuditInput): Promise<void> {
  try {
    await connectDB();
    const ctx = getRequestContext(input.req);

    await AuditLog.create({
      actorId: input.actor?.id ?? null,
      actorEmail: input.actor?.email ?? "unknown@trumategroup.com",
      actorName: input.actor?.name ?? "Unknown Actor",
      actorRole: input.actor?.role ?? "unknown",
      action: input.action,
      requiredPermission: input.requiredPermission ?? null,
      outcome: input.outcome,
      errorMessage: input.errorMessage ?? null,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      targetLabel: input.targetLabel ?? null,
      changes: {
        before:
          input.before !== undefined ? sanitizeAuditData(input.before) : null,
        after:
          input.after !== undefined ? sanitizeAuditData(input.after) : null,
      },
      metadata:
        input.metadata !== undefined && input.metadata !== null
          ? sanitizeAuditData(input.metadata)
          : null,
      method: ctx.method,
      path: ctx.path,
      statusCode: input.statusCode ?? null,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
  } catch (err) {
    // Do not fail the main request if audit logging fails
    console.error("Failed to write audit log:", err);
  }
}
