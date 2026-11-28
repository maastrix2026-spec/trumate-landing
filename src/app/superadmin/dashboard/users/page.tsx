"use client";

import { ShieldCheck } from "lucide-react";
import { useAdminAuth } from "@/context/AdminAuthContext";
import AdminUsersManager from "@/components/admin/AdminUsersManager";

export default function AdminUsersPage() {
  const { user, loading, canAny } = useAdminAuth();

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <p className="text-sm text-stone-600">Checking session...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const hasUserAccess = canAny(["users:read", "users:manage"]);

  return (
    <div className="min-h-screen bg-[#FAF9F5] text-[#18230F]">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="size-5 text-[#1C3516]" />
            <div>
              <h1 className="text-lg font-semibold text-[#1C3516]">
                Users &amp; IAM Permissions
              </h1>
              <p className="text-xs text-stone-500">
                Manage staff accounts, roles, and resource permissions
              </p>
            </div>
          </div>

          <div className="text-right">
            <p className="text-sm font-medium text-stone-900">{user.name}</p>
            <p className="text-xs text-stone-500">
              {user.role} · {user.email}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {hasUserAccess ? (
          <AdminUsersManager />
        ) : (
          <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center">
            <h2 className="text-base font-semibold text-stone-900">
              Access Restricted
            </h2>
            <p className="mt-1 text-sm text-stone-600">
              Your account does not have permissions to view or manage admin
              users.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}