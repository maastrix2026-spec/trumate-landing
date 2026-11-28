import crypto from "crypto";
import { cookies } from "next/headers";
import AdminUser from "@/models/AdminUser";
import {
  getEffectivePermissions,
  hasPermission,
  type Permission,
} from "@/lib/iam";
import connectDB from "./db";

export const SESSION_COOKIE_NAME = "trumate_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12; 

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET environment variable is not set");
  }
  return secret;
}

/* ---------- Password Hashing (Node built-in crypto.scrypt) ---------- */

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(":");
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  if (!salt || !keyHex) return false;

  const keyBuf = Buffer.from(keyHex, "hex");
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  if (keyBuf.length !== derivedBuf.length) return false;

  return crypto.timingSafeEqual(keyBuf, derivedBuf);
}

/* ---------- Signed Session Token ---------- */

interface SessionPayload {
  userId: string;
  exp: number; // unix timestamp in seconds
}

export function createSessionToken(userId: string): string {
  const payload: SessionPayload = {
    userId,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url",
  );
  const signature = crypto
    .createHmac("sha256", getSecret())
    .update(encodedPayload)
    .digest("base64url");

  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(
  token: string | undefined,
): SessionPayload | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encodedPayload, signature] = parts;
  if (!encodedPayload || !signature) return null;

  const expectedSig = crypto
    .createHmac("sha256", getSecret())
    .update(encodedPayload)
    .digest("base64url");

  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as SessionPayload;

    if (!parsed.userId || typeof parsed.exp !== "number") return null;
    if (parsed.exp < Math.floor(Date.now() / 1000)) return null;

    return parsed;
  } catch {
    return null;
  }
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}

/* ---------- Current Authenticated User & Permission Check ---------- */

export interface CurrentAdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  extraPermissions: Permission[];
  permissions: Permission[];
}

export async function getSessionUser(): Promise<CurrentAdminUser | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = verifySessionToken(rawToken);
  if (!session) return null;

  await connectDB();
  const user = await AdminUser.findById(session.userId).lean();
  if (!user || !user.isActive) return null;

  const extraPermissions = (user.extraPermissions ?? []) as Permission[];
  const permissions = getEffectivePermissions(user.role, extraPermissions);

  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    extraPermissions,
    permissions,
  };
}

export async function requirePermission(
  permission: Permission,
): Promise<
  | { ok: true; user: CurrentAdminUser }
  | { ok: false; status: 401 | 403; error: string }
> {
  const user = await getSessionUser();
  if (!user) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  if (!hasPermission(user.permissions, permission)) {
    return { ok: false, status: 403, error: "Forbidden: missing permission" };
  }
  return { ok: true, user };
}