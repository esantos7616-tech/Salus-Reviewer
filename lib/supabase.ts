import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, key);

// ── Types ─────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  site_location: string;
  status: "active" | "inactive";
  required_forms: string[];
  created_at: string;
}

export interface TeamMember {
  id: string;
  project_id: string;
  name: string;
  email?: string;
  role: string;
  salus_name?: string; // name as it appears in SALUS submissions
}

// ── Projects ──────────────────────────────────────────────────────────

export async function getProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createProject(
  project: Omit<Project, "id" | "created_at">
): Promise<Project> {
  const { data, error } = await supabase
    .from("projects")
    .insert(project)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateProject(
  id: string,
  updates: Partial<Omit<Project, "id" | "created_at">>
): Promise<void> {
  const { error } = await supabase.from("projects").update(updates).eq("id", id);
  if (error) throw error;
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw error;
}

// ── Team Members ──────────────────────────────────────────────────────

export async function getTeamMembers(projectId?: string): Promise<TeamMember[]> {
  let query = supabase.from("team_members").select("*").order("name");
  if (projectId) query = query.eq("project_id", projectId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function createTeamMember(
  member: Omit<TeamMember, "id">
): Promise<TeamMember> {
  const { data, error } = await supabase
    .from("team_members")
    .insert(member)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTeamMember(id: string): Promise<void> {
  const { error } = await supabase.from("team_members").delete().eq("id", id);
  if (error) throw error;
}
