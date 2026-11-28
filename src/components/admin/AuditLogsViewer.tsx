/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RefreshCw,
  RotateCcw,
  Search,
} from "lucide-react";
import { useAdminAuth } from "@/context/AdminAuthContext";

interface AuditLogEntry {
  id: string;
  actorId: string | null;
  actorEmail: string;
  actorName: string;
  actorRole: string;
  action: string;
  requiredPermission: string | null;
  outcome: "success" | "failure" | "denied";
  errorMessage: string | null;
  targetType: string | null;
  targetId: string | null;
  targetLabel: string | null;
  changes: {
    before: unknown;
    after: unknown;
  };
  metadata: Record<string, unknown> | null;
  method: string | null;
  path: string | null;
  statusCode: number | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
}

const OUTCOME_STYLES: Record<AuditLogEntry["outcome"], string> = {
  success: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
  denied: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-600/20",
  failure: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20",
};

function formatTimestamp(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(date);
}

export default function AuditLogsViewer() {
  const { can, loading: authLoading } = useAdminAuth();
  const canReadAudit = can("audit:read");

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
    hasPrev: false,
    hasNext: false,
  });
  const [actionsFacet, setActionsFacet] = useState<string[]>([]);
  const [targetsFacet, setTargetsFacet] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filters
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [outcome, setOutcome] = useState<string>("all");
  const [targetType, setTargetType] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(20);

  // Debounce text search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (debouncedSearch) params.set("q", debouncedSearch);
      if (outcome !== "all") params.set("outcome", outcome);
      if (targetType !== "all") params.set("targetType", targetType);
      if (actionFilter !== "all") params.set("action", actionFilter);
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);

      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "Unable to fetch audit logs");
        return;
      }

      setLogs(data.logs ?? []);
      if (data.pagination) setPagination(data.pagination);
      if (data.facets?.actions) setActionsFacet(data.facets.actions);
      if (data.facets?.targetTypes) setTargetsFacet(data.facets.targetTypes);
    } catch {
      setError("Network error while loading audit logs");
    } finally {
      setLoading(false);
    }
  }, [
    page,
    limit,
    debouncedSearch,
    outcome,
    targetType,
    actionFilter,
    fromDate,
    toDate,
  ]);

  useEffect(() => {
    if (!authLoading && canReadAudit) {
      fetchLogs();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [authLoading, canReadAudit, fetchLogs]);

  const resetFilters = () => {
    setSearchInput("");
    setDebouncedSearch("");
    setOutcome("all");
    setTargetType("all");
    setActionFilter("all");
    setFromDate("");
    setToDate("");
    setPage(1);
  };

  const hasActiveFilters =
    Boolean(debouncedSearch) ||
    outcome !== "all" ||
    targetType !== "all" ||
    actionFilter !== "all" ||
    Boolean(fromDate) ||
    Boolean(toDate);

  if (authLoading) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
        Checking permissions...
      </div>
    );
  }

  if (!canReadAudit) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-700">
        You do not have permission (<code className="font-mono">audit:read</code>) to view audit logs.
      </div>
    );
  }

  const startItem =
    pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const endItem = Math.min(
    pagination.page * pagination.limit,
    pagination.total,
  );

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          {/* Search */}
          <div className="relative md:col-span-4">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search actor, action, target, IP..."
              className="w-full rounded-lg border border-zinc-300 bg-zinc-50 py-2 pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:bg-white focus:outline-none"
            />
          </div>

          {/* Outcome */}
          <div className="md:col-span-2">
            <select
              value={outcome}
              onChange={(e) => {
                setOutcome(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by outcome"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 focus:border-zinc-900 focus:outline-none"
            >
              <option value="all">All outcomes</option>
              <option value="success">Success</option>
              <option value="denied">Denied</option>
              <option value="failure">Failure</option>
            </select>
          </div>

          {/* Target Type */}
          <div className="md:col-span-2">
            <select
              value={targetType}
              onChange={(e) => {
                setTargetType(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by target entity"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 focus:border-zinc-900 focus:outline-none"
            >
              <option value="all">All entities</option>
              {targetsFacet.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Action */}
          <div className="md:col-span-2">
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by action"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 focus:border-zinc-900 focus:outline-none"
            >
              <option value="all">All actions</option>
              {actionsFacet.map((act) => (
                <option key={act} value={act}>
                  {act}
                </option>
              ))}
            </select>
          </div>

          {/* Refresh / Reset */}
          <div className="flex items-center justify-end gap-2 md:col-span-2">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                title="Reset filters"
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </button>
            )}
            <button
              type="button"
              onClick={fetchLogs}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>
        </div>

        {/* Date Range Row */}
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-3 text-xs text-zinc-600">
          <span className="font-medium text-zinc-500">Date range:</span>
          <label className="inline-flex items-center gap-1.5">
            <span>From</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(1);
              }}
              className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-800"
            />
          </label>
          <label className="inline-flex items-center gap-1.5">
            <span>To</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(1);
              }}
              className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-800"
            />
          </label>
          <span className="ml-auto text-zinc-500">
            {pagination.total.toLocaleString()} total event
            {pagination.total === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Logs Table */}
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                <th className="w-8 px-3 py-3" />
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">Outcome</th>
                <th className="px-4 py-3">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-sm text-zinc-500"
                  >
                    Loading audit events...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-sm text-zinc-500"
                  >
                    No audit log entries match the current filters.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const isExpanded = expandedId === log.id;
                  return (
                    <React.Fragment key={log.id}>
                      <tr
                        onClick={() =>
                          setExpandedId(isExpanded ? null : log.id)
                        }
                        className="cursor-pointer transition-colors hover:bg-zinc-50/80"
                      >
                        <td className="px-3 py-3.5 text-zinc-400">
                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${
                              isExpanded ? "rotate-180 text-zinc-700" : ""
                            }`}
                          />
                        </td>

                        <td className="whitespace-nowrap px-4 py-3.5 text-xs text-zinc-600">
                          {formatTimestamp(log.createdAt)}
                        </td>

                        <td className="px-4 py-3.5">
                          <p className="font-medium text-zinc-900">
                            {log.actorName}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {log.actorEmail}{" "}
                            <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-600">
                              {log.actorRole}
                            </span>
                          </p>
                        </td>

                        <td className="px-4 py-3.5">
                          <span className="rounded-md bg-zinc-100 px-2 py-1 font-mono text-xs text-zinc-800">
                            {log.action}
                          </span>
                          {log.requiredPermission && (
                            <p className="mt-1 font-mono text-[11px] text-zinc-400">
                              perm: {log.requiredPermission}
                            </p>
                          )}
                        </td>

                        <td className="px-4 py-3.5">
                          {log.targetType || log.targetLabel ? (
                            <div>
                              <span className="text-xs font-medium text-zinc-700">
                                {log.targetType ?? "Target"}
                              </span>
                              {log.targetLabel && (
                                <p className="max-w-[200px] truncate text-xs text-zinc-500">
                                  {log.targetLabel}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-zinc-400">—</span>
                          )}
                        </td>

                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                              OUTCOME_STYLES[log.outcome]
                            }`}
                          >
                            {log.outcome}
                          </span>
                        </td>

                        <td className="whitespace-nowrap px-4 py-3.5 font-mono text-xs text-zinc-500">
                          {log.ipAddress ?? "—"}
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="bg-zinc-50/90">
                          <td colSpan={7} className="px-6 py-4">
                            <div className="space-y-4">
                              {/* Request Metadata */}
                              <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-xs">
                                <div>
                                  <span className="text-zinc-400">Request: </span>
                                  <span className="font-mono text-zinc-800">
                                    {log.method ?? "—"} {log.path ?? "—"}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-zinc-400">Status: </span>
                                  <span className="font-mono text-zinc-800">
                                    {log.statusCode ?? "—"}
                                  </span>
                                </div>
                                {log.targetId && (
                                  <div>
                                    <span className="text-zinc-400">
                                      Target ID:{" "}
                                    </span>
                                    <span className="font-mono text-zinc-800">
                                      {log.targetId}
                                    </span>
                                  </div>
                                )}
                                {log.userAgent && (
                                  <div className="w-full truncate text-zinc-500">
                                    <span className="text-zinc-400">
                                      User-Agent:{" "}
                                    </span>
                                    {log.userAgent}
                                  </div>
                                )}
                              </div>

                              {log.errorMessage && (
                                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                                  <span className="font-semibold">Error: </span>
                                  {log.errorMessage}
                                </div>
                              )}

                              {/* Before / After Diff */}
                              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                <div>
                                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                                    Before State
                                  </p>
                                  <pre className="max-h-60 overflow-auto rounded-lg border border-zinc-200 bg-zinc-950 p-3 font-mono text-xs text-zinc-200">
                                    {log.changes?.before !== null &&
                                    log.changes?.before !== undefined
                                      ? JSON.stringify(
                                          log.changes.before,
                                          null,
                                          2,
                                        )
                                      : "null"}
                                  </pre>
                                </div>

                                <div>
                                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                                    After State
                                  </p>
                                  <pre className="max-h-60 overflow-auto rounded-lg border border-zinc-200 bg-zinc-950 p-3 font-mono text-xs text-emerald-300">
                                    {log.changes?.after !== null &&
                                    log.changes?.after !== undefined
                                      ? JSON.stringify(
                                          log.changes.after,
                                          null,
                                          2,
                                        )
                                      : "null"}
                                  </pre>
                                </div>
                              </div>

                              {log.metadata && (
                                <div>
                                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                                    Metadata
                                  </p>
                                  <pre className="max-h-40 overflow-auto rounded-lg border border-zinc-200 bg-white p-3 font-mono text-xs text-zinc-700">
                                    {JSON.stringify(log.metadata, null, 2)}
                                  </pre>
                                </div>
                              )}
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

        {/* Pagination Footer */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-zinc-200 bg-zinc-50/70 px-4 py-3 text-xs text-zinc-600">
          <div className="flex items-center gap-3">
            <span>
              Showing <strong className="text-zinc-900">{startItem}</strong>–
              <strong className="text-zinc-900">{endItem}</strong> of{" "}
              <strong className="text-zinc-900">{pagination.total}</strong>
            </span>

            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              aria-label="Rows per page"
              className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700"
            >
              <option value={10}>10 / page</option>
              <option value={20}>20 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={!pagination.hasPrev || loading}
              onClick={() => setPage(1)}
              aria-label="First page"
              className="rounded-md border border-zinc-300 bg-white p-1.5 text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>

            <button
              type="button"
              disabled={!pagination.hasPrev || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="Previous page"
              className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Prev
            </button>

            <span className="px-2.5 font-medium text-zinc-800">
              Page {pagination.page} of {pagination.totalPages}
            </span>

            <button
              type="button"
              disabled={!pagination.hasNext || loading}
              onClick={() =>
                setPage((p) => Math.min(pagination.totalPages, p + 1))
              }
              aria-label="Next page"
              className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              disabled={!pagination.hasNext || loading}
              onClick={() => setPage(pagination.totalPages)}
              aria-label="Last page"
              className="rounded-md border border-zinc-300 bg-white p-1.5 text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}