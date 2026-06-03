// Vercel Cron Job — runs every 5 minutes on weekdays
// Checks for new forms AND overdue required forms, sends push notifications
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getFormInstances } from "@/lib/salus";
import webpush from "web-push";

webpush.setVapidDetails(
  "mailto:juliuz.santos@versysgroup.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

// UTC offset hours for each timezone (standard time — DST handled approximately)
const TZ_OFFSETS: Record<string, number> = {
  "US/Eastern": -5, "Canada/Eastern": -5,
  "US/Central": -6,
  "US/Mountain": -7, "Canada/Mountain": -7,
  "US/Pacific": -8,
  "US/Michigan": -5,
};

// Site name → timezone mapping from SALUS project data
const SITE_TIMEZONES: Record<string, string> = {
  "🇨🇦 26019 Suncor SELC 2026 OMNI Replacement": "Canada/Mountain",
  "🇺🇸 26449 Florence Copper Lab Furnace Building": "US/Mountain",
  "🇺🇸 26448 TC Energy MS595 Meter Station Rebuild": "US/Central",
  "🇺🇸 26268 TC Energy Gillis Access West Expansion Compressor Station": "US/Central",
  "🇺🇸 South West US Office": "US/Mountain",
  "🇨🇦 Grand Prairie Office": "Canada/Mountain",
  "🇺🇸 26446 TC Energy ANRP Chester Replace Main Gas Separator": "Canada/Eastern",
  "🇺🇸 26444 TC Energy Muttonville Boiler Replacement": "US/Eastern",
  "🇺🇸 26443 Florence Copper Vibration System": "US/Mountain",
  "🇺🇸 26436 Enbridge Thomaston Pre-Commissioning": "US/Central",
  "🇺🇸 26423 Enbridge Charco Compressor Retrofit": "US/Central",
  "🇺🇸 26422 TC Energy Skipper Road Meter Station Brickhouse": "US/Eastern",
  "🇺🇸 26421 TCE HSH Station Automation Upgrade": "US/Central",
  "🇺🇸 26420 TC Energy ANRS EX6 Slug Catcher LCV Replacement": "US/Eastern",
  "🇺🇸 26415 TC Energy ANR Defiance CS CG": "US/Eastern",
  "🇺🇸 26414 Florence Copper Scale and Guard Shack": "US/Mountain",
  "🇨🇦 26005 TC Energy Meikle River CS Power Upgrade": "Canada/Mountain",
  "🇺🇸 26404 TC Energy Woolfolk TSA Auto Upgrade": "US/Eastern",
  "🇨🇦 26015 Brittania 21024 HI OTB Development": "Canada/Mountain",
  "🇨🇦 26014 TC Energy Gold Creek CS LOC & Cooler Replacement": "Canada/Mountain",
  "🇺🇸 26413 Transtek Transfer Installation": "US/Central",
  "🇺🇸 26398 TC Energy WRP Weyauwega 2026": "US/Central",
  "🇺🇸 26399 TC Energy WRP Kewaskum 2026": "US/Central",
  "🇺🇸 26397 TC Energy WRP Janesville": "US/Central",
  "🇺🇸 26408 TC Energy Glady CS MCC Replacement": "US/Eastern",
  "🇺🇸 26412 TC Energy Eastport Unit 3B Seal Gas Boost Pump": "US/Mountain",
  "🇺🇸 26411 TC Energy 22912 Lucas SF-SL2151 ": "US/Eastern",
  "🇺🇸 26410 TC Energy Lucas CS Replace UST": "US/Eastern",
  "🇺🇸 26409 TC Energy 229802 Lucas SF-SL2340": "US/Eastern",
  "🇺🇸 26405 TC Energy E.032628 2303359 Linebreak Control Analysis": "US/Eastern",
  "🇺🇸 26406 TC Energy E.032626 2303357 Linebreak Control Analysis": "US/Eastern",
  "🇺🇸 18026 Versys Woodlands HQ": "US/Central",
  "🇨🇦 17004 Versys HQ New Office": "Canada/Mountain",
  "🇺🇸 26403 TC Energy RAP Automation Equip Replacement TSA": "US/Eastern",
  "🇺🇸 26402 Torro Specialties Kymera Gas Analyzer Replacement and Commissioning": "US/Central",
  "🇺🇸 26400 TC Energy ANR Loreed Replace Air Compressor": "US/Eastern",
  "🇺🇸 26379 TC Energy ANR Heartland Project (AHP)": "US/Central",
  "🇨🇦 26012 TC Energy E.025978 Stn 99C Unit Control Panel Replacement": "Canada/Eastern",
  "🇺🇸 26394 TC Energy Linden Church MS803686 Station Rebuild ": "US/Eastern",
  "🇺🇸 26380 TC Energy Woolfolk Station 2 Boiler Replacement": "US/Central",
  "🇺🇸 26349 TC Energy 2026 Holmes CS Total Automation Upgrade": "US/Eastern",
  "🇺🇸 26330 TC Energy 2026 GLGT MOD Program Shevlin": "US/Central",
  "🇺🇸 🇨🇦 Work from Home (remote)": "US/Central",
  "🇺🇸 26345 TC Energy IRR CS Replace Fire and Gas Detection": "US/Central",
  "🇺🇸 26341 TC Energy GLGT St. Vincent C/S": "US/Central",
  "🇺🇸 25624 TC Energy Chesapeake LNG Firewater Pump Replacement": "US/Eastern",
  "🇺🇸 26304 TC Energy CGT Ridgeline POD": "US/Central",
  "🇺🇸 26303 Fasken MV and Commissioning Support": "US/Central",
  "🇺🇸 26302 TC Energy 2026 GLGT HP Replacement Project- Naubingway CS": "US/Eastern",
  "🇺🇸 26291 TC Energy GLGT MOD Program Farewell": "US/Eastern",
  "🇺🇸 26293 TC Energy 2026 GLGT MOD Program Farewell": "US/Eastern",
  "🇺🇸 26292 TC Energy GLGT MOD Program Naubinway": "US/Eastern",
  "🇺🇸25647 TC Energy Glen Ullin Compressor Station (Bison XP)": "US/Central",
  "🇺🇸 26264 TC Energy Gillis Access West Reeves POR": "US/Central",
  "🇺🇸 26262 TC Energy Gillis Access West Ellis Moss POD": "US/Central",
  "🇺🇸 26263 TC Energy Gillis Access West Le Blanc POR": "US/Central",
  "🇺🇸 26265 TC Energy Gillis Access West Ragley POR": "US/Central",
  "🇺🇸 26266 TCE Gillis Access West Pipeline": "US/Central",
  "🇺🇸 26267 TC Energy Gillis Access West Expansion": "US/Central",
  "🇺🇸 26246 TC Energy Trimont Fuel Gas Heater RB211": "US/Central",
  "🇨🇦 26001 IPL Pioneer 1 UPS2 & UPS4 Install and Demo": "Canada/Mountain",
  "🇺🇸 26204 Enbridge Hanover M&R 70949 Stn Upgrade": "US/Eastern",
  "🇺🇸 26200 Enbridge 4th Dehy TPGS Commissioning": "US/Central",
  "🇨🇦 25021 TC Energy Mount Bracey Compressor Station": "Canada/Mountain",
  "🇺🇸 25662 Enbridge Lebanon Compressor Station": "US/Eastern",
  "🇺🇸25649 TC Energy Buffalo Meter Station (Bison XP)": "US/Mountain",
  "🇺🇸  25650 TC Energy Arnegard Compressor Station": "US/Central",
  "🇺🇸 25651 TC Energy Manning Compressor Station (Bison XP)": "US/Central",
  "🇨🇦 25015 South Bow 2025CO KSCAD Hardisty Booster Pump": "Canada/Mountain",
  "🇺🇸 25634 TC Energy Crystal Falls HP Upgrade Commissioning and Start Up": "US/Michigan",
  "🇺🇸 25633 TC Energy CLGT Deer River CS HP Upgrade": "US/Central",
  "🇨🇦 25009 South Bow Blackrod Connection": "Canada/Mountain",
  "🇺🇸 25615 TC Energy Emporia CS Commissioning VRP": "US/Eastern",
};

function getLocalHour(siteName: string): number {
  const tz = SITE_TIMEZONES[siteName] ?? "US/Central";
  const offset = TZ_OFFSETS[tz] ?? -6;
  // Approximate DST: add 1 hour Mar-Nov
  const now = new Date();
  const month = now.getUTCMonth();
  const dst = month >= 2 && month <= 10 ? 1 : 0;
  return (now.getUTCHours() + offset + dst + 24) % 24;
}

function isToday(dateStr: string): boolean {
  if (!dateStr) return false;
  return new Date(dateStr).toDateString() === new Date().toDateString();
}

function isThisWeek(dateStr: string): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  start.setHours(0, 0, 0, 0);
  return d >= start;
}

function isThisMonth(dateStr: string): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

const REQUIRED_FORMS = [
  { name: "Daily JSA / Toolbox Talk", keywords: ["jsa", "toolbox", "flra"], frequency: "daily" as const },
  { name: "Daily Commissioning Report", keywords: ["commissioning progress"], frequency: "daily" as const },
  { name: "Vehicle & Trailer Inspection", keywords: ["vehicle", "trailer inspection"], frequency: "daily" as const },
  { name: "Weekly Construction Report", keywords: ["weekly construction", "weekly report"], frequency: "weekly" as const },
  { name: "Site Safety Inspection", keywords: ["site safety inspection"], frequency: "weekly" as const },
  { name: "Contractor Safety Evaluation", keywords: ["contractor safety", "evaluation checklist"], frequency: "monthly" as const },
  { name: "Training Record", keywords: ["training record"], frequency: "monthly" as const },
];

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { results: forms } = await getFormInstances({ limit: 200 });
    const { data: subs } = await supabase.from("push_subscriptions").select("subscription");
    if (!subs || subs.length === 0) return NextResponse.json({ ok: true, sent: 0 });

    const notifications: { title: string; body: string }[] = [];

    // 1. New/recently changed forms (last 6 min)
    const since = new Date(Date.now() - 6 * 60 * 1000).toISOString();
    const recentForms = forms.filter((f) => f.updated_at > since);
    for (const form of recentForms) {
      const isComplete = ["completed", "submitted", "approved"].includes((form.status || "").toLowerCase());
      const person = form.submitted_by || form.created_by || "Someone";
      const site = (form.site_name || "").replace(/^[^\w\d(]+/, "");
      notifications.push({
        title: isComplete ? "✓ Form Completed" : "⚑ Form Flagged",
        body: `${person} · ${form.form_template_name}${site ? ` · ${site}` : ""}`,
      });
    }

    // 2. Overdue required forms — check at 6pm local time per project
    const bySite = new Map<string, typeof forms>();
    for (const form of forms) {
      const site = form.site_name || "Unknown";
      if (!bySite.has(site)) bySite.set(site, []);
      bySite.get(site)!.push(form);
    }

    const now = new Date();
    const isWeekday = now.getUTCDay() >= 1 && now.getUTCDay() <= 5;
    const isFriday = now.getUTCDay() === 5;

    if (isWeekday) {
      for (const [siteName, siteForms] of Array.from(bySite.entries())) {
        const localHour = getLocalHour(siteName);
        const shortSite = siteName.replace(/^[^\w\d(]+/, "").substring(0, 40);

        // Check daily forms after 5pm local time
        if (localHour >= 17) {
          for (const req of REQUIRED_FORMS.filter(r => r.frequency === "daily")) {
            const submitted = siteForms.some(f =>
              req.keywords.some(kw => f.form_template_name.toLowerCase().includes(kw)) &&
              isToday(f.updated_at) &&
              ["completed", "submitted", "approved"].includes((f.status || "").toLowerCase())
            );
            if (!submitted) {
              notifications.push({
                title: "⚑ Daily Form Overdue",
                body: `${req.name} not submitted today · ${shortSite}`,
              });
            }
          }
        }

        // Check weekly forms on Fridays after 3pm local time
        if (isFriday && localHour >= 15) {
          for (const req of REQUIRED_FORMS.filter(r => r.frequency === "weekly")) {
            const submitted = siteForms.some(f =>
              req.keywords.some(kw => f.form_template_name.toLowerCase().includes(kw)) &&
              isThisWeek(f.updated_at) &&
              ["completed", "submitted", "approved"].includes((f.status || "").toLowerCase())
            );
            if (!submitted) {
              notifications.push({
                title: "⚑ Weekly Form Overdue",
                body: `${req.name} not submitted this week · ${shortSite}`,
              });
            }
          }
        }

        // Check monthly forms on last Friday of month
        const lastFridayOfMonth = isFriday && new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate() < 7;
        if (lastFridayOfMonth && localHour >= 15) {
          for (const req of REQUIRED_FORMS.filter(r => r.frequency === "monthly")) {
            const submitted = siteForms.some(f =>
              req.keywords.some(kw => f.form_template_name.toLowerCase().includes(kw)) &&
              isThisMonth(f.updated_at) &&
              ["completed", "submitted", "approved"].includes((f.status || "").toLowerCase())
            );
            if (!submitted) {
              notifications.push({
                title: "⚑ Monthly Form Overdue",
                body: `${req.name} not submitted this month · ${shortSite}`,
              });
            }
          }
        }
      }
    }

    // Remove duplicates and send
    const unique = notifications.slice(0, 10); // max 10 per run to avoid spam
    let sent = 0;
    for (const notif of unique) {
      const payload = JSON.stringify({ title: notif.title, body: notif.body, url: "/workflow" });
      for (const sub of subs) {
        try {
          await webpush.sendNotification(JSON.parse(sub.subscription), payload);
          sent++;
        } catch {
          const parsed = JSON.parse(sub.subscription);
          await supabase.from("push_subscriptions").delete().eq("endpoint", parsed.endpoint);
        }
      }
    }

    return NextResponse.json({ ok: true, sent, notifications: unique.length });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
