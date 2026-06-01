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

    // Fetch full form instance details
    const res = await fetch(`${API_BASE}/v1/form-instance/${id}/`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json();

    // Extract field-level details
    const fields = data?.fields ?? data?.form_fields ?? data?.sections?.flatMap(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s: any) => s.fields ?? []
    ) ?? [];

    // Find missing/empty required fields
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const missingFields = fields.filter((f: any) => {
      const val = f.value ?? f.answer ?? f.response ?? "";
      const isEmpty = val === null || val === undefined || String(val).trim() === "" || val === false;
      return f.required && isEmpty;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }).map((f: any) => f.label ?? f.name ?? f.title ?? "Unknown field");

    // Signatures
    const signatures = data?.signatures ?? data?.sign ?? [];
    const missingSig = data?.status !== "completed" && (!signatures || signatures.length === 0);

    return NextResponse.json({
      id,
      formTitle: data?.formTitle ?? data?.form_template_name ?? "",
      status: data?.status ?? "",
      submittedBy: data?.submittedByUser ?? data?.submitted_by ?? null,
      createdBy: data?.createdByUser ?? data?.created_by ?? null,
      siteName: data?.siteName ?? data?.site_name ?? "",
      fields,
      missingFields,
      missingSig,
      correctiveActionCount: data?.correctiveActionCount ?? 0,
      raw: data,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
