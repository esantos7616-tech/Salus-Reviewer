"use client";

import { useState, useEffect } from "react";

interface FormInstance {
  id: string;
  form_template_name: string;
  site_name?: string;
  submitted_by?: string;
  created_by?: string;
  updated_at: string;
  status: string;
  corrective_action_count?: number;
  analysis: { isComplete: boolean; completionPercentage: number; status: string };
}

interface PersonFormStatus {
  formName: string;
  submitted: boolean;
  complete: boolean;
  isDraft: boolean;
  noSignature: boolean;
  hasCorrectiveActions: boolean;
  correctiveCount: number;
  submittedAt?: string;
  problemLabel: string;
}

interface PersonStatus {
  name: string;
  sites: string[];
  forms: PersonFormStatus[];
  allDone: boolean;
  issueCount: number;
}

function getFormProblem(form: FormInstance): string {
  const status = (form.status || "").toLowerCase();
  const notSubmitted = !form.submitted_by;
  if ((form.corrective_action_count ?? 0) > 0) return `${form.corrective_action_count} corrective action${(form.corrective_action_count ?? 0) > 1 ? "s" : ""} open`;
  if (status === "draft" && notSubmitted) return "Started but not submitted";
  if (status === "draft") return "Draft — not signed off";
  if (notSubmitted) return "Missing signature";
  if (status === "in_progress") return "In progress — not submitted";
  return "Incomplete";
}

export default function PeoplePage() {
  const [personStatuses, setPersonStatuses] = useState<PersonStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSite, setSelectedSite] = useState<string>("all");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<PersonStatus | null>(null);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const res = await fetch("/api/salus/forms");
      const data = await res.json();
      const forms: FormInstance[] = data?.forms ?? [];

      const personMap = new Map<string, { sites: Set<string>; formsByName: Map<string, FormInstance[]> }>();

      for (const form of forms) {
        const people = new Set<string>();
        if (form.submitted_by) people.add(form.submitted_by);
        if (form.created_by && form.created_by !== form.submitted_by) people.add(form.created_by);

        for (const person of Array.from(people)) {
          if (!personMap.has(person)) personMap.set(person, { sites: new Set(), formsByName: new Map() });
          const entry = personMap.get(person)!;
          if (form.site_name) entry.sites.add(form.site_name);
          if (!entry.formsByName.has(form.form_template_name)) entry.formsByName.set(form.form_template_name, []);
          entry.formsByName.get(form.form_template_name)!.push(form);
        }
      }

      const statuses: PersonStatus[] = [];
      for (const [name, entry] of Array.from(personMap.entries())) {
        const formStatuses: PersonFormStatus[] = [];
        for (const [formName, instances] of Array.from(entry.formsByName.entries())) {
          const latest = instances.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];
          const isComplete = latest.analysis.isComplete;
          const isDraft = (latest.status || "").toLowerCase() === "draft";
          formStatuses.push({
            formName,
            submitted: !!latest.submitted_by,
            complete: isComplete,
            isDraft,
            noSignature: !latest.submitted_by,
            hasCorrectiveActions: (latest.corrective_action_count ?? 0) > 0,
            correctiveCount: latest.corrective_action_count ?? 0,
            submittedAt: latest.updated_at,
            problemLabel: isComplete ? "" : getFormProblem(latest),
          });
        }
        const issueCount = formStatuses.filter((f) => !f.complete).length;
        statuses.push({
          name,
          sites: Array.from(entry.sites),
          forms: formStatuses.sort((a, b) => (a.complete ? 1 : -1) - (b.complete ? 1 : -1)),
          allDone: issueCount === 0 && formStatuses.length > 0,
          issueCount,
        });
      }

      statuses.sort((a, b) => {
        if (a.allDone !== b.allDone) return a.allDone ? 1 : -1;
        return a.name.localeCompare(b.name);
      });

      setPersonStatuses(statuses);
      setLastRefresh(new Date());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  const allSites = Array.from(new Set(personStatuses.flatMap((p) => p.sites))).sort();
  const filtered = selectedSite === "all" ? personStatuses : personStatuses.filter((p) => p.sites.includes(selectedSite));
  const allGood = filtered.filter((p) => p.allDone).length;
  const hasIssues = filtered.filter((p) => !p.allDone).length;

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 animate-pulse">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-gray-200" />
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">

      {/* Person Detail Modal */}
      {selectedPerson && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-4 bg-black/40" onClick={() => setSelectedPerson(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className={`px-6 py-4 border-b flex items-center justify-between ${selectedPerson.allDone ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${selectedPerson.allDone ? "bg-green-600" : "bg-red-500"}`}>
                  {selectedPerson.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-gray-900">{selectedPerson.name}</p>
                  <p className="text-xs text-gray-500">{selectedPerson.sites.slice(0, 2).map(s => s.replace(/^[^\w\d(]+/, "")).join(", ")}</p>
                </div>
              </div>
              <button onClick={() => setSelectedPerson(null)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>
            <div className="px-6 py-5 space-y-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Form Status</p>
              {selectedPerson.forms.map((f) => (
                <div key={f.formName} className={`rounded-xl border p-3 ${f.complete ? "bg-green-50 border-green-200" : f.isDraft ? "bg-red-50 border-red-200" : "bg-yellow-50 border-yellow-200"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className={`font-semibold text-sm ${f.complete ? "text-green-800" : f.isDraft ? "text-red-800" : "text-yellow-800"}`}>
                      {f.complete ? "✓" : f.isDraft ? "✗" : "⚠"} {f.formName}
                    </p>
                    {f.submittedAt && <p className="text-xs text-gray-400 shrink-0">{new Date(f.submittedAt).toLocaleDateString()}</p>}
                  </div>
                  {!f.complete && f.problemLabel && (
                    <p className={`text-xs mt-1 font-medium ${f.isDraft ? "text-red-600" : "text-yellow-700"}`}>⚑ {f.problemLabel}</p>
                  )}
                  {f.hasCorrectiveActions && (
                    <p className="text-xs mt-1 font-bold text-red-700">{f.correctiveCount} corrective action{f.correctiveCount > 1 ? "s" : ""} must be resolved</p>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 text-center pb-5">Tap outside to close</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">People Status</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Auto-detected from SALUS — no manual setup needed
            {lastRefresh && ` · Updated ${lastRefresh.toLocaleTimeString()}`}
          </p>
        </div>
        <button onClick={loadAll} className="inline-flex items-center gap-2 bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium text-sm hover:bg-blue-800 transition-colors">
          ⟳ Refresh
        </button>
      </div>

      {/* Summary pills */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2 text-sm font-semibold text-green-800">✓ {allGood} all done</div>
        <div className={`border rounded-xl px-4 py-2 text-sm font-semibold ${hasIssues > 0 ? "bg-red-50 border-red-200 text-red-800" : "bg-gray-50 border-gray-200 text-gray-500"}`}>⚑ {hasIssues} need attention</div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2 text-sm font-semibold text-blue-800">👤 {filtered.length} people tracked</div>
      </div>

      {/* Site filter */}
      {allSites.length > 1 && (
        <div className="flex gap-2 mb-6 flex-wrap">
          <button onClick={() => setSelectedSite("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${selectedSite === "all" ? "bg-blue-700 text-white" : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
            All Sites
          </button>
          {allSites.slice(0, 12).map((site) => (
            <button key={site} onClick={() => setSelectedSite(site)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors truncate max-w-[220px] ${selectedSite === site ? "bg-blue-700 text-white" : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
              {site.replace(/^[^\w\d(]+/, "")}
            </button>
          ))}
        </div>
      )}

      {/* People cards */}
      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-10 text-center">
          <p className="text-4xl mb-3">👥</p>
          <p className="font-semibold text-gray-700">No people found</p>
          <p className="text-gray-400 text-sm mt-1">People appear automatically once they submit or create a form in SALUS</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((person) => (
            <button key={person.name} onClick={() => setSelectedPerson(person)}
              className={`w-full text-left bg-white dark:bg-gray-800 rounded-xl border shadow-sm overflow-hidden transition-all hover:shadow-md ${person.allDone ? "border-green-200 dark:border-green-800" : "border-red-200 dark:border-red-800"}`}>
              <div className="flex items-center gap-4 px-5 py-4">
                <div className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 ${person.allDone ? "bg-green-600" : "bg-red-500"}`}>
                  {person.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-white truncate">{person.name}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {person.sites.slice(0, 2).map(s => s.replace(/^[^\w\d(]+/, "")).join(", ")}
                    {person.sites.length > 2 ? ` +${person.sites.length - 2} more` : ""}
                  </p>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  {person.allDone
                    ? <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800">✓ All Complete</span>
                    : <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800">⚑ {person.issueCount} Issue{person.issueCount > 1 ? "s" : ""}</span>
                  }
                  <span className="text-gray-300 text-sm">›</span>
                </div>
              </div>
              {person.forms.length > 0 && (
                <div className="border-t border-gray-100 dark:border-gray-700 px-5 py-3 bg-gray-50 dark:bg-gray-900">
                  <div className="flex flex-wrap gap-2">
                    {person.forms.map((f) => (
                      <span key={f.formName}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border ${
                          f.complete ? "bg-green-50 border-green-200 text-green-800"
                          : f.isDraft ? "bg-red-50 border-red-200 text-red-700"
                          : "bg-yellow-50 border-yellow-200 text-yellow-800"}`}>
                        {f.complete ? "✓" : f.isDraft ? "✗" : "⚠"} {f.formName}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
