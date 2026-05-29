// Fetch and analyze all form instances from SALUS
import { NextRequest, NextResponse } from "next/server";
import { getFormInstances, getPublicAccessForms, analyzeFormCompletion } from "@/lib/salus";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("company_id") || undefined;
  const status = searchParams.get("status") || undefined;

  try {
    // Fetch form instances and public access forms in parallel
    const [formData, publicForms] = await Promise.all([
      getFormInstances({ company_id: companyId, status, limit: 200 }),
      getPublicAccessForms(),
    ]);

    // Analyze each form for completeness
    const analyzedForms = formData.results.map((form) => {
      const analysis = analyzeFormCompletion(form);
      return {
        ...form,
        analysis,
      };
    });

    // Build summary stats
    const total = analyzedForms.length;
    const complete = analyzedForms.filter((f) => f.analysis.isComplete).length;
    const incomplete = analyzedForms.filter((f) => !f.analysis.isComplete).length;
    const flagged = analyzedForms.filter((f) => f.analysis.status === "incomplete");

    // Group by company
    const byCompany: Record<string, { name: string; total: number; complete: number; incomplete: number; forms: typeof analyzedForms }> = {};
    for (const form of analyzedForms) {
      const key = form.company_id || "unknown";
      if (!byCompany[key]) {
        byCompany[key] = {
          name: form.company_name || key,
          total: 0,
          complete: 0,
          incomplete: 0,
          forms: [],
        };
      }
      byCompany[key].total++;
      if (form.analysis.isComplete) byCompany[key].complete++;
      else byCompany[key].incomplete++;
      byCompany[key].forms.push(form);
    }

    return NextResponse.json({
      summary: { total, complete, incomplete },
      byCompany,
      flagged,
      publicForms,
      forms: analyzedForms,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
