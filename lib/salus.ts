// SALUS API Client
// Handles authentication and all API calls to SALUS safety.io

const TOKEN_URL = process.env.SALUS_TOKEN_URL || "https://guardian.beta.salussafety.io/token";
const API_BASE = process.env.SALUS_API_BASE || "https://developer.beta.salussafety.io";

export interface SalusToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  expires_at: number;
}

export interface FormInstance {
  id: string;
  form_template_id: string;
  form_template_name: string;
  company_id: string;
  company_name: string;
  site_id?: string;
  site_name?: string;
  status: string;
  created_at: string;
  updated_at: string;
  submitted_by?: string;
  fields?: FormField[];
  completion_percentage?: number;
  missing_fields?: string[];
}

export interface FormField {
  id: string;
  label: string;
  value: string | null;
  required: boolean;
  type: string;
}

export interface FormTemplate {
  id: string;
  name: string;
  description?: string;
  required_fields: string[];
}

export interface PublicAccessEntry {
  id: string;
  form_template_id: string;
  form_template_name: string;
  site_id?: string;
  site_name?: string;
  url: string;
  created_at: string;
}

// Simple in-memory token cache (server-side)
let cachedToken: SalusToken | null = null;

export async function getAccessToken(): Promise<string> {
  const clientId = process.env.SALUS_CLIENT_ID;
  const clientSecret = process.env.SALUS_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("SALUS_CLIENT_ID and SALUS_CLIENT_SECRET must be set in environment variables.");
  }

  if (cachedToken && Date.now() < cachedToken.expires_at - 60000) {
    return cachedToken.access_token;
  }

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "sls:idn",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get SALUS token: ${response.status} - ${error}`);
  }

  const data = await response.json();
  cachedToken = {
    ...data,
    expires_at: Date.now() + data.expires_in * 1000,
  };

  return cachedToken!.access_token;
}

async function salusRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`SALUS API error ${response.status} at ${endpoint}: ${error}`);
  }

  return response.json();
}

// Normalize SALUS API camelCase fields to our snake_case FormInstance interface
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeForm(raw: any): FormInstance {
  return {
    id: String(raw.id ?? ""),
    form_template_id: String(raw.formId ?? raw.form_template_id ?? ""),
    form_template_name: String(raw.formTitle ?? raw.form_template_name ?? raw.formName ?? "Unnamed Form"),
    company_id: String(raw.companyId ?? raw.company_id ?? ""),
    company_name: String(raw.companyName ?? raw.company_name ?? "Unknown"),
    site_id: raw.siteId ? String(raw.siteId) : raw.site_id ? String(raw.site_id) : undefined,
    site_name: raw.siteName ?? raw.site_name ?? undefined,
    status: String(raw.status ?? ""),
    created_at: String(raw.createdAt ?? raw.created_at ?? ""),
    updated_at: String(raw.updatedAt ?? raw.updated_at ?? ""),
    submitted_by: raw.submittedByUser ?? raw.submitted_by ?? undefined,
    fields: raw.fields,
    completion_percentage: raw.completion_percentage,
    missing_fields: raw.missing_fields,
  };
}

// Extract an array of forms from any SALUS API response shape
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractForms(data: any): FormInstance[] {
  if (!data) return [];
  if (Array.isArray(data)) return data.map(normalizeForm);
  if (Array.isArray(data.results)) return data.results.map(normalizeForm);
  if (Array.isArray(data.data)) return data.data.map(normalizeForm);
  if (Array.isArray(data.items)) return data.items.map(normalizeForm);
  // Dict keyed by ID: { "12345": {...}, "12346": {...} }
  const values = Object.values(data);
  if (values.length > 0 && typeof values[0] === "object" && values[0] !== null) {
    return values.map(normalizeForm);
  }
  return [];
}

// Fetch all public access entries (forms assigned to sites)
export async function getPublicAccessForms(): Promise<PublicAccessEntry[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await salusRequest<any>("/v1/public-access/");
    if (Array.isArray(data)) return data;
    return data?.results || data?.data || data?.items || [];
  } catch {
    return [];
  }
}

// Fetch a specific form instance by ID
export async function getFormInstance(formInstanceId: string): Promise<FormInstance | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await salusRequest<any>(`/v1/form-instance/${formInstanceId}/`);
    return normalizeForm(raw);
  } catch {
    return null;
  }
}

// Fetch form instances with optional filters
export async function getFormInstances(params?: {
  company_id?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ results: FormInstance[]; count: number }> {
  const query = new URLSearchParams();
  if (params?.company_id) query.set("company_id", params.company_id);
  if (params?.status) query.set("status", params.status);
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.offset) query.set("offset", String(params.offset));

  const endpoint = `/v1/form-instance/${query.toString() ? "?" + query.toString() : ""}`;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await salusRequest<any>(endpoint);
    const results = extractForms(data);
    const count = data?.count ?? data?.total ?? results.length;
    return { results, count };
  } catch {
    return { results: [], count: 0 };
  }
}

// Aggregate incidents
export async function getIncidents(params?: {
  company_id?: string;
  start_date?: string;
  end_date?: string;
}) {
  return salusRequest("/v1/incident/aggregate", {
    method: "POST",
    body: JSON.stringify(params || {}),
  });
}

// Analyze a form instance for completeness
export function analyzeFormCompletion(form: FormInstance): {
  isComplete: boolean;
  completionPercentage: number;
  missingFields: string[];
  status: "complete" | "incomplete" | "pending";
} {
  if (form.fields && form.fields.length > 0) {
    const requiredFields = form.fields.filter((f) => f.required);
    const missingFields = requiredFields
      .filter((f) => !f.value || f.value.toString().trim() === "")
      .map((f) => f.label);

    const completionPercentage =
      requiredFields.length > 0
        ? Math.round(((requiredFields.length - missingFields.length) / requiredFields.length) * 100)
        : 100;

    return {
      isComplete: missingFields.length === 0,
      completionPercentage,
      missingFields,
      status: missingFields.length === 0 ? "complete" : "incomplete",
    };
  }

  const statusLower = (form.status || "").toLowerCase();
  if (statusLower === "submitted" || statusLower === "completed" || statusLower === "approved") {
    return { isComplete: true, completionPercentage: 100, missingFields: [], status: "complete" };
  }
  if (statusLower === "draft" || statusLower === "in_progress" || statusLower === "started") {
    return {
      isComplete: false,
      completionPercentage: 50,
      missingFields: ["Form not fully submitted"],
      status: "incomplete",
    };
  }
  return {
    isComplete: false,
    completionPercentage: 0,
    missingFields: ["Form not started"],
    status: "pending",
  };
}
