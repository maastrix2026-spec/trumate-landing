/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  hasAnyPermission,
  hasPermission,
  type Permission,
} from "@/lib/iam";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: string;
  extraPermissions?: Permission[];
  permissions: Permission[];
}

interface LoginResult {
  ok: boolean;
  error?: string;
}

interface AdminAuthContextType {
  user: SessionUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  can: (permission: Permission) => boolean;
  canAny: (permissions: Permission[]) => boolean;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(
  undefined
);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const router = useRouter();
  const pathname = usePathname();

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (!res.ok) {
        setUser(null);
        return;
      }
      const data = await res.json();
      setUser(data.success ? data.user ?? null : null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const isAuthenticated = Boolean(user);

  useEffect(() => {
    if (loading) return;
    const isLoginPage = pathname === "/superadmin/login";
    const isSuperadminRoute = pathname.startsWith("/superadmin");

    if (isSuperadminRoute && !isLoginPage && !isAuthenticated) {
      router.replace("/superadmin/login");
    } else if (isLoginPage && isAuthenticated) {
      router.replace("/superadmin/dashboard");
    }
  }, [isAuthenticated, pathname, loading, router]);

  const login = async (email: string, password: string): Promise<LoginResult> => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok || !data.success || !data.user) {
        return {
          ok: false,
          error: data.message || "Invalid email or password",
        };
      }

      setUser(data.user);
      router.replace("/superadmin/dashboard");
      return { ok: true };
    } catch {
      return { ok: false, error: "Unable to sign in right now" };
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
      router.replace("/superadmin/login");
    }
  };

  const can = useCallback(
    (permission: Permission) => hasPermission(user?.permissions, permission),
    [user]
  );

  const canAny = useCallback(
    (permissions: Permission[]) => hasAnyPermission(user?.permissions, permissions),
    [user]
  );

  return (
    <AdminAuthContext.Provider
      value={{
        user,
        isAuthenticated,
        loading,
        login,
        logout,
        refreshUser,
        can,
        canAny,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error("useAdminAuth must be used within an AdminAuthProvider");
  }
  return context;
}