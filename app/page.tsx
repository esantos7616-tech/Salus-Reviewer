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
  created_by?: string;
  corrective_action_count?: number;
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

const AUTO_REFRESH_MS = 5 * 60 * 1000;

function getProblemDescription(form: FormInstance): { title: string; detail: string; severity: "high" | "medium" | "low" } {
  const status = (form.status || "").toLowerCase();
  const hasCorrectiveActions = (form.corrective_action_count ?? 0) > 0;
  const notSubmitted = !form.submitted_by;
  const person = form.submitted_by || form.created_by || "Unknown person";

  if (hasCorrectiveActions) {
    return {
      title: `${form.corrective_action_count} Open Corrective Action${(form.corrective_action_count ?? 0) > 1 ? "s" : ""}`,
      detail: `This form has open corrective actions that must be resolved before it can be considered complete.`,
      severity: "high",
    };
  }
  if (status === "draft" && notSubmitted) {
    const creator = form.created_by || "Someone";
    return {
      title: "Started but Never Submitted",
      detail: `${creator} started this form but never completed or signed off on it. They need to reopen it in SALUS and submit.`,
      severity: "high",
    };
  }
  if (status === "draft") {
    return {
      title: "Draft — Not Fully Completed",
      detail: `${person} has this form saved as a draft. It has not been submitted or signed off yet.`,
      severity: "high",
    };
  }
  if (notSubmitted) {
    return {
      title: "Missing Signature",
      detail: `This form was created but has no recorded submission. No one has signed off on it.`,
      severity: "medium",
    };
  }
  if (status === "in_progress") {
    return {
      title: "In Progress — Not Submitted",
      detail: `${person} has started this form but has not yet submitted it.`,
      severity: "medium",
    };
  }
  return {
    title: "Incomplete",
    detail: `This form is missing required information or has not been fully completed.`,
    severity: "low",
  };
}

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
  const [selectedForm, setSelectedForm] = useState<FormInstance | null>(null);
  const prevDataRef = useRef<DashboardData | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const addToast = useCallback((message: string, type: Toast["type"]) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  }, []);

  const dismissToast = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const detectChanges = useCallback((newData: DashboardData) => {
    const prev = prevDataRef.current;
    if (!prev) return;
    const prevIds = new Set(prev.forms.map((f) => f.id));
    const prevCompleteIds = new Set(prev.forms.filter((f) => f.analysis.isComplete).map((f) => f.id));
    const prevFlaggedIds = new Set(prev.flagged.map((f) => f.id));
    const newlyCompleted = newData.forms.filter((f) => f.analysis.isComplete && prevIds.has(f.id) && !prevCompleteIds.has(f.id));
    if (newlyCompleted.length > 0) addToast(`✓ ${newlyCompleted.length} form${newlyCompleted.length > 1 ? "s" : ""} just completed!`, "success");
    const newlyFlagged = newData.flagged.filter((f) => !prevFlaggedIds.has(f.id));
    if (newlyFlagged.length > 0) addToast(`⚑ ${newlyFlagged.length} form${newlyFlagged.length > 1 ? "s" : ""} flagged as incomplete`, "warning");
    const newSubmissions = newData.forms.filter((f) => !prevIds.has(f.id));
    if (newSubmissions.length > 0) addToast(`📋 ${newSubmissions.length} new form${newSubmissions.length > 1 ? "s" : ""} submitted`, "info");
  }, [addToast]);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const statusRes = await fetch("/api/salus/status");
      const statusData = await statusRes.json();
      if (!statusData.configured) { setConfigured(false); setLoading(false); return; }
    } catch { setConfigured(false); setLoading(false); return; }

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

  useEffect(() => { fetchData(); }, [fetchData]);

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

  const handleDownloadExcel = async () => {
    setDownloading(true);
    try {
      const res = await fetch("/api/export");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `SALUS-Report-${new Date().toISOString().split("T")[0]}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      addToast("✓ Excel report downloaded!", "success");
    } catch { addToast("Failed to download report. Try again.", "warning"); }
    finally { setDownloading(false); }
  };

  const filteredCompanies = data
    ? Object.entries(data.byCompany).filter(([, company]) => !search || company.name.toLowerCase().includes(search.toLowerCase()))
    : [];

  const formatCountdown = (ms: number) => {
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const statusBadge = (form: FormInstance) => {
    if (form.analysis.status === "complete") return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">✓ Complete</span>
    );
    if (form.analysis.status === "incomplete") return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">⚑ Incomplete</span>
    );
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">○ Pending</span>;
  };

  if (!configured) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] px-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700 p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🔑</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">API Credentials Required</h2>
          <p className="text-gray-500 mb-6 text-sm">Add your SALUS API credentials to continue.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-80">
        {toasts.map((toast) => (
          <div key={toast.id} className={`flex items-start gap-3 rounded-xl shadow-lg px-4 py-3 text-sm font-medium border transition-all ${
            toast.type === "success" ? "bg-green-50 border-green-300 text-green-800"
            : toast.type === "warning" ? "bg-red-50 border-red-300 text-red-800"
            : "bg-blue-50 border-blue-300 text-blue-800"}`}>
            <span className="flex-1">{toast.message}</span>
            <button onClick={() => dismissToast(toast.id)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
          </div>
        ))}
      </div>

      {/* Form Detail Panel */}
      {selectedForm && (() => {
        const problem = getProblemDescription(selectedForm);
        const severityColor = problem.severity === "high" ? "red" : problem.severity === "medium" ? "yellow" : "orange";
        return (
          <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-4 bg-black/40" onClick={() => setSelectedForm(null)}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className={`px-6 py-4 bg-${severityColor}-50 border-b border-${severityColor}-200 flex items-start justify-between gap-4`}>
                <div>
                  <p className={`text-xs font-bold uppercase tracking-wide text-${severityColor}-600 mb-1`}>⚑ Flagged Form</p>
                  <h2 className="text-lg font-bold text-gray-900">{selectedForm.form_template_name}</h2>
                </div>
                <button onClick={() => setSelectedForm(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none mt-0.5">×</button>
              </div>
              {/* Problem */}
              <div className={`mx-6 mt-5 mb-4 bg-${severityColor}-50 border border-${severityColor}-200 rounded-xl p-4`}>
                <p className={`font-bold text-${severityColor}-800 mb-1`}>🔍 {problem.title}</p>
                <p className={`text-sm text-${severityColor}-700`}>{problem.detail}</p>
              </div>
              {/* Details */}
              <div className="px-6 pb-6 space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                    <p className="text-xs text-gray-400 dark:text-gray-500 font-medium mb-0.5">SITE</p>
                    <p className="font-semibold text-gray-800 dark:text-gray-100">{selectedForm.site_name || "—"}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                    <p className="text-xs text-gray-400 dark:text-gray-500 font-medium mb-0.5">STATUS</p>
                    <p className="font-semibold text-gray-800 capitalize">{selectedForm.status || "—"}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                    <p className="text-xs text-gray-400 dark:text-gray-500 font-medium mb-0.5">SUBMITTED BY</p>
                    <p className="font-semibold text-gray-800 dark:text-gray-100">{selectedForm.submitted_by || "Not submitted"}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                    <p className="text-xs text-gray-400 dark:text-gray-500 font-medium mb-0.5">CREATED BY</p>
                    <p className="font-semibold text-gray-800 dark:text-gray-100">{selectedForm.created_by || "—"}</p>
                  </div>
                  {(selectedForm.corrective_action_count ?? 0) > 0 && (
                    <div className="col-span-2 bg-red-50 border border-red-200 rounded-lg p-3">
                      <p className="text-xs text-red-500 font-medium mb-0.5">CORRECTIVE ACTIONS</p>
                      <p className="font-bold text-red-700">{selectedForm.corrective_action_count} open action{(selectedForm.corrective_action_count ?? 0) > 1 ? "s" : ""} required</p>
                    </div>
                  )}
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                    <p className="text-xs text-gray-400 dark:text-gray-500 font-medium mb-0.5">LAST UPDATED</p>
                    <p className="font-semibold text-gray-800 dark:text-gray-100">{selectedForm.updated_at ? new Date(selectedForm.updated_at).toLocaleDateString() : "—"}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                    <p className="text-xs text-gray-400 dark:text-gray-500 font-medium mb-0.5">CREATED</p>
                    <p className="font-semibold text-gray-800 dark:text-gray-100">{selectedForm.created_at ? new Date(selectedForm.created_at).toLocaleDateString() : "—"}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-400 text-center pt-2">Tap outside to close</p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Document Review Dashboard</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />Live
            </span>
            {lastRefresh && (
              <span className="text-xs text-gray-400">Updated {lastRefresh.toLocaleTimeString()} · next in {formatCountdown(nextRefreshIn)}</span>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={handleDownloadExcel} disabled={downloading || !data}
            className="inline-flex items-center gap-2 bg-green-700 text-white px-4 py-2.5 rounded-lg font-medium text-sm hover:bg-green-800 transition-colors disabled:opacity-50">
            {downloading ? "Generating..." : "↓ Excel Report"}
          </button>
          <button onClick={() => fetchData()} disabled={loading}
            className="inline-flex items-center gap-2 bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium text-sm hover:bg-blue-800 transition-colors disabled:opacity-50">
            {loading ? <><span className="animate-spin">⟳</span> Refreshing...</> : <>⟳ Refresh Now</>}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <span className="text-red-500 text-lg mt-0.5">⚠</span>
          <div>
            <p className="font-semibold text-red-800">Error loading data</p>
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
            <p className="text-sm text-gray-500 font-medium mb-1">Total Documents</p>
            <p className="text-4xl font-bold text-gray-900 dark:text-white">{data.summary.total}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-green-200 dark:border-gray-700 p-6 shadow-sm">
            <p className="text-sm text-green-600 font-medium mb-1">Completed</p>
            <p className="text-4xl font-bold text-green-700">{data.summary.complete}</p>
            <div className="mt-2 h-1.5 bg-green-100 rounded-full">
              <div className="h-1.5 bg-green-500 rounded-full transition-all"
                style={{ width: `${data.summary.total > 0 ? (data.summary.complete / data.summary.total) * 100 : 0}%` }} />
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-red-200 dark:border-gray-700 p-6 shadow-sm">
            <p className="text-sm text-red-600 font-medium mb-1">Flagged / Incomplete</p>
            <p className="text-4xl font-bold text-red-700">{data.summary.incomplete}</p>
            <div className="mt-2 h-1.5 bg-red-100 rounded-full">
              <div className="h-1.5 bg-red-500 rounded-full transition-all"
                style={{ width: `${data.summary.total > 0 ? (data.summary.incomplete / data.summary.total) * 100 : 0}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* Flagged Banner — clickable */}
      {data && data.flagged.length > 0 && (
        <div className="bg-red-50 dark:bg-gray-800 border border-red-300 dark:border-gray-700 border-l-4 dark:border-l-red-500 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-red-600 font-bold text-lg">⚑</span>
            <p className="font-semibold text-red-800">
              {data.flagged.length} document{data.flagged.length !== 1 ? "s" : ""} flagged — click any to see the problem
            </p>
          </div>
          <div className="space-y-2">
            {data.flagged.slice(0, 8).map((form) => {
              const problem = getProblemDescription(form);
              return (
                <button key={form.id} onClick={() => setSelectedForm(form)}
                  className="w-full text-left bg-white dark:bg-gray-700 border border-red-200 dark:border-gray-600 hover:border-red-400 dark:hover:border-red-500 hover:bg-red-50 dark:hover:bg-gray-600 rounded-lg px-4 py-3 transition-all group">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-red-800 truncate">{form.form_template_name}</p>
                      <p className="text-xs text-red-500 truncate">
                        {form.site_name || form.company_name || "—"} · {problem.title}
                      </p>
                    </div>
                    <span className="text-red-400 group-hover:text-red-600 text-sm shrink-0">View →</span>
                  </div>
                </button>
              );
            })}
            {data.flagged.length > 8 && (
              <p className="text-sm text-red-500 font-medium text-center pt-1">+ {data.flagged.length - 8} more flagged</p>
            )}
          </div>
        </div>
      )}

      {/* All complete banner */}
      {data && data.summary.incomplete === 0 && data.summary.total > 0 && (
        <div className="bg-green-50 border border-green-300 rounded-xl p-4 mb-6 flex items-center gap-3">
          <span className="text-2xl">🎉</span>
          <p className="font-semibold text-green-800">All {data.summary.total} documents are complete — great work!</p>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input type="text" placeholder="Search project..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500" />
        <div className="flex gap-2">
          {(["all", "complete", "incomplete"] as FilterStatus[]).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium capitalize transition-colors ${
                filter === f ? "bg-blue-700 text-white" : "bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && !data && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-3" />
              <div className="h-3 bg-gray-100 dark:bg-gray-600 rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* No Data */}
      {!loading && data && data.summary.total === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <p className="text-5xl mb-4">📋</p>
          <p className="text-xl font-semibold text-gray-700 dark:text-gray-200">No documents found</p>
          <p className="text-gray-400 text-sm mt-2">No form instances returned from SALUS.</p>
        </div>
      )}

      {/* Company Groups */}
      {!loading && filteredCompanies.length > 0 && (
        <div className="space-y-4">
          {filteredCompanies.map(([companyId, company]) => {
            const isExpanded = expandedCompany === companyId;
            const completionPct = company.total > 0 ? Math.round((company.complete / company.total) * 100) : 0;
            const visibleForms = filter === "all" ? company.forms
              : company.forms.filter((f) => filter === "complete" ? f.analysis.isComplete : !f.analysis.isComplete);
            if (visibleForms.length === 0) return null;
            return (
              <div key={companyId} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                <button onClick={() => setExpandedCompany(isExpanded ? null : companyId)}
                  className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                      {company.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">{company.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{company.total} document{company.total !== 1 ? "s" : ""} · {company.complete} complete · {company.incomplete} incomplete</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="hidden sm:flex items-center gap-2">
                      <div className="w-24 h-2 bg-gray-100 rounded-full">
                        <div className={`h-2 rounded-full transition-all ${completionPct === 100 ? "bg-green-500" : completionPct >= 50 ? "bg-yellow-500" : "bg-red-500"}`}
                          style={{ width: `${completionPct}%` }} />
                      </div>
                      <span className={`text-sm font-semibold ${completionPct === 100 ? "text-green-700" : completionPct >= 50 ? "text-yellow-700" : "text-red-700"}`}>
                        {completionPct}%
                      </span>
                    </div>
                    {company.incomplete > 0 && (
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-bold">⚑ {company.incomplete}</span>
                    )}
                    <span className="text-gray-400 dark:text-gray-500 text-sm">{isExpanded ? "▲" : "▼"}</span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-100 dark:border-gray-700">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-900 text-xs text-gray-500 dark:text-gray-400 uppercase">
                        <tr>
                          <th className="text-left px-6 py-3 font-medium">Form Name</th>
                          <th className="text-left px-6 py-3 font-medium hidden sm:table-cell">Site</th>
                          <th className="text-left px-6 py-3 font-medium hidden md:table-cell">Submitted By</th>
                          <th className="text-left px-6 py-3 font-medium hidden lg:table-cell">Date</th>
                          <th className="text-left px-6 py-3 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {visibleForms.map((form) => (
                          <tr key={form.id}
                            onClick={() => !form.analysis.isComplete ? setSelectedForm(form) : undefined}
                            className={`transition-colors ${!form.analysis.isComplete ? "bg-red-50/30 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer" : "hover:bg-gray-50 dark:hover:bg-gray-700"}`}>
                            <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">
                              {form.form_template_name || "Unnamed Form"}
                              {!form.analysis.isComplete && (
                                <p className="text-xs text-red-500 mt-0.5">{getProblemDescription(form).title}</p>
                              )}
                            </td>
                            <td className="px-6 py-4 text-gray-500 dark:text-gray-400 hidden sm:table-cell">{form.site_name || "—"}</td>
                            <td className="px-6 py-4 text-gray-500 dark:text-gray-400 hidden md:table-cell">{form.submitted_by || form.created_by || "—"}</td>
                            <td className="px-6 py-4 text-gray-500 dark:text-gray-400 hidden lg:table-cell">
                              {form.updated_at ? new Date(form.updated_at).toLocaleDateString() : "—"}
                            </td>
                            <td className="px-6 py-4">{statusBadge(form)}</td>
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
