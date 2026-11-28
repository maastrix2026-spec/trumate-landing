/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useEffect, useState } from "react";
import { ShieldPlus, X } from "lucide-react";
import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  ROLES,
  type AdminRole,
  type Permission,
} from "@/lib/iam";

interface AddAdminUserModalProps {
  open: boolean;
  canGrantWildcard: boolean;
  onClose: () => void;
  onCreated: (email: string) => void;
}

const SELECTABLE_ROLES = ROLES.filter((r) => r !== "superadmin");

export default function AddAdminUserModal({
  open,
  canGrantWildcard,
  onClose,
  onCreated,
}: AddAdminUserModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AdminRole>("inventory_manager");
  const [extraPerms, setExtraPerms] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, submitting, onClose]);

  if (!open) return null;

  const availableRoles: AdminRole[] = canGrantWildcard
    ? [...ROLES]
    : [...SELECTABLE_ROLES];

  const baseRolePerms = ROLE_PERMISSIONS[role] ?? [];
  const baseRolePermSet = new Set<string>(baseRolePerms);

  // Permissions not already covered by the selected role (no "*" wildcard)
  const additionalAssignablePerms: string[] =
    role === "superadmin"
      ? []
      : PERMISSIONS.filter((perm) => !baseRolePermSet.has(perm));

  const handleRoleChange = (nextRole: AdminRole) => {
    setRole(nextRole);
    if (nextRole === "superadmin") {
      setExtraPerms([]);
      return;
    }
    const nextBase = new Set<string>(ROLE_PERMISSIONS[nextRole] ?? []);
    // Drop any extra permissions that are now already included by the new role
    setExtraPerms((prev) => prev.filter((perm) => !nextBase.has(perm)));
  };

  const toggleExtraPerm = (perm: string) => {
    setExtraPerms((prev) =>
      prev.includes(perm) ? prev.filter((item) => item !== perm) : [...prev, perm]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);

      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          role,
          extraPermissions: role === "superadmin" ? [] : (extraPerms as Permission[]),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || "Failed to create user");
        return;
      }

      const createdEmail = data.user?.email || email;
      setName("");
      setEmail("");
      setPassword("");
      setRole("inventory_manager");
      setExtraPerms([]);
      onCreated(createdEmail);
      onClose();
    } catch {
      setError("Network error while creating user");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-admin-user-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-stone-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[#1C3516]/10 text-[#1C3516]">
              <ShieldPlus className="size-5" />
            </div>
            <div>
              <h2
                id="add-admin-user-title"
                className="text-base font-semibold text-stone-900"
              >
                Add Team Member
              </h2>
              <p className="text-xs text-stone-500">
                Choose a base role and add extra permissions for this user
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close modal"
            className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
          >
            <X className="size-4" />
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-stone-700">
                Full Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Rajesh Mohanty"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-[#1C3516] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-stone-700">
                Email Address
              </label>
              <input
                type="email"
                required
                placeholder="staff@trumategroup.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-[#1C3516] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-stone-700">
                Temporary Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                placeholder="Minimum 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-[#1C3516] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-stone-700">
                Role
              </label>
              <select
                value={role}
                onChange={(e) => handleRoleChange(e.target.value as AdminRole)}
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-[#1C3516] focus:outline-none"
              >
                {availableRoles.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Permissions inherited automatically from the selected role */}
          <div>
            <p className="mb-2 text-xs font-medium text-stone-700">
              Included by Role ({baseRolePerms.length})
            </p>
            <div className="flex flex-wrap gap-1.5 rounded-xl border border-stone-200 bg-stone-50 p-3">
              {baseRolePerms.length > 0 ? (
                baseRolePerms.map((perm) => (
                  <span
                    key={perm}
                    className="rounded-md border border-stone-200 bg-white px-2.5 py-1 font-mono text-xs text-stone-700"
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

          {/* Extra permissions added specifically for this user */}
          {role !== "superadmin" && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-stone-700">
                  Extra Permissions for This User ({extraPerms.length} added)
                </span>
                {extraPerms.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setExtraPerms([])}
                    className="text-xs text-stone-500 hover:text-stone-800"
                  >
                    Clear extra
                  </button>
                )}
              </div>

              <div className="grid max-h-48 grid-cols-1 gap-2 overflow-y-auto rounded-xl border border-stone-200 bg-stone-50/70 p-3 sm:grid-cols-2">
                {additionalAssignablePerms.map((perm) => {
                  const checked = extraPerms.includes(perm);
                  return (
                    <label
                      key={perm}
                      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-mono transition-colors ${
                        checked
                          ? "border-[#1C3516] bg-[#1C3516]/10 font-medium text-[#1C3516]"
                          : "border-stone-200 bg-white text-stone-600 hover:border-stone-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleExtraPerm(perm)}
                        className="accent-[#1C3516]"
                      />
                      <span className="truncate">{perm}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 border-t border-stone-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-[#1C3516] px-4 py-2 text-sm font-medium text-white hover:bg-[#244620] disabled:opacity-50"
            >
              {submitting ? "Creating..." : "Create User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}