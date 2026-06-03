"use client";

import { useState, useEffect } from "react";

interface FormInstance {
  id: string;
  form_template_name: string;
  site_name?: string;
  submitted_by?: string;
  created_by?: string;
  updated_at: string;
  created_at: string;
  status: string;
  analysis: { isComplete: boolean };
}

interface RequiredForm {
  name: string;
  keywords: string[];
  frequency: "daily" | "weekly" | "monthly" | "once";
}

// Required forms by frequency — matched against SALUS form names
const REQUIRED_FORMS: RequiredForm[] = [
  { name: "Daily JSA / Toolbox Talk", keywords: ["jsa", "toolbox", "flra", "ssha"], frequency: "daily" },
  { name: "Daily Commissioning Report", keywords: ["commissioning progress", "daily commissioning"], frequency: "daily" },
  { name: "Vehicle & Trailer Inspection", keywords: ["vehicle", "trailer", "inspection"], frequency: "daily" },
  { name: "Weekly Construction Report", keywords: ["weekly construction", "weekly report"], frequency: "weekly" },
  { name: "Site Safety Inspection", keywords: ["site safety inspection"], frequency: "weekly" },
  { name: "Contractor Safety Evaluation", keywords: ["contractor safety", "evaluation checklist"], frequency: "monthly" },
  { name: "Training Record", keywords: ["training record"], frequency: "monthly" },
  { name: "Health & Safety Orientation", keywords: ["orientation", "h&s orientation"], frequency: "once" },
  { name: "Project Hazard Assessment", keywords: ["project hazard", "pha"], frequency: "once" },
];

function matchesRequired(formName: string, req: RequiredForm): boolean {
  const lower = formName.toLowerCase();
  return req.keywords.some((kw) => lower.includes(kw));
}

function isThisWeek(dateStr: string): boolean {
  const date = new Date(dateStr);
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  return date >= startOfWeek;
}

function isThisMonth(dateStr: string): boolean {
  const date = new Date(dateStr);
  const now = new Date();
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

function isToday(dateStr: string): boolean {
  const date = new Date(dateStr);
  const now = new Date();
  return date.toDateString() === now.toDateString();
}

function isCompliant(form: RequiredForm, submissions: FormInstance[]): {
  compliant: boolean;
  lastSubmission?: FormInstance;
  submittedBy?: string;
  submittedAt?: string;
} {
  const matches = submissions.filter((s) => matchesRequired(s.form_template_name, form) && s.analysis.isComplete);
  if (matches.length === 0) return { compliant: false };

  const sorted = matches.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  const latest = sorted[0];

  let compliant = false;
  if (form.frequency === "daily") compliant = isToday(latest.updated_at);
  else if (form.frequency === "weekly") compliant = isThisWeek(latest.updated_at);
  else if (form.frequency === "monthly") compliant = isThisMonth(latest.updated_at);
  else if (form.frequency === "once") compliant = true;

  return {
    compliant,
    lastSubmission: latest,
    submittedBy: latest.submitted_by || latest.created_by,
    submittedAt: latest.updated_at,
  };
}

interface ProjectCompliance {
  siteName: string;
  forms: {
    required: RequiredForm;
    compliant: boolean;
    submittedBy?: string;
    submittedAt?: string;
  }[];
  compliantCount: number;
  totalRequired: number;
}

export default function WorkflowPage() {
  const [projects, setProjects] = useState<ProjectCompliance[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [filter, setFilter] = useState<"all" | "issues">("all");
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [activeFreq, setActiveFreq] = useState<"all" | "daily" | "weekly" | "monthly" | "once">("all");

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch("/api/salus/forms");
      const data = await res.json();
      const forms: FormInstance[] = data?.forms ?? [];

      // Group forms by site
      const bySite = new Map<string, FormInstance[]>();
      for (const form of forms) {
        const site = form.site_name || "Unknown Site";
        if (!bySite.has(site)) bySite.set(site, []);
        bySite.get(site)!.push(form);
      }

      // Build compliance per project
      const result: ProjectCompliance[] = [];
      for (const [siteName, siteForms] of Array.from(bySite.entries())) {
        const formStatuses = REQUIRED_FORMS.map((req) => {
          const status = isCompliant(req, siteForms);
          return { required: req, ...status };
        });

        // Only show projects that have at least some activity
        const hasActivity = siteForms.length > 0;
        if (!hasActivity) continue;

        const compliantCount = formStatuses.filter((f) => f.compliant).length;
        result.push({ siteName, forms: formStatuses, compliantCount, totalRequired: REQUIRED_FORMS.length });
      }

      // Sort by compliance % ascending (worst first)
      result.sort((a, b) => (a.compliantCount / a.totalRequired) - (b.compliantCount / b.totalRequired));
      setProjects(result);
      setLastRefresh(new Date());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  const filtered = filter === "issues"
    ? projects.filter((p) => p.compliantCount < p.totalRequired)
    : projects;

  const freqLabel: Record<string, string> = { daily: "Daily", weekly: "Weekly", monthly: "Monthly", once: "One-time" };
  const freqColor: Record<string, string> = {
    daily: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300",
    weekly: "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300",
    monthly: "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300",
    once: "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300",
  };

  if (loading) return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-3">
      {[1,2,3].map(i => (
        <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-2" />
          <div className="h-3 bg-gray-100 dark:bg-gray-600 rounded w-1/2" />
        </div>
      ))}
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Safety Requirements Workflow</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Live compliance tracking per project — auto-detected from SALUS
            {lastRefresh && ` · Updated ${lastRefresh.toLocaleTimeString()}`}
          </p>
        </div>
        <button onClick={loadData}
          className="inline-flex items-center gap-2 bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium text-sm hover:bg-blue-800 transition-colors">
          ⟳ Refresh
        </button>
      </div>

      {/* Summary pills */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-4 py-2 text-sm font-semibold text-green-800 dark:text-green-400">
          ✓ {projects.filter(p => p.compliantCount === p.totalRequired).length} fully compliant
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-2 text-sm font-semibold text-red-800 dark:text-red-400">
          ⚑ {projects.filter(p => p.compliantCount < p.totalRequired).length} have missing forms
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-2 text-sm font-semibold text-blue-800 dark:text-blue-400">
          📋 {projects.length} active projects
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button onClick={() => setFilter("all")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === "all" ? "bg-blue-700 text-white" : "bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"}`}>
          All Projects
        </button>
        <button onClick={() => setFilter("issues")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === "issues" ? "bg-red-600 text-white" : "bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"}`}>
          ⚑ Issues Only
        </button>
        <div className="w-px bg-gray-200 dark:bg-gray-700 mx-1" />
        {(["all", "daily", "weekly", "monthly", "once"] as const).map((freq) => (
          <button key={freq} onClick={() => setActiveFreq(freq)}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors capitalize ${activeFreq === freq ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900" : "bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300"}`}>
            {freq === "all" ? "All Types" : freqLabel[freq]}
          </button>
        ))}
      </div>

      {/* Projects */}
      <div className="space-y-4">
        {filtered.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-10 text-center">
            <p className="text-4xl mb-3">✓</p>
            <p className="font-semibold text-gray-700 dark:text-gray-200">All projects are compliant!</p>
          </div>
        )}
        {filtered.map((project) => {
          const pct = Math.round((project.compliantCount / project.totalRequired) * 100);
          const isExpanded = expandedProject === project.siteName;
          const visibleForms = activeFreq === "all"
            ? project.forms
            : project.forms.filter(f => f.required.frequency === activeFreq);

          return (
            <div key={project.siteName} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
              {/* Project header */}
              <button onClick={() => setExpandedProject(isExpanded ? null : project.siteName)}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left">
                <div className="flex items-center gap-4 min-w-0">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0 ${pct === 100 ? "bg-green-600" : pct >= 60 ? "bg-yellow-500" : "bg-red-500"}`}>
                    {pct}%
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white truncate">
                      {project.siteName.replace(/^[^\w\d(]+/, "")}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {project.compliantCount} of {project.totalRequired} requirements met
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="hidden sm:flex items-center gap-2">
                    <div className="w-24 h-2 bg-gray-100 dark:bg-gray-700 rounded-full">
                      <div className={`h-2 rounded-full transition-all ${pct === 100 ? "bg-green-500" : pct >= 60 ? "bg-yellow-500" : "bg-red-500"}`}
                        style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  {project.compliantCount < project.totalRequired && (
                    <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full text-xs font-bold">
                      ⚑ {project.totalRequired - project.compliantCount} missing
                    </span>
                  )}
                  <span className="text-gray-400 dark:text-gray-500 text-sm">{isExpanded ? "▲" : "▼"}</span>
                </div>
              </button>

              {/* Expanded form list */}
              {isExpanded && (
                <div className="border-t border-gray-100 dark:border-gray-700">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-900 text-xs text-gray-500 dark:text-gray-400 uppercase">
                      <tr>
                        <th className="text-left px-6 py-3 font-medium">Required Form</th>
                        <th className="text-left px-6 py-3 font-medium hidden sm:table-cell">Frequency</th>
                        <th className="text-left px-6 py-3 font-medium hidden md:table-cell">Last Submitted By</th>
                        <th className="text-left px-6 py-3 font-medium hidden lg:table-cell">Date</th>
                        <th className="text-left px-6 py-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {visibleForms.map((f) => (
                        <tr key={f.required.name}
                          className={`transition-colors ${f.compliant ? "hover:bg-gray-50 dark:hover:bg-gray-700" : "bg-red-50/30 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20"}`}>
                          <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">{f.required.name}</td>
                          <td className="px-6 py-4 hidden sm:table-cell">
                            <span className={`inline-block px-2 py-0.5 rounded-lg text-xs font-medium ${freqColor[f.required.frequency]}`}>
                              {freqLabel[f.required.frequency]}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-gray-500 dark:text-gray-400 hidden md:table-cell">
                            {f.submittedBy ?? "—"}
                          </td>
                          <td className="px-6 py-4 text-gray-500 dark:text-gray-400 hidden lg:table-cell">
                            {f.submittedAt ? new Date(f.submittedAt).toLocaleDateString() : "Never"}
                          </td>
                          <td className="px-6 py-4">
                            {f.compliant ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400">✓ Up to date</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400">
                                ⚑ {f.submittedAt ? "Overdue" : "Never submitted"}
                              </span>
                            )}
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
    </div>
  );
}
