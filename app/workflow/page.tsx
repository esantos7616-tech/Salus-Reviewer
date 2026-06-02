"use client";

interface WorkflowItem {
  document: string;
  responsible: string;
  approval: string;
  timeline: string;
  tracking: string;
  required: boolean;
}

interface Phase {
  id: string;
  title: string;
  icon: string;
  color: string;
  description: string;
  items: WorkflowItem[];
}

const phases: Phase[] = [
  {
    id: "project-award",
    title: "Project Award",
    icon: "🏆",
    color: "blue",
    description: "Required before any work begins — completed during contract award phase",
    items: [
      { document: "Versys Health & Safety Orientation", responsible: "All Workers", approval: "Project Manager", timeline: "Before mobilization", tracking: "SALUS — Orientation form", required: true },
      { document: "Project Hazard Assessment (PHA)", responsible: "Project Manager", approval: "Safety Manager", timeline: "Before mobilization", tracking: "SALUS — PHA form", required: true },
      { document: "Fatigue Management Plan", responsible: "Project Manager", approval: "Project Manager", timeline: "Before mobilization", tracking: "SALUS — Fatigue form", required: true },
      { document: "Contractor Safety Evaluation Checklist", responsible: "Project Manager", approval: "Safety Manager", timeline: "Before site entry", tracking: "SALUS — Checklist form", required: true },
    ],
  },
  {
    id: "site-mobilization",
    title: "Site Mobilization",
    icon: "🚧",
    color: "orange",
    description: "Completed upon arrival at site before any work commences",
    items: [
      { document: "Site Safety Inspection", responsible: "Site Supervisor", approval: "Project Manager", timeline: "Before work begins", tracking: "SALUS — Site Safety Inspection", required: true },
      { document: "Vehicle and Trailer Inspection Form", responsible: "Driver / Operator", approval: "Supervisor", timeline: "Day of arrival", tracking: "SALUS — Vehicle Inspection", required: true },
      { document: "360° Walkaround Checklist", responsible: "Equipment Operator", approval: "Supervisor", timeline: "Before equipment use", tracking: "SALUS — Walkaround form", required: true },
    ],
  },
  {
    id: "first-day",
    title: "First Day Onsite",
    icon: "📋",
    color: "purple",
    description: "Every worker must complete these before starting work on their first day",
    items: [
      { document: "Versys Health & Safety Orientation", responsible: "Each Worker", approval: "Site Supervisor", timeline: "Before starting work", tracking: "SALUS — Orientation form", required: true },
      { document: "Daily JSA and Toolbox Talk (FLRA, SSHA)", responsible: "Foreman + All Workers", approval: "Supervisor", timeline: "Before work begins", tracking: "SALUS — JSA form", required: true },
      { document: "SHARE Card", responsible: "All Workers", approval: "No approval required", timeline: "Any safety observation", tracking: "SALUS — SHARE Card", required: false },
    ],
  },
  {
    id: "daily",
    title: "Daily Requirements",
    icon: "📅",
    color: "green",
    description: "Must be completed every working day without exception",
    items: [
      { document: "Daily JSA and Toolbox Talk (FLRA, SSHA)", responsible: "Foreman", approval: "Supervisor sign-off", timeline: "Before work each morning", tracking: "SALUS — JSA form + Dashboard", required: true },
      { document: "Daily Commissioning Progress Report", responsible: "Project Lead", approval: "Project Manager", timeline: "End of each day", tracking: "SALUS — Progress Report", required: true },
      { document: "Vehicle and Trailer Inspection Form", responsible: "Driver", approval: "No approval required", timeline: "Before first use each day", tracking: "SALUS — Vehicle Inspection", required: true },
      { document: "SHARE Card", responsible: "All Workers", approval: "No approval required", timeline: "Whenever hazard observed", tracking: "SALUS — SHARE Card", required: false },
    ],
  },
  {
    id: "weekly",
    title: "Weekly Requirements",
    icon: "📆",
    color: "teal",
    description: "Completed once per week — typically on Fridays",
    items: [
      { document: "Weekly Construction Report", responsible: "Project Manager", approval: "Project Manager", timeline: "Every Friday by 5:00 PM", tracking: "SALUS — Weekly Report + Dashboard", required: true },
      { document: "Site Safety Inspection", responsible: "Site Supervisor", approval: "Project Manager", timeline: "Once per week", tracking: "SALUS — Site Safety Inspection", required: true },
      { document: "Self Fatigue Likelihood Assessment", responsible: "All Workers", approval: "Supervisor", timeline: "Weekly or when fatigued", tracking: "SALUS — Fatigue Assessment", required: true },
    ],
  },
  {
    id: "monthly",
    title: "Monthly Requirements",
    icon: "🗓️",
    color: "indigo",
    description: "Completed once per month — typically last Friday of the month",
    items: [
      { document: "Contractor Safety Evaluation Checklist", responsible: "Project Manager", approval: "Safety Manager", timeline: "Last Friday of each month", tracking: "SALUS — Contractor Checklist", required: true },
      { document: "Training Record", responsible: "Project Manager", approval: "Safety Manager", timeline: "Monthly review", tracking: "SALUS — Training Record", required: true },
      { document: "Fatigue Management Plan", responsible: "Project Manager", approval: "Project Manager", timeline: "Monthly review and update", tracking: "SALUS — Fatigue Management", required: false },
    ],
  },
  {
    id: "equipment",
    title: "Equipment Operation & Inspections",
    icon: "🚜",
    color: "red",
    description: "Required every time equipment is operated or inspected",
    items: [
      { document: "360° Walkaround Checklist", responsible: "Equipment Operator", approval: "Supervisor", timeline: "Before each use", tracking: "SALUS — Walkaround form", required: true },
      { document: "Vehicle and Trailer Inspection Form", responsible: "Driver / Operator", approval: "No approval required", timeline: "Before each use / daily", tracking: "SALUS — Vehicle Inspection", required: true },
      { document: "Site Safety Inspection", responsible: "Site Supervisor", approval: "Project Manager", timeline: "After equipment setup", tracking: "SALUS — Site Safety Inspection", required: true },
    ],
  },
];

const colorMap: Record<string, { bg: string; border: string; badge: string; icon: string; header: string }> = {
  blue:   { bg: "bg-blue-50 dark:bg-blue-900/20",   border: "border-blue-200 dark:border-blue-800",   badge: "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300",   icon: "bg-blue-600",   header: "text-blue-800 dark:text-blue-300" },
  orange: { bg: "bg-orange-50 dark:bg-orange-900/20", border: "border-orange-200 dark:border-orange-800", badge: "bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300", icon: "bg-orange-500", header: "text-orange-800 dark:text-orange-300" },
  purple: { bg: "bg-purple-50 dark:bg-purple-900/20", border: "border-purple-200 dark:border-purple-800", badge: "bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300", icon: "bg-purple-600", header: "text-purple-800 dark:text-purple-300" },
  green:  { bg: "bg-green-50 dark:bg-green-900/20",  border: "border-green-200 dark:border-green-800",  badge: "bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300",  icon: "bg-green-600",  header: "text-green-800 dark:text-green-300" },
  teal:   { bg: "bg-teal-50 dark:bg-teal-900/20",    border: "border-teal-200 dark:border-teal-800",    badge: "bg-teal-100 dark:bg-teal-900/40 text-teal-800 dark:text-teal-300",    icon: "bg-teal-600",   header: "text-teal-800 dark:text-teal-300" },
  indigo: { bg: "bg-indigo-50 dark:bg-indigo-900/20", border: "border-indigo-200 dark:border-indigo-800", badge: "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300", icon: "bg-indigo-600", header: "text-indigo-800 dark:text-indigo-300" },
  red:    { bg: "bg-red-50 dark:bg-red-900/20",      border: "border-red-200 dark:border-red-800",      badge: "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300",      icon: "bg-red-600",    header: "text-red-800 dark:text-red-300" },
};

export default function WorkflowPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Safety Requirements Workflow</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          Required documents, responsible persons, approval requirements, submission timelines and tracking for each project phase
        </p>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-8 flex-wrap">
        <div className="flex items-center gap-2 text-sm">
          <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
          <span className="text-gray-600 dark:text-gray-400">Required</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="w-3 h-3 rounded-full bg-gray-300 inline-block" />
          <span className="text-gray-600 dark:text-gray-400">Recommended</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          All forms tracked via SALUS and visible on the Dashboard
        </div>
      </div>

      {/* Phases */}
      <div className="space-y-6">
        {phases.map((phase) => {
          const c = colorMap[phase.color];
          return (
            <div key={phase.id} className={`rounded-2xl border ${c.border} overflow-hidden shadow-sm`}>
              {/* Phase header */}
              <div className={`${c.bg} px-6 py-4 border-b ${c.border}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 ${c.icon} rounded-xl flex items-center justify-center text-xl`}>
                    {phase.icon}
                  </div>
                  <div>
                    <h2 className={`font-bold text-lg ${c.header}`}>{phase.title}</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{phase.description}</p>
                  </div>
                  <span className={`ml-auto text-xs font-bold px-3 py-1 rounded-full ${c.badge}`}>
                    {phase.items.filter(i => i.required).length} required · {phase.items.filter(i => !i.required).length} recommended
                  </span>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-900 text-xs text-gray-500 dark:text-gray-400 uppercase">
                    <tr>
                      <th className="text-left px-5 py-3 font-medium w-6" />
                      <th className="text-left px-5 py-3 font-medium">Required Document</th>
                      <th className="text-left px-5 py-3 font-medium hidden sm:table-cell">Responsible</th>
                      <th className="text-left px-5 py-3 font-medium hidden md:table-cell">Approval</th>
                      <th className="text-left px-5 py-3 font-medium hidden lg:table-cell">Submission Timeline</th>
                      <th className="text-left px-5 py-3 font-medium hidden xl:table-cell">Tracking</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {phase.items.map((item, i) => (
                      <tr key={i} className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <td className="px-5 py-4">
                          <span className={`inline-block w-2.5 h-2.5 rounded-full ${item.required ? "bg-red-500" : "bg-gray-300"}`} />
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-semibold text-gray-900 dark:text-gray-100">{item.document}</p>
                          {/* Show all info on mobile */}
                          <div className="sm:hidden mt-1 space-y-0.5">
                            <p className="text-xs text-gray-500 dark:text-gray-400">👤 {item.responsible}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">✅ {item.approval}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">⏰ {item.timeline}</p>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-gray-600 dark:text-gray-300 hidden sm:table-cell">{item.responsible}</td>
                        <td className="px-5 py-4 text-gray-600 dark:text-gray-300 hidden md:table-cell">{item.approval}</td>
                        <td className="px-5 py-4 hidden lg:table-cell">
                          <span className={`inline-block px-2 py-1 rounded-lg text-xs font-medium ${c.badge}`}>
                            {item.timeline}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-gray-500 dark:text-gray-400 text-xs hidden xl:table-cell">{item.tracking}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <p className="text-sm text-blue-800 dark:text-blue-300 font-medium">📊 All documents listed above are tracked through SALUS and visible on the Dashboard and People tabs of this app.</p>
        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Non-compliance is automatically flagged — check the Dashboard daily for any missing or incomplete submissions.</p>
      </div>
    </div>
  );
}
