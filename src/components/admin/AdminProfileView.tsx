"use client";

import React, { useMemo, useState } from "react";
import {
  CheckCircle2,
  KeyRound,
  Lock,
  Mail,
  RefreshCw,
  Shield,
  UserCheck,
} from "lucide-react";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { PERMISSIONS, ROLE_PERMISSIONS, type Permission } from "@/lib/iam";

function groupPermissions(perms: readonly string[]) {
  const groups = new Map<string, string[]>();
  for (const perm of perms) {
    const [domain] = perm.split(":");
    const key = domain || "general";
    const list = groups.get(key) ?? [];
    list.push(perm);
    groups.set(key, list);
  }
  return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
}

export default function AdminProfileView() {
  const { user, can, loading, refreshUser } = useAdminAuth();
  const [refreshing, setRefreshing] = useState(false);

  const effectiveSet = useMemo(
    () => new Set<string>(user?.permissions ?? []),
    [user?.permissions],
  );

  const roleDefaultSet = useMemo(() => {
    if (!user) return new Set<string>();
    if (user.role === "superadmin") {
      return new Set<string>(PERMISSIONS);
    }
    return new Set<string>(
      (ROLE_PERMISSIONS as Record<string, readonly string[]>)[user.role] ?? [],
    );
  }, [user]);

  const extraGrantedPerms = useMemo(() => {
    if (!user) return [];
    return (user.permissions ?? []).filter((p) => !roleDefaultSet.has(p));
  }, [user, roleDefaultSet]);

  const groupedAssigned = useMemo(
    () => groupPermissions(user?.permissions ?? []),
    [user?.permissions],
  );

  const groupedAllCatalog = useMemo(
    () => groupPermissions(PERMISSIONS),
    [],
  );

  const handleRefreshSession = async () => {
    try {
      setRefreshing(true);
      await refreshUser();
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 rounded-xl border border-zinc-200/90 bg-white p-6">
        <div className="h-6 w-48 animate-pulse rounded bg-zinc-100" />
        <div className="h-24 animate-pulse rounded-lg bg-zinc-100" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-xl border border-zinc-200/90 bg-white p-6 text-sm text-zinc-600">
        No active admin session found. Please sign in again.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Identity & Role Summary Card */}
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-zinc-200/90 bg-white p-6 shadow-2xs">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-teal-600/20 bg-teal-50 text-teal-700">
            <UserCheck className="h-6 w-6" />
          </div>
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
                {user.name}
              </h2>
              <span className="rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 font-mono text-xs font-medium text-zinc-800">
                {user.role}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                <CheckCircle2 className="h-3 w-3" />
                Active Session
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-zinc-500">
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-zinc-400" />
                {user.email}
              </span>
              <span className="font-mono text-[11px] text-zinc-400">
                ID: {user.id}
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleRefreshSession}
          disabled={refreshing}
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 text-zinc-500 ${refreshing ? "animate-spin" : ""}`}
          />
          Sync permissions
        </button>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-200/90 bg-white p-4 shadow-2xs">
          <p className="text-xs text-zinc-500">Assigned Role</p>
          <p className="mt-1 font-mono text-base font-semibold text-zinc-900">
            {user.role}
          </p>
          <p className="mt-0.5 text-[11px] text-zinc-400">
            {user.role === "superadmin"
              ? "Full system access across all permissions"
              : `${roleDefaultSet.size} base permissions from role`}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200/90 bg-white p-4 shadow-2xs">
          <p className="text-xs text-zinc-500">Effective Permissions</p>
          <p className="mt-1 font-mono text-base font-semibold text-teal-700 tabular-nums">
            {user.permissions.length} / {PERMISSIONS.length}
          </p>
          <p className="mt-0.5 text-[11px] text-zinc-400">
            Active capabilities in current session
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200/90 bg-white p-4 shadow-2xs">
          <p className="text-xs text-zinc-500">Extra Grant Overrides</p>
          <p className="mt-1 font-mono text-base font-semibold text-zinc-900 tabular-nums">
            {extraGrantedPerms.length}
          </p>
          <p className="mt-0.5 text-[11px] text-zinc-400">
            Additional permissions beyond base role
          </p>
        </div>
      </div>

      {/* Assigned Permissions Grouped by Domain */}
      <div className="rounded-xl border border-zinc-200/90 bg-white p-6 shadow-2xs">
        <div className="mb-4 flex items-center justify-between border-b border-zinc-100 pb-4">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-teal-700" />
            <div>
              <h3 className="text-sm font-semibold text-zinc-900">
                Assigned Permissions
              </h3>
              <p className="text-xs text-zinc-500">
                Grouped by resource module for your current account
              </p>
            </div>
          </div>
          <span className="rounded-md bg-zinc-100 px-2.5 py-1 font-mono text-xs text-zinc-700">
            {user.permissions.length} active
          </span>
        </div>

        {groupedAssigned.length === 0 ? (
          <p className="py-6 text-center text-xs text-zinc-400">
            No permissions assigned to this account.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {groupedAssigned.map(([domain, perms]) => (
              <div
                key={domain}
                className="rounded-lg border border-zinc-200/80 bg-zinc-50/50 p-4"
              >
                <div className="mb-2.5 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-700">
                    {domain}
                  </span>
                  <span className="font-mono text-[11px] text-zinc-400">
                    {perms.length}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {perms.map((perm) => {
                    const isExtra = !roleDefaultSet.has(perm);
                    return (
                      <span
                        key={perm}
                        className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-xs ${
                          isExtra
                            ? "border border-amber-300/80 bg-amber-50 font-medium text-amber-900"
                            : "border border-zinc-200 bg-white text-zinc-800"
                        }`}
                      >
                        <KeyRound className="h-3 w-3 text-teal-600" />
                        {perm}
                        {isExtra && (
                          <span className="rounded bg-amber-200/70 px-1 py-0.2 font-sans text-[10px] font-semibold text-amber-900">
                            extra
                          </span>
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Full Permission Matrix (Granted vs. Restricted) */}
      <div className="rounded-xl border border-zinc-200/90 bg-white p-6 shadow-2xs">
        <div className="mb-4 border-b border-zinc-100 pb-4">
          <h3 className="text-sm font-semibold text-zinc-900">
            Permission Access Matrix
          </h3>
          <p className="mt-0.5 text-xs text-zinc-500">
            Complete catalog of application permissions and your live access status
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groupedAllCatalog.map(([domain, perms]) => (
            <div
              key={domain}
              className="rounded-lg border border-zinc-200/80 p-3.5"
            >
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                {domain}
              </p>
              <ul className="space-y-1.5">
                {perms.map((perm) => {
                  const allowed =
                    effectiveSet.has(perm) || can(perm as Permission);
                  return (
                    <li
                      key={perm}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      <span
                        className={`truncate font-mono ${
                          allowed ? "text-zinc-800" : "text-zinc-400"
                        }`}
                      >
                        {perm}
                      </span>
                      {allowed ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                          Allowed
                        </span>
                      ) : (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
                          <Lock className="h-2.5 w-2.5" />
                          Locked
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}