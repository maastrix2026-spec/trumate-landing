/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search, SlidersHorizontal } from "lucide-react";
import { useAdminAuth, type SessionUser } from "@/context/AdminAuthContext";
import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  ROLES,
  type AdminRole,
  type Permission,
} from "@/lib/iam";
import AddAdminUserModal from "./AddAdminUserModal";

interface AdminUserRow extends Omit<SessionUser, "permissions" | "extraPermissions"> {
  extraPermissions?: string[];
  permissions: string[];
  isActive: boolean;
  lastLoginAt?: string | null;
  createdAt?: string;
}

const FILTER_ROLES = ["all", ...ROLES] as const;

export default function AdminUsersManager() {
  const { user: currentUser, can, loading: authLoading } = useAdminAuth();

  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Search & filter state
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "disabled"
  >("all");

  // Modal state
  const [addModalOpen, setAddModalOpen] = useState(false);

  // Row edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<AdminRole>("viewer");
  const [editExtraPerms, setEditExtraPerms] = useState<string[]>([]);
  const [editActive, setEditActive] = useState<boolean>(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const canReadUsers = can("users:read");
  const canManageUsers = can("users:manage");
  const canManageRoles =
    currentUser?.role === "superadmin" || can("roles:manage");

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || "Could not load users");
        return;
      }
      setUsers(data.users ?? []);
    } catch {
      setError("Network error while loading users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && canReadUsers) {
      loadUsers();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [authLoading, canReadUsers, loadUsers]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (statusFilter === "active" && !u.isActive) return false;
      if (statusFilter === "disabled" && u.isActive) return false;
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
      );
    });
  }, [users, search, roleFilter, statusFilter]);

  const activeCount = useMemo(
    () => users.filter((u) => u.isActive).length,
    [users],
  );

  const startEditing = (u: AdminUserRow) => {
    const validRole = ROLES.includes(u.role as AdminRole)
      ? (u.role as AdminRole)
      : "viewer";
    const baseSet = new Set<string>(ROLE_PERMISSIONS[validRole] ?? []);
    const extras = (u.extraPermissions ?? []).filter((p) => !baseSet.has(p));

    setEditingId(u.id);
    setEditRole(validRole);
    setEditExtraPerms(extras);
    setEditActive(u.isActive);
    setNotice(null);
    setError(null);
  };

  const handleEditRoleChange = (nextRole: AdminRole) => {
    setEditRole(nextRole);
    if (nextRole === "superadmin") {
      setEditExtraPerms([]);
      return;
    }
    const nextBase = new Set<string>(ROLE_PERMISSIONS[nextRole] ?? []);
    setEditExtraPerms((prev) => prev.filter((item) => !nextBase.has(item)));
  };

  const toggleEditExtraPerm = (perm: string) => {
    if (perm === "roles:manage" && !canManageRoles) return;
    setEditExtraPerms((prev) =>
      prev.includes(perm)
        ? prev.filter((item) => item !== perm)
        : [...prev, perm],
    );
  };

  const handleSaveUser = async (userId: string) => {
    if (!canManageUsers) return;
    try {
      setSavingId(userId);
      setError(null);
      setNotice(null);

      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: editRole,
          extraPermissions:
            editRole === "superadmin" ? [] : (editExtraPerms as Permission[]),
          isActive: editActive,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "Failed to update user");
        return;
      }

      setEditingId(null);
      setNotice(`Updated permissions for ${data.user.email}`);
      await loadUsers();
    } catch {
      setError("Unable to save changes right now");
    } finally {
      setSavingId(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-6 text-sm text-stone-600">
        Loading team directory...
      </div>
    );
  }

  if (!canReadUsers) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-6 text-sm text-stone-700">
        You do not have permission (
        <code className="font-mono">users:read</code>) to view team accounts.
      </div>
    );
  }

  const editableRoles: AdminRole[] = canManageRoles
    ? [...ROLES]
    : ROLES.filter((r) => r !== "superadmin");

  const editBasePerms = ROLE_PERMISSIONS[editRole] ?? [];
  const editBasePermSet = new Set<string>(editBasePerms);
  const editAssignableExtraPerms: string[] =
    editRole === "superadmin"
      ? []
      : PERMISSIONS.filter((perm) => !editBasePermSet.has(perm));

  return (
    <div className="space-y-5">
      {/* Header Row + Stats */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-stone-200 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <p className="text-xs text-stone-500">Total Accounts</p>
            <p className="text-xl font-semibold text-stone-900">
              {users.length}
            </p>
          </div>
          <div className="h-8 w-px bg-stone-200" />
          <div>
            <p className="text-xs text-stone-500">Active</p>
            <p className="text-xl font-semibold text-emerald-700">
              {activeCount}
            </p>
          </div>
          <div className="h-8 w-px bg-stone-200" />
          <div>
            <p className="text-xs text-stone-500">Showing</p>
            <p className="text-xl font-semibold text-stone-900">
              {filteredUsers.length}
            </p>
          </div>
        </div>

        {canManageUsers && (
          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1C3516] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#244620]"
          >
            <Plus className="size-4" />
            Add User
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-stone-200 bg-white p-3.5">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-stone-400" />
          <input
            type="text"
            placeholder="Search by name, email, or role..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-stone-300 bg-stone-50 py-2 pl-9 pr-3 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1C3516]/20"
          />
        </div>

        <div className="flex items-center gap-2">
          <SlidersHorizontal className="size-4 text-stone-400" />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            aria-label="Filter by role"
            className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700"
          >
            {FILTER_ROLES.map((r) => (
              <option key={r} value={r}>
                {r === "all" ? "All roles" : r}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as "all" | "active" | "disabled")
            }
            aria-label="Filter by status"
            className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700"
          >
            <option value="all">All statuses</option>
            <option value="active">Active only</option>
            <option value="disabled">Disabled only</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50 text-xs font-semibold uppercase tracking-wider text-stone-500">
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Permissions</th>
              <th className="px-4 py-3">Status</th>
              {canManageUsers && (
                <th className="px-4 py-3 text-right">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {filteredUsers.length === 0 ? (
              <tr>
                <td
                  colSpan={canManageUsers ? 5 : 4}
                  className="px-4 py-10 text-center text-sm text-stone-500"
                >
                  No matching admin accounts found.
                </td>
              </tr>
            ) : (
              filteredUsers.map((u) => {
                const isEditing = editingId === u.id;
                const isSelf = currentUser?.id === u.id;
                const perms = u.permissions ?? [];
                const previewPerms = perms.slice(0, 3);
                const extraCount = perms.length - previewPerms.length;

                return (
                  <React.Fragment key={u.id}>
                    <tr className="hover:bg-stone-50/70">
                      <td className="px-4 py-3.5 align-top">
                        <p className="font-medium text-stone-900">
                          {u.name}
                          {isSelf && (
                            <span className="ml-2 rounded bg-stone-100 px-1.5 py-0.5 text-[11px] font-normal text-stone-600">
                              You
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-stone-500">{u.email}</p>
                      </td>

                      <td className="px-4 py-3.5 align-top">
                        <span className="inline-block rounded-md bg-stone-100 px-2.5 py-1 font-mono text-xs text-stone-700">
                          {u.role}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 align-top">
                        {perms.length === 0 ? (
                          <span className="text-xs text-stone-400">None</span>
                        ) : (
                          <div className="flex flex-wrap items-center gap-1">
                            {previewPerms.map((perm) => (
                              <span
                                key={perm}
                                className="rounded bg-stone-100 px-2 py-0.5 font-mono text-xs text-stone-700"
                              >
                                {perm}
                              </span>
                            ))}
                            {extraCount > 0 && (
                              <span className="rounded bg-[#1C3516]/10 px-2 py-0.5 text-xs font-medium text-[#1C3516]">
                                +{extraCount} more
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3.5 align-top">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            u.isActive
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-stone-200 text-stone-600"
                          }`}
                        >
                          <span
                            className={`size-1.5 rounded-full ${
                              u.isActive ? "bg-emerald-600" : "bg-stone-500"
                            }`}
                          />
                          {u.isActive ? "Active" : "Disabled"}
                        </span>
                      </td>

                      {canManageUsers && (
                        <td className="px-4 py-3.5 text-right align-top">
                          <button
                            type="button"
                            onClick={() =>
                              isEditing ? setEditingId(null) : startEditing(u)
                            }
                            className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50"
                          >
                            {isEditing ? "Close" : "Edit Access"}
                          </button>
                        </td>
                      )}
                    </tr>

                    {isEditing && canManageUsers && (
                      <tr className="bg-stone-50/90">
                        <td colSpan={5} className="px-4 py-4">
                          <div className="space-y-4">
                            <div className="flex flex-wrap items-center gap-4">
                              <div>
                                <label className="mb-1 block text-xs font-medium text-stone-600">
                                  Role
                                </label>
                                <select
                                  value={editRole}
                                  onChange={(e) =>
                                    handleEditRoleChange(
                                      e.target.value as AdminRole,
                                    )
                                  }
                                  className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm"
                                >
                                  {editableRoles.map((r) => (
                                    <option key={r} value={r}>
                                      {r}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <label className="mt-5 inline-flex items-center gap-2 text-sm text-stone-700">
                                <input
                                  type="checkbox"
                                  checked={editActive}
                                  disabled={isSelf}
                                  onChange={(e) =>
                                    setEditActive(e.target.checked)
                                  }
                                  className="accent-[#1C3516]"
                                />
                                Active account
                              </label>
                            </div>

                            <div>
                              <p className="mb-1.5 text-xs font-medium text-stone-600">
                                Included by Role ({editBasePerms.length})
                              </p>
                              <div className="flex flex-wrap gap-1.5 rounded-lg border border-stone-200 bg-white p-2.5">
                                {editBasePerms.length > 0 ? (
                                  editBasePerms.map((perm) => (
                                    <span
                                      key={perm}
                                      className="rounded bg-stone-100 px-2 py-0.5 font-mono text-xs text-stone-700"
                                    >
                                      {perm}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-xs text-stone-400">
                                    No default permissions for this role
                                  </span>
                                )}
                              </div>
                            </div>

                            {editRole !== "superadmin" && (
                              <div>
                                <p className="mb-1.5 text-xs font-medium text-stone-600">
                                  Extra Permissions ({editExtraPerms.length}{" "}
                                  added)
                                </p>
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                  {editAssignableExtraPerms.map((perm) => {
                                    const checked =
                                      editExtraPerms.includes(perm);
                                    const disabled =
                                      perm === "roles:manage" && !canManageRoles;
                                    return (
                                      <label
                                        key={perm}
                                        className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-mono ${
                                          disabled
                                            ? "cursor-not-allowed border-stone-200 bg-stone-100 text-stone-400"
                                            : checked
                                              ? "cursor-pointer border-[#1C3516] bg-[#1C3516]/10 font-medium text-[#1C3516]"
                                              : "cursor-pointer border-stone-200 bg-white text-stone-600"
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          disabled={disabled}
                                          onChange={() =>
                                            toggleEditExtraPerm(perm)
                                          }
                                          className="accent-[#1C3516]"
                                        />
                                        <span className="truncate">{perm}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={savingId === u.id}
                                onClick={() => handleSaveUser(u.id)}
                                className="rounded-lg bg-[#1C3516] px-4 py-1.5 text-xs font-medium text-white hover:bg-[#244620] disabled:opacity-50"
                              >
                                {savingId === u.id
                                  ? "Saving..."
                                  : "Save Changes"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Separate Add User Modal */}
      <AddAdminUserModal
        open={addModalOpen}
        canGrantWildcard={canManageRoles}
        onClose={() => setAddModalOpen(false)}
        onCreated={(createdEmail) => {
          setNotice(`Created account for ${createdEmail}`);
          loadUsers();
        }}
      />
    </div>
  );
}