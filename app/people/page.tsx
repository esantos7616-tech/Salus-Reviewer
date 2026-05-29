"use client";

import { useState, useEffect } from "react";

interface Project {
  id: string;
  name: string;
  site_location: string;
  required_forms: string[];
  status: string;
}

interface TeamMember {
  id: string;
  project_id: string;
  name: string;
  role: string;
  salus_name?: string;
}

interface FormInstance {
  id: string;
  form_template_name: string;
  submitted_by?: string;
  updated_at: string;
  analysis: { isComplete: boolean; completionPercentage: number; status: string };
}

interface PersonStatus {
  member: TeamMember;
  project: Project;
  forms: {
    formName: string;
    submitted: boolean;
    complete: boolean;
    completionPct: number;
    submittedAt?: string;
  }[];
  allDone: boolean;
  missingCount: number;
}

export default function PeoplePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [salUsForms, setSalusForms] = useState<FormInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [projRes, teamRes, formsRes] = await Promise.all([
        fetch("/api/projects"),
        fetch("/api/team"),
        fetch("/api/salus/forms"),
      ]);
      const [projData, teamData, formsData] = await Promise.all([
        projRes.json(),
        teamRes.json(),
        formsRes.json(),
      ]);
      setProjects(Array.isArray(projData) ? projData : []);
      setTeamMembers(Array.isArray(teamData) ? teamData : []);
      setSalusForms(formsData?.forms ?? []);
      setLastRefresh(new Date());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  // Build status for each person on each project
  function buildPersonStatuses(): PersonStatus[] {
    const filtered =
      selectedProject === "all"
        ? teamMembers
        : teamMembers.filter((m) => m.project_id === selectedProject);

    return filtered.map((member) => {
      const project = projects.find((p) => p.id === member.project_id);
      if (!project) return null;

      const displayName = member.salus_name || member.name;

      const formStatuses = (project.required_forms ?? []).map((formName) => {
        // Find submissions by this person for this form type
        const submissions = salUsForms.filter((f) => {
          const submitter = (f.submitted_by ?? "").toLowerCase();
          const nameMatch =
            submitter.includes(displayName.toLowerCase()) ||
            displayName.toLowerCase().includes(submitter);
          const formMatch = f.form_template_name
            .toLowerCase()
            .includes(formName.toLowerCase());
          return nameMatch && formMatch;
        });

        if (submissions.length === 0) {
          return { formName, submitted: false, complete: false, completionPct: 0 };
        }

        // Use most recent
        const latest = submissions.sort(
          (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        )[0];

        return {
          formName,
          submitted: true,
          complete: latest.analysis.isComplete,
          completionPct: latest.analysis.completionPercentage,
          submittedAt: latest.updated_at,
        };
      });

      const missingCount = formStatuses.filter((f) => !f.complete).length;
      const allDone = missingCount === 0 && formStatuses.length > 0;

      return { member, project, forms: formStatuses, allDone, missingCount };
    }).filter(Boolean) as PersonStatus[];
  }

  const statuses = buildPersonStatuses();
  const allGood = statuses.filter((s) => s.allDone).length;
  const hasIssues = statuses.filter((s) => !s.allDone).length;
  const activeProjects = projects.filter((p) => p.status === "active");

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
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
      </div>
    );
  }

  // No projects set up yet
  if (activeProjects.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 text-center">
        <div className="text-5xl mb-4">👷</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">No projects set up yet</h2>
        <p className="text-gray-500 mb-6">
          Go to the Admin tab to add your active job sites and assign team members.
          Once added, this page will show who has filled out their forms and who hasn't.
        </p>
        <a
          href="/admin"
          className="inline-block bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-800 transition-colors"
        >
          Go to Admin →
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">People Status</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Who has filled out their forms — and who hasn't
            {lastRefresh && ` · Updated ${lastRefresh.toLocaleTimeString()}`}
          </p>
        </div>
        <button
          onClick={loadAll}
          className="inline-flex items-center gap-2 bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium text-sm hover:bg-blue-800 transition-colors"
        >
          ⟳ Refresh
        </button>
      </div>

      {/* Summary pills */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2 text-sm font-semibold text-green-800">
          ✓ {allGood} all done
        </div>
        <div className={`border rounded-xl px-4 py-2 text-sm font-semibold ${hasIssues > 0 ? "bg-red-50 border-red-200 text-red-800" : "bg-gray-50 border-gray-200 text-gray-500"}`}>
          ⚑ {hasIssues} need attention
        </div>
      </div>

      {/* Project filter */}
      {activeProjects.length > 1 && (
        <div className="flex gap-2 mb-6 flex-wrap">
          <button
            onClick={() => setSelectedProject("all")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedProject === "all" ? "bg-blue-700 text-white" : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"}`}
          >
            All Projects
          </button>
          {activeProjects.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedProject(p.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedProject === p.id ? "bg-blue-700 text-white" : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"}`}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      {/* People cards */}
      {statuses.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <p className="text-4xl mb-3">👥</p>
          <p className="font-semibold text-gray-700">No team members found for this project</p>
          <p className="text-gray-400 text-sm mt-1">Add team members in the Admin tab</p>
        </div>
      ) : (
        <div className="space-y-3">
          {statuses
            .sort((a, b) => (a.allDone ? 1 : -1) - (b.allDone ? 1 : -1))
            .map(({ member, project, forms, allDone, missingCount }) => (
              <div
                key={member.id}
                className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all ${
                  allDone ? "border-green-200" : "border-red-200"
                }`}
              >
                <div className="flex items-center gap-4 px-5 py-4">
                  {/* Avatar */}
                  <div
                    className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 ${
                      allDone ? "bg-green-600" : "bg-red-500"
                    }`}
                  >
                    {member.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{member.name}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {member.role} · {project.name}
                    </p>
                  </div>

                  {/* Status badge */}
                  <div className="shrink-0">
                    {allDone ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800">
                        ✓ All Complete
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800">
                        ⚑ {missingCount} Missing
                      </span>
                    )}
                  </div>
                </div>

                {/* Form breakdown */}
                {forms.length > 0 && (
                  <div className="border-t border-gray-100 px-5 py-3 bg-gray-50">
                    <div className="flex flex-wrap gap-2">
                      {forms.map((f) => (
                        <span
                          key={f.formName}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border ${
                            f.complete
                              ? "bg-green-50 border-green-200 text-green-800"
                              : f.submitted
                              ? "bg-yellow-50 border-yellow-200 text-yellow-800"
                              : "bg-red-50 border-red-200 text-red-700"
                          }`}
                        >
                          {f.complete ? "✓" : f.submitted ? "⚠" : "✗"} {f.formName}
                          {f.submitted && !f.complete && ` (${f.completionPct}%)`}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
