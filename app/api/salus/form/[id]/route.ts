import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/salus";

const API_BASE = process.env.SALUS_API_BASE || "https://developer.beta.salussafety.io";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = await getAccessToken();
    const { id } = params;

    // Fetch form instance + signatures in parallel
    const [formRes, sigRes] = await Promise.allSettled([
      fetch(`${API_BASE}/v1/form-instance/${id}/`, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      }),
      fetch(`${API_BASE}/v1/form-instance/${id}/sign`, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      }),
    ]);

    if (formRes.status === "rejected" || !formRes.value.ok) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await formRes.value.json();

    // Parse signatures
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let signatures: any[] = [];
    if (sigRes.status === "fulfilled" && sigRes.value.ok) {
      const sigData = await sigRes.value.json();
      signatures = Array.isArray(sigData) ? sigData : (sigData?.results ?? sigData?.data ?? []);
    }

    // Extract field-level details if available
    const fields = data?.fields ?? data?.form_fields ?? data?.sections?.flatMap(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s: any) => s.fields ?? []
    ) ?? [];

    // Find missing required fields
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const missingFields = fields.filter((f: any) => {
      const val = f.value ?? f.answer ?? f.response ?? "";
      const isEmpty = val === null || val === undefined || String(val).trim() === "" || val === false;
      return f.required && isEmpty;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }).map((f: any) => f.label ?? f.name ?? f.title ?? "Unknown field");

    const status = (data?.status ?? "").toLowerCase();
    const isComplete = ["completed", "submitted", "approved"].includes(status);
    const missingSig = !isComplete && signatures.length === 0;

    // Format signature info
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sigInfo = signatures.map((s: any) => ({
      name: s.signerName ?? s.userName ?? s.name ?? "Unknown",
      date: s.createdAt ?? s.signedAt ?? null,
      role: s.signerRole ?? s.role ?? null,
    }));

    return NextResponse.json({
      id,
      formTitle: data?.formTitle ?? data?.form_template_name ?? "",
      status: data?.status ?? "",
      submittedBy: data?.submittedByUser ?? data?.submitted_by ?? null,
      createdBy: data?.createdByUser ?? data?.created_by ?? null,
      submittedOn: data?.submittedOn ?? null,
      createdAt: data?.createdAt ?? null,
      siteName: data?.siteName ?? data?.site_name ?? "",
      missingFields,
      missingSig,
      signatures: sigInfo,
      correctiveActionCount: data?.correctiveActionCount ?? 0,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
