"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface FormAnalysis {
  isComplete: boolean;
  completionPercentage: number;
  missingFields: string[];
  status: "complete" | "incomplete" | "pending";
}

interface FormInstance {
  id: string;
  form_template_name: string;
  company_name: string;
  site_name?: string;
  status: string;
  created_at: string;
  updated_at: string;
  submitted_by?: string;
  analysis: FormAnalysis;
}

interface CompanyGroup {
  name: string;
  total: number;
  complete: number;
  incomplete: number;
  forms: FormInstance[];
}

interface DashboardData {
  summary: { total: number; complete: number; incomplete: number };
  byCompany: Record<string, CompanyGroup>;
  flagged: FormInstance[];
  forms: FormInstance[];
}

type FilterStatus = "all" | "complete" | "incomplete";

interface Toast {
  id: string;
  message: string;
  type: "success" | "warning" | "info";
}

const AUTO_REFRESH_MS = 5 * 60 * 1000; // 5 minutes

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [configured, setConfigured] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [search, setSearch] = useState("");
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [nextRefreshIn, setNextRefreshIn] = useState<number>(AUTO_REFRESH_MS);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [downloading, setDownloading] = useState(false);
  const prevDataRef = useRef<DashboardData | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Toast helpers ────────────────────────────────────────────────────
  const addToast = useCallback((message: string, type: Toast["type"]) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  }, []);

  const dismissToast = (id: string) =>
    setToasts((prev) => prev.filter((t) => t.id !== id));

  // ── Detect changes and fire toasts ──────────────────────────────────
  const detectChanges = useCallback(
    (newData: DashboardData) => {
      const prev = prevDataRef.current;
      if (!prev) return;

      const prevIds = new Set(prev.forms.map((f) => f.id));
      const prevCompleteIds = new Set(
        prev.forms.filter((f) => f.analysis.isComplete).map((f) => f.id)
      );
      const prevFlaggedIds = new Set(prev.flagged.map((f) => f.id));

      // Newly completed forms
      const newlyCompleted = newData.forms.filter(
        (f) => f.analysis.isComplete && prevIds.has(f.id) && !prevCompleteIds.has(f.id)
      );
      if (newlyCompleted.length > 0) {
        addToast(
          `✓ ${newlyCompleted.length} form${newlyCompleted.length > 1 ? "s" : ""} just completed!`,
          "success"
        );
      }

      // Newly flagged forms
      const newlyFlagged = newData.flagged.filter((f) => !prevFlaggedIds.has(f.id));
      if (newlyFlagged.length > 0) {
        addToast(
          `⚑ ${newlyFlagged.length} form${newlyFlagged.length > 1 ? "s" : ""} flagged as incomplete`,
          "warning"
        );
      }

      // New forms submitted
      const newSubmissions = newData.forms.filter((f) => !prevIds.has(f.id));
      if (newSubmissions.length > 0) {
        addToast(`📋 ${newSubmissions.length} new form${newSubmissions.length > 1 ? "s" : ""} submitted`, "info");
      }
    },
    [addToast]
  );

  // ── Main fetch ────────────────────────────────────────────────────────
  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);

    try {
      const statusRes = await fetch("/api/salus/status");
      const statusData = await statusRes.json();
      if (!statusData.configured) {
        setConfigured(false);
        setLoading(false);
        return;
      }
    } catch {
      setConfigured(false);
      setLoading(false);
      return;
    }

    try {
      const query = filter !== "all" ? `?status=${filter}` : "";
      const res = await fetch(`/api/salus/forms${query}`);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);

      detectChanges(json);
      prevDataRef.current = json;
      setData(json);
      setLastRefresh(new Date());
      setNextRefreshIn(AUTO_REFRESH_MS);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [filter, detectChanges]);

  // ── Auto-refresh every 5 minutes ─────────────────────────────────────
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);

    refreshTimerRef.current = setTimeout(() => fetchData(true), AUTO_REFRESH_MS);

    let remaining = AUTO_REFRESH_MS;
    countdownRef.current = setInterval(() => {
      remaining -= 1000;
      setNextRefreshIn(remaining > 0 ? remaining : 0);
    }, 1000);

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [lastRefresh, fetchData]);

  // ── Excel download ────────────────────────────────────────────────────
  const handleDownloadExcel = async () => {
    setDownloading(true);
    try {
      const res = await fetch("/api/export");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const dateStr = new Date().toISOString().split("T")[0];
      a.download = `SALUS-Report-${dateStr}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      addToast("✓ Excel report downloaded!", "success");
    } catch {
      addToast("Failed to download report. Try again.", "warning");
    } finally {
      setDownloading(false);
    }
  };

  const filteredCompanies = data
    ? Object.entries(data.byCompany).filter(([, company]) => {
        if (!search) return true;
        return company.name.toLowerCase().includes(search.toLowerCase());
      })
    : [];

  const statusBadge = (form: FormInstance) => {
    if (form.analysis.status === "complete") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          ✓ Complete
        </span>
      );
    }
    if (form.analysis.status === "incomplete") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          ⚑ Incomplete
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
        ○ Pending
      </span>
    );
  };

  const formatCountdown = (ms: number) => {
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // ── Not configured screen ─────────────────────────────────────────────
  if (!configured) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] px-4">
        <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🔑</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">API Credentials Required</h2>
          <p className="text-gray-500 mb-6 text-sm">
            To connect to SALUS, add your API credentials in Netlify environment variables.
          </p>
          <a
            href="/settings"
            className="inline-block bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-800 transition-colors"
          >
            Go to Settings →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* ── Toast Notifications ──────────────────────────────────────── */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-80">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-start gap-3 rounded-xl shadow-lg px-4 py-3 text-sm font-medium border transition-all ${
              toast.type === "success"
                ? "bg-green-50 border-green-300 text-green-800"
                : toast.type === "warning"
                ? "bg-red-50 border-red-300 text-red-800"
                : "bg-blue-50 border-blue-300 text-blue-800"
            }`}
          >
            <span className="flex-1">{toast.message}</span>
            <button
              onClick={() => dismissToast(toast.id)}
              className="text-gray-400 hover:text-gray-600 text-lg leading-none"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Document Review Dashboard</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Live
            </span>
            {lastRefresh && (
              <span className="text-xs text-gray-400">
                Updated {lastRefresh.toLocaleTimeString()} · next in {formatCountdown(nextRefreshIn)}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleDownloadExcel}
            disabled={downloading || !data}
            className="inline-flex items-center gap-2 bg-green-700 text-white px-4 py-2.5 rounded-lg font-medium text-sm hover:bg-green-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {downloading ? "Generating..." : "↓ Excel Report"}
          </button>
          <button
            onClick={() => fetchData()}
            disabled={loading}
            className="inline-flex items-center gap-2 bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium text-sm hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <><span className="animate-spin">⟳</span> Refreshing...</>
            ) : (
              <>⟳ Refresh Now</>
            )}
          </button>
        </div>
      </div>

      {/* ── Error State ──────────────────────────────────────────────── */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <span className="text-red-500 text-lg mt-0.5">⚠</span>
          <div>
            <p className="font-semibold text-red-800">Error loading data</p>
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* ── Summary Cards ─────────────────────────────────────────────── */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <p className="text-sm text-gray-500 font-medium mb-1">Total Documents</p>
            <p className="text-4xl font-bold text-gray-900">{data.summary.total}</p>
          </div>
          <div className="bg-white rounded-xl border border-green-200 p-6 shadow-sm">
            <p className="text-sm text-green-600 font-medium mb-1">Completed</p>
            <p className="text-4xl font-bold text-green-700">{data.summary.complete}</p>
            <div className="mt-2 h-1.5 bg-green-100 rounded-full">
              <div
                className="h-1.5 bg-green-500 rounded-full transition-all"
                style={{
                  width: `${data.summary.total > 0 ? (data.summary.complete / data.summary.total) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
          <div className="bg-white rounded-xl border border-red-200 p-6 shadow-sm">
            <p className="text-sm text-red-600 font-medium mb-1">Flagged / Incomplete</p>
            <p className="text-4xl font-bold text-red-700">{data.summary.incomplete}</p>
            <div className="mt-2 h-1.5 bg-red-100 rounded-full">
              <div
                className="h-1.5 bg-red-500 rounded-full transition-all"
                style={{
                  width: `${data.summary.total > 0 ? (data.summary.incomplete / data.summary.total) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Flagged Alert Banner ──────────────────────────────────────── */}
      {data && data.flagged.length > 0 && (
        <div className="bg-red-50 border border-red-300 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-red-600 font-bold text-lg">⚑</span>
            <p className="font-semibold text-red-800">
              {data.flagged.length} document{data.flagged.length !== 1 ? "s" : ""} flagged as incomplete
            </p>
          </div>
          <div className="space-y-1">
            {data.flagged.slice(0, 5).map((form) => (
              <p key={form.id} className="text-sm text-red-700">
                • <strong>{form.form_template_name}</strong> — {form.company_name}
                {form.site_name ? ` / ${form.site_name}` : ""}
                {form.analysis.missingFields.length > 0 && (
                  <span className="text-red-500 ml-1">
                    (Missing: {form.analysis.missingFields.slice(0, 2).join(", ")}
                    {form.analysis.missingFields.length > 2 ? "..." : ""})
                  </span>
                )}
              </p>
            ))}
            {data.flagged.length > 5 && (
              <p className="text-sm text-red-500 font-medium">
                + {data.flagged.length - 5} more flagged...
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── All-complete banner ───────────────────────────────────────── */}
      {data && data.summary.incomplete === 0 && data.summary.total > 0 && (
        <div className="bg-green-50 border border-green-300 rounded-xl p-4 mb-6 flex items-center gap-3">
          <span className="text-2xl">🎉</span>
          <p className="font-semibold text-green-800">
            All {data.summary.total} documents are complete — great work!
          </p>
        </div>
      )}

      {/* ── Filters ───────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          placeholder="Search company..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <div className="flex gap-2">
          {(["all", "complete", "incomplete"] as FilterStatus[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium capitalize transition-colors ${
                filter === f
                  ? "bg-blue-700 text-white"
                  : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* ── Loading Skeleton ──────────────────────────────────────────── */}
      {loading && !data && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* ── No Data ───────────────────────────────────────────────────── */}
      {!loading && data && data.summary.total === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-5xl mb-4">📋</p>
          <p className="text-xl font-semibold text-gray-700">No documents found</p>
          <p className="text-gray-400 text-sm mt-2">
            No form instances were returned from SALUS. Check your API credentials or try again.
          </p>
        </div>
      )}

      {/* ── Company Groups ────────────────────────────────────────────── */}
      {!loading && filteredCompanies.length > 0 && (
        <div className="space-y-4">
          {filteredCompanies.map(([companyId, company]) => {
            const isExpanded = expandedCompany === companyId;
            const completionPct =
              company.total > 0 ? Math.round((company.complete / company.total) * 100) : 0;

            const visibleForms =
              filter === "all"
                ? company.forms
                : company.forms.filter((f) =>
                    filter === "complete" ? f.analysis.isComplete : !f.analysis.isComplete
                  );

            if (visibleForms.length === 0) return null;

            return (
              <div
                key={companyId}
                className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
              >
                <button
                  onClick={() => setExpandedCompany(isExpanded ? null : companyId)}
                  className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                      {company.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{company.name}</p>
                      <p className="text-xs text-gray-500">
                        {company.total} document{company.total !== 1 ? "s" : ""} · {company.complete} complete · {company.incomplete} incomplete
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="hidden sm:flex items-center gap-2">
                      <div className="w-24 h-2 bg-gray-100 rounded-full">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            completionPct === 100
                              ? "bg-green-500"
                              : completionPct >= 50
                              ? "bg-yellow-500"
                              : "bg-red-500"
                          }`}
                          style={{ width: `${completionPct}%` }}
                        />
                      </div>
                      <span
                        className={`text-sm font-semibold ${
                          completionPct === 100
                            ? "text-green-700"
                            : completionPct >= 50
                            ? "text-yellow-700"
                            : "text-red-700"
                        }`}
                      >
                        {completionPct}%
                      </span>
                    </div>
                    {company.incomplete > 0 && (
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-bold">
                        ⚑ {company.incomplete}
                      </span>
                    )}
                    <span className="text-gray-400 text-sm">{isExpanded ? "▲" : "▼"}</span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-100">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                        <tr>
                          <th className="text-left px-6 py-3 font-medium">Form Name</th>
                          <th className="text-left px-6 py-3 font-medium hidden sm:table-cell">Site</th>
                          <th className="text-left px-6 py-3 font-medium hidden md:table-cell">Submitted By</th>
                          <th className="text-left px-6 py-3 font-medium hidden lg:table-cell">Date</th>
                          <th className="text-left px-6 py-3 font-medium">Status</th>
                          <th className="text-left px-6 py-3 font-medium hidden md:table-cell">Completion</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {visibleForms.map((form) => (
                          <tr
                            key={form.id}
                            className={`hover:bg-gray-50 transition-colors ${
                              !form.analysis.isComplete ? "bg-red-50/30" : ""
                            }`}
                          >
                            <td className="px-6 py-4 font-medium text-gray-900">
                              {form.form_template_name || "Unnamed Form"}
                              {form.analysis.missingFields.length > 0 && (
                                <p className="text-xs text-red-500 mt-0.5">
                                  Missing: {form.analysis.missingFields.slice(0, 2).join(", ")}
                                  {form.analysis.missingFields.length > 2 ? "..." : ""}
                                </p>
                              )}
                            </td>
                            <td className="px-6 py-4 text-gray-500 hidden sm:table-cell">
                              {form.site_name || "—"}
                            </td>
                            <td className="px-6 py-4 text-gray-500 hidden md:table-cell">
                              {form.submitted_by || "—"}
                            </td>
                            <td className="px-6 py-4 text-gray-500 hidden lg:table-cell">
                              {form.updated_at
                                ? new Date(form.updated_at).toLocaleDateString()
                                : "—"}
                            </td>
                            <td className="px-6 py-4">{statusBadge(form)}</td>
                            <td className="px-6 py-4 hidden md:table-cell">
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 bg-gray-200 rounded-full">
                                  <div
                                    className={`h-1.5 rounded-full ${
                                      form.analysis.completionPercentage === 100
                                        ? "bg-green-500"
                                        : form.analysis.completionPercentage >= 50
                                        ? "bg-yellow-500"
                                        : "bg-red-500"
                                    }`}
                                    style={{ width: `${form.analysis.completionPercentage}%` }}
                                  />
                                </div>
                                <span className="text-xs text-gray-500">
                                  {form.analysis.completionPercentage}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
