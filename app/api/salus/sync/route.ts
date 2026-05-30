// Sync projects directly from SALUS API into Supabase
import { NextResponse } from "next/server";
import { getSites } from "@/lib/salus";
import { createProject, getProjects } from "@/lib/supabase";

export async function POST() {
  try {
    const [sites, existing] = await Promise.all([getSites(), getProjects()]);
    const existingNames = new Set(existing.map((p) => p.name));

    let added = 0;
    const skipped: string[] = [];

    for (const site of sites) {
      if (!site.name || site.name === "Unknown") continue;
      if (existingNames.has(site.name)) { skipped.push(site.name); continue; }
      await createProject({
        name: site.name,
        site_location: site.city || "TBD",
        status: site.status === "archived" ? "inactive" : "active",
        required_forms: [],
      });
      added++;
    }

    return NextResponse.json({ ok: true, added, skipped: skipped.length, total: sites.length });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
