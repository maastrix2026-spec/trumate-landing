/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Layers,
  MessageSquare,
  Package,
  RefreshCw,
  ShoppingCart,
  UsersRound,
} from "lucide-react";

interface CategoryBreakdown {
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  count: number;
}

interface RecentAdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
}

interface RecentAuditItem {
  id: string;
  actorName: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  outcome: "success" | "failure" | "denied";
  targetLabel: string | null;
  createdAt: string;
}

interface DashboardPayload {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    permissions: string[];
  };
  data: {
    totalCategories: number;
    totalProducts: number;
    totalBulkOrders: number;
    contact_inquries: number;
    productsPerCategory: CategoryBreakdown[];
    users: {
      total: number;
      active: number;
      recent: RecentAdminUser[];
    } | null;
    recentActivity: RecentAuditItem[] | null;
  };
}

const BAR_COLORS = [
  "#0f766e",
  "#2563eb",
  "#d97706",
  "#7c3aed",
  "#db2777",
  "#0284c7",
];

function formatDateTime(value: string | null) {
  if (!value) return "Never";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export default function DashboardOverview() {
  const router = useRouter();
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/dashboard/stats", { cache: "no-store" });
      if (res.status === 401) {
        router.replace("/superadmin/login");
        return;
      }

      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error || "Unable to load dashboard");
        return;
      }

      setPayload(json);
    } catch {
      setError("Network error while loading dashboard data");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  if (loading && !payload) {
    return (
      <div className="min-h-screen space-y-6 bg-zinc-50/70 p-6">
        <div className="h-24 animate-pulse rounded-xl border border-zinc-200/90 bg-white" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="h-32 animate-pulse rounded-xl border border-zinc-200/90 bg-white"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-50/70 p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      </div>
    );
  }

  if (!payload) return null;

  const { user, data } = payload;
  const maxCategoryCount = Math.max(
    1,
    ...data.productsPerCategory.map((c) => c.count),
  );

  // Catalog & demand mix donut segments normalized to pathLength="100"
  const mixSlices = [
    { label: "Products", value: data.totalProducts, color: "#0f766e" },
    { label: "Categories", value: data.totalCategories, color: "#2563eb" },
    { label: "Bulk Orders", value: data.totalBulkOrders, color: "#d97706" },
    { label: "Inquiries", value: data.contact_inquries, color: "#7c3aed" },
  ];
  const mixTotal = mixSlices.reduce((acc, item) => acc + item.value, 0);

  let runningPercent = 0;
  const donutSegments =
    mixTotal > 0
      ? mixSlices.map((slice) => {
          const pct = (slice.value / mixTotal) * 100;
          const dashArray = `${pct} ${100 - pct}`;
          const dashOffset = -runningPercent;
          runningPercent += pct;
          return {
            ...slice,
            pct,
            dashArray,
            dashOffset,
          };
        })
      : [];

  const kpiCards = [
    {
      label: "Total Products",
      hint: "Active & catalog SKUs",
      value: data.totalProducts,
      href: "/superadmin/dashboard/products",
      icon: Package,
      iconTone: "bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-600/15",
    },
    {
      label: "Categories",
      hint: "Storefront taxonomy",
      value: data.totalCategories,
      href: "/superadmin/dashboard/categories",
      icon: Layers,
      iconTone: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/15",
    },
    {
      label: "Bulk Orders",
      hint: "Wholesale requests",
      value: data.totalBulkOrders,
      href: "/superadmin/dashboard/bulk-orders",
      icon: ShoppingCart,
      iconTone:
        "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/15",
    },
    {
      label: "Inquiries",
      hint: "Customer messages",
      value: data.contact_inquries,
      href: "/superadmin/dashboard/contact-inqueries",
      icon: MessageSquare,
      iconTone:
        "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-600/15",
    },
  ];

  return (
    <div className="min-h-screen space-y-6 bg-zinc-50/70 p-6">
      {/* Workspace Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-200/90 bg-white px-6 py-4 shadow-2xs">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-lg font-semibold tracking-tight text-zinc-900">
              Operations Overview
            </h1>
            <span className="inline-flex items-center rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 font-mono text-[11px] font-medium text-zinc-700">
              {user.role}
            </span>
          </div>
          <p className="text-xs text-zinc-500">
            Signed in as{" "}
            <span className="font-medium text-zinc-700">{user.name}</span> (
            {user.email}) · {user.permissions.length} permissions granted
          </p>
        </div>

        <button
          type="button"
          onClick={loadDashboard}
          disabled={loading}
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 text-zinc-500 ${loading ? "animate-spin" : ""}`}
          />
          Sync data
        </button>
      </header>

      {/* KPI Summary Strip */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.label}
              href={card.href}
              className="group flex flex-col justify-between rounded-xl border border-zinc-200/90 bg-white p-5 shadow-2xs transition-all hover:border-zinc-300 hover:shadow-xs"
            >
              <div className="flex items-start justify-between">
                <span
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${card.iconTone}`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-zinc-400 transition-colors group-hover:text-zinc-700">
                  Open
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
              </div>

              <div className="mt-4">
                <p className="text-2xl font-semibold tracking-tight text-zinc-900 tabular-nums">
                  {card.value.toLocaleString()}
                </p>
                <p className="mt-0.5 text-xs font-medium text-zinc-700">
                  {card.label}
                </p>
                <p className="text-[11px] text-zinc-400">{card.hint}</p>
              </div>
            </Link>
          );
        })}
      </section>

      {/* Analytics Row: Category Distribution & Catalog Demand Mix */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Products per Category Bar Chart */}
        <div className="rounded-xl border border-zinc-200/90 bg-white p-6 shadow-2xs lg:col-span-7">
          <div className="mb-5 flex items-center justify-between border-b border-zinc-100 pb-4">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">
                Products by Category
              </h2>
              <p className="mt-0.5 text-xs text-zinc-500">
                Item volume distribution across categories
              </p>
            </div>
            <span className="rounded-md bg-zinc-100 px-2.5 py-1 font-mono text-[11px] text-zinc-600">
              {data.productsPerCategory.length} active
            </span>
          </div>

          {data.productsPerCategory.length === 0 ? (
            <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-zinc-200 text-xs text-zinc-400">
              No category product data available
            </div>
          ) : (
            <div className="space-y-4">
              {data.productsPerCategory.map((item, idx) => {
                const widthPct = Math.max(
                  4,
                  Math.round((item.count / maxCategoryCount) * 100),
                );
                const color = BAR_COLORS[idx % BAR_COLORS.length];

                return (
                  <div key={item.categoryId} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-zinc-800">
                        {item.categoryName}
                      </span>
                      <span className="font-mono text-zinc-600 tabular-nums">
                        {item.count.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${widthPct}%`,
                          backgroundColor: color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Catalog & Demand Mix Donut Chart */}
        {/* Catalog & Demand Mix Donut Chart */}
        <div className="flex flex-col justify-start rounded-xl border border-zinc-200/90 bg-white p-6 shadow-2xs lg:col-span-5">
          <div className="mb-5 border-b border-zinc-100 pb-4">
            <h2 className="text-sm font-semibold text-zinc-900">
              Catalog &amp; Demand Mix
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              Relative proportion of catalog items, orders, and inquiries
            </p>
          </div>

          {mixTotal === 0 ? (
            <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-zinc-200 text-xs text-zinc-400">
              No records to plot yet
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
                <div className="relative flex h-40 w-40 shrink-0 items-center justify-center">
                  <svg
                    viewBox="0 0 120 120"
                    className="h-40 w-40 -rotate-90"
                    role="img"
                    aria-label="Catalog and demand mix donut chart"
                  >
                    <circle
                      cx="60"
                      cy="60"
                      r="46"
                      fill="none"
                      stroke="#f4f4f5"
                      strokeWidth="13"
                      pathLength={100}
                    />
                    {donutSegments.map((seg) =>
                      seg.value > 0 ? (
                        <circle
                          key={seg.label}
                          cx="60"
                          cy="60"
                          r="46"
                          fill="none"
                          stroke={seg.color}
                          strokeWidth="13"
                          pathLength={100}
                          strokeDasharray={seg.dashArray}
                          strokeDashoffset={seg.dashOffset}
                        />
                      ) : null,
                    )}
                  </svg>

                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-xl font-semibold tracking-tight text-zinc-900 tabular-nums">
                      {mixTotal.toLocaleString()}
                    </span>
                    <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                      Records
                    </span>
                  </div>
                </div>

                <div className="w-full flex-1 space-y-2.5">
                  {donutSegments.map((seg) => (
                    <div
                      key={seg.label}
                      className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50/70 px-3 py-2 text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: seg.color }}
                        />
                        <span className="font-medium text-zinc-700">
                          {seg.label}
                        </span>
                      </div>
                      <div className="text-right font-mono tabular-nums">
                        <span className="font-medium text-zinc-900">
                          {seg.value}
                        </span>
                        <span className="ml-1.5 text-[11px] text-zinc-400">
                          {seg.pct.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Compact Summary Strip */}
              <div className="grid grid-cols-2 gap-3 border-t border-zinc-100 pt-4 text-xs">
                <div className="rounded-lg bg-zinc-50 px-3.5 py-2.5">
                  <p className="text-[11px] text-zinc-500">Catalog Share</p>
                  <p className="mt-0.5 font-mono text-sm font-semibold text-zinc-900 tabular-nums">
                    {Math.round(
                      ((data.totalProducts + data.totalCategories) / mixTotal) *
                        100,
                    )}
                    %
                  </p>
                </div>
                <div className="rounded-lg bg-zinc-50 px-3.5 py-2.5">
                  <p className="text-[11px] text-zinc-500">
                    Orders &amp; Inquiries
                  </p>
                  <p className="mt-0.5 font-mono text-sm font-semibold text-zinc-900 tabular-nums">
                    {(
                      data.totalBulkOrders + data.contact_inquries
                    ).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Operational Panels: Team Accounts & Recent Audit Events */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {data.users && (
          <div className="rounded-xl border border-zinc-200/90 bg-white p-6 shadow-2xs">
            <div className="mb-4 flex items-center justify-between border-b border-zinc-100 pb-3.5">
              <div className="flex items-center gap-2">
                <UsersRound className="h-4 w-4 text-zinc-500" />
                <h2 className="text-sm font-semibold text-zinc-900">
                  Admin Team
                </h2>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-mono text-[11px] text-zinc-600 tabular-nums">
                  {data.users.active}/{data.users.total} active
                </span>
              </div>
              <Link
                href="/superadmin/dashboard/users"
                className="text-xs font-medium text-teal-700 hover:underline"
              >
                Manage access
              </Link>
            </div>

            <div className="divide-y divide-zinc-100">
              {data.users.recent.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between gap-4 py-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium text-zinc-900">
                        {u.name}
                      </p>
                      <span
                        className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                          u.isActive ? "bg-emerald-500" : "bg-zinc-300"
                        }`}
                        title={u.isActive ? "Active" : "Disabled"}
                      />
                    </div>
                    <p className="truncate text-zinc-500">{u.email}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="rounded border border-zinc-200 bg-zinc-50 px-2 py-0.5 font-mono text-[11px] text-zinc-700">
                      {u.role}
                    </span>
                    <p className="mt-1 text-[11px] text-zinc-400">
                      {formatDateTime(u.lastLoginAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.recentActivity && (
          <div className="rounded-xl border border-zinc-200/90 bg-white p-6 shadow-2xs">
            <div className="mb-4 flex items-center justify-between border-b border-zinc-100 pb-3.5">
              <h2 className="text-sm font-semibold text-zinc-900">
                Recent Audit Trail
              </h2>
              <Link
                href="/superadmin/dashboard/audit-logs"
                className="text-xs font-medium text-teal-700 hover:underline"
              >
                Full log
              </Link>
            </div>

            {data.recentActivity.length === 0 ? (
              <div className="flex h-40 items-center justify-center text-xs text-zinc-400">
                No audit events recorded yet
              </div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {data.recentActivity.map((act) => (
                  <div
                    key={act.id}
                    className="flex items-center justify-between gap-4 py-3 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-mono text-[11px] font-medium text-zinc-800">
                        {act.action}
                      </p>
                      <p className="truncate text-zinc-500">
                        {act.actorName}
                        {act.targetLabel ? ` · ${act.targetLabel}` : ""}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${
                          act.outcome === "success"
                            ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20"
                            : act.outcome === "denied"
                              ? "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-600/20"
                              : "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20"
                        }`}
                      >
                        {act.outcome}
                      </span>
                      <p className="mt-1 text-[11px] text-zinc-400">
                        {formatDateTime(act.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
