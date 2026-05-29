// Excel export endpoint — generates a downloadable .xlsx report
import { NextResponse } from "next/server";
import { getFormInstances, analyzeFormCompletion } from "@/lib/salus";
import * as XLSX from "xlsx";

export async function GET() {
  try {
    const formData = await getFormInstances({ limit: 500 });

    const analyzedForms = formData.results.map((form) => ({
      ...form,
      analysis: analyzeFormCompletion(form),
    }));

    const total = analyzedForms.length;
    const complete = analyzedForms.filter((f) => f.analysis.isComplete).length;
    const incomplete = total - complete;
    const completionPct = total > 0 ? Math.round((complete / total) * 100) : 0;

    // ── Sheet 1: Summary ──────────────────────────────────────────────
    const summaryData = [
      ["SALUS Document Review — Summary Report"],
      ["Generated", new Date().toLocaleString()],
      [],
      ["Metric", "Value"],
      ["Total Documents", total],
      ["Completed", complete],
      ["Incomplete / Flagged", incomplete],
      ["Completion Rate", `${completionPct}%`],
    ];

    // ── Sheet 2: All Forms ────────────────────────────────────────────
    const allFormsData = [
      ["Form Name", "Company", "Site", "Submitted By", "Date", "Status", "Completion %", "Missing Fields"],
      ...analyzedForms.map((f) => [
        f.form_template_name || "Unnamed",
        f.company_name || "—",
        f.site_name || "—",
        f.submitted_by || "—",
        f.updated_at ? new Date(f.updated_at).toLocaleDateString() : "—",
        f.analysis.status.charAt(0).toUpperCase() + f.analysis.status.slice(1),
        f.analysis.completionPercentage,
        f.analysis.missingFields.join(", ") || "None",
      ]),
    ];

    // ── Sheet 3: Flagged / Incomplete ─────────────────────────────────
    const flaggedForms = analyzedForms.filter((f) => !f.analysis.isComplete);
    const flaggedData = [
      ["Form Name", "Company", "Site", "Submitted By", "Date", "Completion %", "Missing Fields"],
      ...flaggedForms.map((f) => [
        f.form_template_name || "Unnamed",
        f.company_name || "—",
        f.site_name || "—",
        f.submitted_by || "—",
        f.updated_at ? new Date(f.updated_at).toLocaleDateString() : "—",
        f.analysis.completionPercentage,
        f.analysis.missingFields.join(", ") || "—",
      ]),
    ];

    // ── Build workbook ────────────────────────────────────────────────
    const wb = XLSX.utils.book_new();

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    wsSummary["!cols"] = [{ wch: 28 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

    const wsAll = XLSX.utils.aoa_to_sheet(allFormsData);
    wsAll["!cols"] = [{ wch: 36 }, { wch: 22 }, { wch: 22 }, { wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, wsAll, "All Forms");

    const wsFlagged = XLSX.utils.aoa_to_sheet(flaggedData);
    wsFlagged["!cols"] = [{ wch: 36 }, { wch: 22 }, { wch: 22 }, { wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, wsFlagged, "Flagged Incomplete");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const dateStr = new Date().toISOString().split("T")[0];
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="SALUS-Report-${dateStr}.xlsx"`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Export failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
