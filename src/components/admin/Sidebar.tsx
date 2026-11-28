"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Layers,
  ShoppingCart,
  MessageSquare,
  Mail,
  UsersRound,
  ScrollText,
  ExternalLink,
  LogOut,
  ShieldCheck,
  BadgeCheck,
} from "lucide-react";
import { useAdminAuth } from "@/context/AdminAuthContext";
import type { Permission } from "@/lib/iam";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredPermission?: Permission;
  section?: "main" | "system";
}

const navItems: NavItem[] = [
  {
    name: "Dashboard",
    href: "/superadmin/dashboard",
    icon: LayoutDashboard,
    section: "main",
  },
  {
    name: "Products",
    href: "/superadmin/dashboard/products",
    icon: Package,
    requiredPermission: "products:read",
    section: "main",
  },
  {
    name: "Categories",
    href: "/superadmin/dashboard/categories",
    icon: Layers,
    requiredPermission: "products:read",
    section: "main",
  },
  {
    name: "Bulk Orders",
    href: "/superadmin/dashboard/bulk-orders",
    icon: ShoppingCart,
    requiredPermission: "orders:read",
    section: "main",
  },
  {
    name: "Inquiries",
    href: "/superadmin/dashboard/contact-inqueries",
    icon: MessageSquare,
    section: "main",
  },
  {
    name: "Newsletter",
    href: "/superadmin/dashboard/newsletter",
    icon: Mail,
    section: "main",
  },
  {
    name: "Users",
    href: "/superadmin/dashboard/users",
    icon: UsersRound,
    requiredPermission: "users:read",
    section: "system",
  },
  {
    name: "Audit Logs",
    href: "/superadmin/dashboard/audit-logs",
    icon: ScrollText,
    requiredPermission: "audit:read",
    section: "system",
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, can, logout } = useAdminAuth();

  const visibleItems = navItems.filter((item) => {
    if (!item.requiredPermission) return true;
    return can(item.requiredPermission);
  });

  const mainItems = visibleItems.filter((item) => item.section !== "system");
  const systemItems = visibleItems.filter((item) => item.section === "system");

  const isRouteActive = (href: string) => {
    if (href === "/superadmin/dashboard") {
      return pathname === href;
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const renderLink = (item: NavItem) => {
    const Icon = item.icon;
    const active = isRouteActive(item.href);

    return (
      <Link
        key={item.href}
        href={item.href}
        className={`group flex items-center justify-between rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
          active
            ? "bg-white/[0.09] text-white"
            : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100"
        }`}
      >
        <span className="flex items-center gap-2.5 truncate">
          <Icon
            className={`h-4 w-4 shrink-0 transition-colors ${
              active
                ? "text-emerald-400"
                : "text-zinc-500 group-hover:text-zinc-300"
            }`}
          />
          <span className="truncate">{item.name}</span>
        </span>
        {active && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
      </Link>
    );
  };

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col justify-between border-r border-zinc-800/80 bg-zinc-950 text-zinc-100 md:flex">
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Brand Header */}
        <div className="flex items-center gap-3 border-b border-zinc-800/80 px-4 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-stone-200/80 bg-[#FAF7F2] p-1">
            <img
              src="/logo.png"
              alt="Trumate Group logo"
              className="h-full w-full object-contain"
            />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight text-white">
              Trumate Admin
            </p>
            <p className="truncate text-[11px] text-zinc-500">
              trumategroup.com
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {mainItems.length > 0 && (
            <div className="space-y-0.5">
              <p className="px-3 pb-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                Commerce
              </p>
              {mainItems.map(renderLink)}
            </div>
          )}

          {systemItems.length > 0 && (
            <div className="space-y-0.5">
              <p className="px-3 pb-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                Access &amp; Security
              </p>
              {systemItems.map(renderLink)}
            </div>
          )}
        </nav>
      </div>

      {/* Footer */}
      <div className="space-y-2 border-t border-zinc-800/80 p-3">
        {user && (
          <Link
            href="/superadmin/dashboard/profile"
            className={`group flex items-center justify-between gap-2 rounded-lg border px-3 py-2 transition-colors ${
              pathname === "/superadmin/dashboard/profile"
                ? "border-emerald-500/30 bg-white/[0.09] text-white"
                : "border-zinc-800/80 bg-zinc-900/70 hover:border-zinc-700 hover:bg-zinc-900"
            }`}
          >
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-zinc-200 group-hover:text-white">
                {user.name}
              </p>
              <p className="truncate font-mono text-[11px] text-zinc-500 group-hover:text-zinc-400">
                {user.role}
              </p>
            </div>
            <BadgeCheck
              className={`h-4 w-4 shrink-0 transition-colors ${
                pathname === "/superadmin/dashboard/profile"
                  ? "text-emerald-400"
                  : "text-zinc-500 group-hover:text-zinc-300"
              }`}
            />
          </Link>
        )}

        <div className="space-y-0.5">
          <Link
            href="/"
            target="_blank"
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-zinc-400 transition-colors hover:bg-white/[0.04] hover:text-zinc-100"
          >
            <ExternalLink className="h-4 w-4 shrink-0 text-zinc-500" />
            <span>Visit Storefront</span>
          </Link>

          <button
            type="button"
            onClick={logout}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-zinc-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
          >
            <LogOut className="h-4 w-4 shrink-0 text-zinc-500" />
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
