"use client";

import { useState, useEffect } from "react";

const SALUS_FORM_TYPES = [
  "Daily JSA and Toolbox Talk (FLRA, SSHA)",
  "SHARE Card",
  "Vehicle and Trailer Inspection Form",
  "Site Safety Inspection",
  "Daily Commissioning Progress Report",
  "Project Hazard Assessment (PHA)",
  "Fatigue Management Plan",
  "Training Record",
  "Self Fatigue Likelihood Assessment",
  "Weekly Construction Report",
  "Contractor Safety Evaluation Checklist",
  "Versys Health and Safety Orientation",
  "360° Walkaround Checklist",
];

interface Project {
  id: string;
  name: string;
  site_location: string;
  status: "active" | "inactive";
  required_forms: string[];
}

interface TeamMember {
  id: string;
  project_id: string;
  name: string;
  role: string;
  salus_name?: string;
}

export default function AdminPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"projects" | "team">("projects");
  const [expandedProject, setExpandedProject] = useState<string | null>(null);

  // New project form
  const [newProject, setNewProject] = useState({
    name: "",
    site_location: "",
    required_forms: [] as string[],
    status: "active" as "active" | "inactive",
  });

  // New member form
  const [newMember, setNewMember] = useState({
    project_id: "",
    name: "",
    role: "",
    salus_name: "",
  });

  const [savingProject, setSavingProject] = useState(false);
  const [savingMember, setSavingMember] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [projRes, teamRes] = await Promise.all([
        fetch("/api/projects"),
        fetch("/api/team"),
      ]);
      setProjects(await projRes.json());
      setTeamMembers(await teamRes.json());
    } finally {
      setLoading(false);
    }
  }

  function showSuccess(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 3000);
  }

  async function handleAddProject(e: React.FormEvent) {
    e.preventDefault();
    if (!newProject.name || !newProject.site_location) return;
    setSavingProject(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newProject),
      });
      const created = await res.json();
      setProjects((p) => [created, ...p]);
      setNewProject({ name: "", site_location: "", required_forms: [], status: "active" });
      showSuccess("Project added!");
    } finally {
      setSavingProject(false);
    }
  }

  async function handleDeleteProject(id: string) {
    if (!confirm("Delete this project and all its team members?")) return;
    await fetch("/api/projects", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setProjects((p) => p.filter((proj) => proj.id !== id));
    setTeamMembers((t) => t.filter((m) => m.project_id !== id));
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!newMember.project_id || !newMember.name || !newMember.role) return;
    setSavingMember(true);
    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newMember),
      });
      const created = await res.json();
      setTeamMembers((t) => [...t, created]);
      setNewMember({ project_id: newMember.project_id, name: "", role: "", salus_name: "" });
      showSuccess("Team member added!");
    } finally {
      setSavingMember(false);
    }
  }

  async function handleDeleteMember(id: string) {
    await fetch("/api/team", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setTeamMembers((t) => t.filter((m) => m.id !== id));
  }

  function toggleForm(form: string) {
    setNewProject((p) => ({
      ...p,
      required_forms: p.required_forms.includes(form)
        ? p.required_forms.filter((f) => f !== form)
        : [...p.required_forms, form],
    }));
  }

  const activeProjects = projects.filter((p) => p.status === "active");

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
        <p className="text-gray-500 text-sm mt-1">Management only — add job sites and assign team members</p>
      </div>

      {/* Success toast */}
      {successMsg && (
        <div className="fixed top-20 right-4 z-50 bg-green-600 text-white px-5 py-3 rounded-xl shadow-lg font-medium text-sm">
          ✓ {successMsg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
        {(["projects", "team"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold capitalize transition-colors ${
              activeTab === tab ? "bg-white text-blue-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab === "projects" ? "📋 Job Sites" : "👷 Team Members"}
          </button>
        ))}
      </div>

      {/* ── PROJECTS TAB ──────────────────────────────────────────── */}
      {activeTab === "projects" && (
        <div className="space-y-6">
          {/* Add project form */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h2 className="font-bold text-gray-900 mb-4 text-lg">➕ Add New Job Site</h2>
            <form onSubmit={handleAddProject} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Project Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. TC Energy Lebanon Compressor Station"
                    value={newProject.name}
                    onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Site Location *</label>
                  <input
                    type="text"
                    placeholder="e.g. Lebanon, PA"
                    value={newProject.site_location}
                    onChange={(e) => setNewProject({ ...newProject, site_location: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Required Forms for This Job Site *
                </label>
                <p className="text-xs text-gray-400 mb-3">Select every form that workers must fill out at this site</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {SALUS_FORM_TYPES.map((form) => (
                    <label
                      key={form}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors text-sm ${
                        newProject.required_forms.includes(form)
                          ? "bg-blue-50 border-blue-400 text-blue-800 font-medium"
                          : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={newProject.required_forms.includes(form)}
                        onChange={() => toggleForm(form)}
                        className="accent-blue-700"
                      />
                      {form}
                    </label>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={savingProject || newProject.required_forms.length === 0}
                className="bg-blue-700 text-white px-6 py-2.5 rounded-lg font-semibold text-sm hover:bg-blue-800 transition-colors disabled:opacity-50"
              >
                {savingProject ? "Adding..." : "Add Job Site"}
              </button>
            </form>
          </div>

          {/* Existing projects */}
          <div>
            <h2 className="font-bold text-gray-900 mb-3 text-lg">Active Job Sites ({activeProjects.length})</h2>
            {loading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-1/3" />
                  </div>
                ))}
              </div>
            ) : activeProjects.length === 0 ? (
              <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-400 text-sm">
                No job sites added yet. Use the form above to add your first one.
              </div>
            ) : (
              <div className="space-y-3">
                {activeProjects.map((project) => {
                  const members = teamMembers.filter((m) => m.project_id === project.id);
                  const isExpanded = expandedProject === project.id;
                  return (
                    <div key={project.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                      <div
                        className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50"
                        onClick={() => setExpandedProject(isExpanded ? null : project.id)}
                      >
                        <div>
                          <p className="font-semibold text-gray-900">{project.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            📍 {project.site_location} · {members.length} team member{members.length !== 1 ? "s" : ""} · {project.required_forms.length} required form{project.required_forms.length !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-gray-400 text-sm">{isExpanded ? "▲" : "▼"}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteProject(project.id); }}
                            className="text-red-400 hover:text-red-600 text-sm font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="border-t border-gray-100 px-5 py-4 bg-gray-50 space-y-3">
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Required Forms</p>
                            <div className="flex flex-wrap gap-1.5">
                              {project.required_forms.map((f) => (
                                <span key={f} className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-lg font-medium">{f}</span>
                              ))}
                            </div>
                          </div>
                          {members.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Team Members</p>
                              <div className="flex flex-wrap gap-1.5">
                                {members.map((m) => (
                                  <span key={m.id} className="bg-white border border-gray-200 text-gray-700 text-xs px-2 py-1 rounded-lg">{m.name} ({m.role})</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TEAM MEMBERS TAB ──────────────────────────────────────── */}
      {activeTab === "team" && (
        <div className="space-y-6">
          {activeProjects.length === 0 ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5 text-sm text-yellow-800">
              You need to add at least one job site before adding team members. Switch to the <strong>Job Sites</strong> tab first.
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h2 className="font-bold text-gray-900 mb-4 text-lg">➕ Add Team Member</h2>
              <form onSubmit={handleAddMember} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Job Site *</label>
                  <select
                    value={newMember.project_id}
                    onChange={(e) => setNewMember({ ...newMember, project_id: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select a job site...</option>
                    {activeProjects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. John Smith"
                      value={newMember.name}
                      onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                    <input
                      type="text"
                      placeholder="e.g. Technician, Foreman, Project Lead"
                      value={newMember.role}
                      onChange={(e) => setNewMember({ ...newMember, role: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name in SALUS <span className="text-gray-400 font-normal">(optional — only needed if different from above)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Leave blank if same as full name"
                    value={newMember.salus_name}
                    onChange={(e) => setNewMember({ ...newMember, salus_name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingMember}
                  className="bg-blue-700 text-white px-6 py-2.5 rounded-lg font-semibold text-sm hover:bg-blue-800 transition-colors disabled:opacity-50"
                >
                  {savingMember ? "Adding..." : "Add Team Member"}
                </button>
              </form>
            </div>
          )}

          {/* Team list grouped by project */}
          {activeProjects.map((project) => {
            const members = teamMembers.filter((m) => m.project_id === project.id);
            if (members.length === 0) return null;
            return (
              <div key={project.id}>
                <h3 className="font-semibold text-gray-700 mb-2 text-sm uppercase tracking-wide">
                  {project.name}
                </h3>
                <div className="space-y-2">
                  {members.map((m) => (
                    <div key={m.id} className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                          {m.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{m.name}</p>
                          <p className="text-xs text-gray-400">{m.role}{m.salus_name && m.salus_name !== m.name ? ` · SALUS: ${m.salus_name}` : ""}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteMember(m.id)}
                        className="text-red-400 hover:text-red-600 text-xs font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
