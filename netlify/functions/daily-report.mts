/**
 * Netlify Scheduled Function — Daily Safety Report
 * Runs every weekday morning at 9am EST (14:00 UTC).
 * Sends an email summary of SALUS form completion to the team.
 *
 * Required environment variables in Netlify:
 *   SALUS_CLIENT_ID, SALUS_CLIENT_SECRET, SALUS_TOKEN_URL, SALUS_API_BASE
 *   RESEND_API_KEY     — from resend.com (free account, 3000 emails/month)
 *   REPORT_EMAIL_TO    — comma-separated list of recipient emails
 *   REPORT_EMAIL_FROM  — sender address (must be verified in Resend)
 */

import type { Config } from "@netlify/functions";

// ── Token cache (in-memory for the function lifetime) ─────────────────
let cachedToken: { token: string; expires: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expires - 30_000) {
    return cachedToken.token;
  }
  const tokenUrl = process.env.SALUS_TOKEN_URL!;
  const clientId = process.env.SALUS_CLIENT_ID!;
  const clientSecret = process.env.SALUS_CLIENT_SECRET!;

  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) throw new Error(`Auth failed: ${res.status}`);
  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expires: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return cachedToken.token;
}

async function fetchForms() {
  const token = await getAccessToken();
  const base = process.env.SALUS_API_BASE!;
  const res = await fetch(`${base}/v1/form-instances?limit=500`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Forms API failed: ${res.status}`);
  return res.json();
}

function analyzeForm(form: Record<string, unknown>) {
  const data = (form.data ?? form.form_data ?? {}) as Record<string, unknown>;
  const fields = Object.values(data);
  if (fields.length === 0) return { isComplete: false, completionPct: 0, status: "pending" };

  const filled = fields.filter((v) => v !== null && v !== undefined && v !== "").length;
  const pct = Math.round((filled / fields.length) * 100);
  return {
    isComplete: pct >= 90,
    completionPct: pct,
    status: pct >= 90 ? "complete" : pct > 0 ? "incomplete" : "pending",
  };
}

// ── Build HTML email ──────────────────────────────────────────────────
function buildEmail(forms: Record<string, unknown>[]) {
  const analyzed = forms.map((f) => ({ ...f, analysis: analyzeForm(f) }));
  const total = analyzed.length;
  const complete = analyzed.filter((f) => f.analysis.isComplete).length;
  const incomplete = total - complete;
  const pct = total > 0 ? Math.round((complete / total) * 100) : 0;

  const flagged = analyzed
    .filter((f) => !f.analysis.isComplete)
    .slice(0, 20)
    .map((f) => {
      const name = (f.form_template_name ?? f.title ?? "Unnamed Form") as string;
      const company = (f.company_name ?? "Unknown") as string;
      const site = (f.site_name ?? "") as string;
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;">${name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;">${company}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;">${site || "—"}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;color:#dc2626;">${f.analysis.completionPct}%</td>
      </tr>`;
    })
    .join("");

  const statusColor = pct >= 90 ? "#16a34a" : pct >= 60 ? "#d97706" : "#dc2626";
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return {
    subject: `SALUS Daily Report — ${pct}% Complete (${incomplete} flagged) — ${today}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"/></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:#1d4ed8;padding:24px 32px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:36px;height:36px;background:#fff;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:bold;color:#1d4ed8;font-size:16px;">S</div>
        <div>
          <div style="color:#fff;font-weight:700;font-size:18px;">SALUS Daily Safety Report</div>
          <div style="color:#bfdbfe;font-size:13px;">${today}</div>
        </div>
      </div>
    </div>

    <!-- Stats -->
    <div style="padding:24px 32px;border-bottom:1px solid #f3f4f6;">
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;text-align:center;">
        <div style="background:#f9fafb;border-radius:8px;padding:16px;">
          <div style="font-size:28px;font-weight:700;color:#111827;">${total}</div>
          <div style="font-size:12px;color:#6b7280;margin-top:2px;">Total Forms</div>
        </div>
        <div style="background:#f0fdf4;border-radius:8px;padding:16px;">
          <div style="font-size:28px;font-weight:700;color:#16a34a;">${complete}</div>
          <div style="font-size:12px;color:#16a34a;margin-top:2px;">Complete</div>
        </div>
        <div style="background:#fff1f2;border-radius:8px;padding:16px;">
          <div style="font-size:28px;font-weight:700;color:#dc2626;">${incomplete}</div>
          <div style="font-size:12px;color:#dc2626;margin-top:2px;">Flagged</div>
        </div>
      </div>
      <!-- Progress bar -->
      <div style="margin-top:20px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
          <span style="font-size:13px;color:#374151;font-weight:600;">Completion Rate</span>
          <span style="font-size:13px;font-weight:700;color:${statusColor};">${pct}%</span>
        </div>
        <div style="height:8px;background:#e5e7eb;border-radius:999px;overflow:hidden;">
          <div style="height:8px;width:${pct}%;background:${statusColor};border-radius:999px;"></div>
        </div>
      </div>
    </div>

    ${
      incomplete > 0
        ? `<!-- Flagged Forms -->
    <div style="padding:24px 32px;">
      <h2 style="font-size:15px;font-weight:700;color:#111827;margin:0 0 12px;">⚑ Flagged / Incomplete Forms</h2>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#f9fafb;">
            <th style="text-align:left;padding:8px 12px;color:#6b7280;font-weight:600;">Form</th>
            <th style="text-align:left;padding:8px 12px;color:#6b7280;font-weight:600;">Company</th>
            <th style="text-align:left;padding:8px 12px;color:#6b7280;font-weight:600;">Site</th>
            <th style="text-align:left;padding:8px 12px;color:#6b7280;font-weight:600;">Filled</th>
          </tr>
        </thead>
        <tbody>${flagged}</tbody>
      </table>
      ${incomplete > 20 ? `<p style="font-size:12px;color:#9ca3af;margin:8px 12px 0;">+ ${incomplete - 20} more flagged forms — view full list on the dashboard.</p>` : ""}
    </div>`
        : `<div style="padding:24px 32px;text-align:center;">
      <div style="font-size:32px;">🎉</div>
      <p style="font-weight:700;color:#16a34a;margin:8px 0 4px;">All forms complete!</p>
      <p style="color:#6b7280;font-size:13px;margin:0;">No flagged documents today.</p>
    </div>`
    }

    <!-- Footer -->
    <div style="background:#f9fafb;padding:16px 32px;text-align:center;border-top:1px solid #f3f4f6;">
      <p style="font-size:12px;color:#9ca3af;margin:0;">This report is generated automatically each weekday morning. <br/>View the live dashboard for real-time updates.</p>
    </div>
  </div>
</body>
</html>`,
  };
}

// ── Scheduled function entry point ───────────────────────────────────
export default async function handler() {
  const resendKey = process.env.RESEND_API_KEY;
  const toRaw = process.env.REPORT_EMAIL_TO;
  const from = process.env.REPORT_EMAIL_FROM ?? "SALUS Reports <reports@yourdomain.com>";

  if (!resendKey || !toRaw) {
    console.warn("RESEND_API_KEY or REPORT_EMAIL_TO not set — skipping email.");
    return;
  }

  const to = toRaw.split(",").map((e) => e.trim()).filter(Boolean);

  try {
    const formData = await fetchForms();
    const forms: Record<string, unknown>[] = formData.results ?? formData ?? [];
    const { subject, html } = buildEmail(forms);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Resend error: ${err}`);
    }

    console.log(`Daily report sent to ${to.join(", ")}`);
  } catch (err) {
    console.error("daily-report failed:", err);
  }
}

// Runs at 9am EST (14:00 UTC) Monday–Friday
export const config: Config = {
  schedule: "0 14 * * 1-5",
};
