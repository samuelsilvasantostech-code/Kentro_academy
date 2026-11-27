import { createClient } from "../client";
import type { DbError } from "../../types";

export async function renameModule(id: string, title: string): Promise<{ found: boolean; error: DbError }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("modules").update({ title }).eq("id", id).select("id");
  return { found: !!data?.length, error };
}

/** Cria o módulo no fim da trilha. */
export async function insertModule(trackId: string, title: string): Promise<{ id: string | null; error: DbError }> {
  const supabase = await createClient();
  const { data: last } = await supabase.from("modules").select("position").eq("track_id", trackId).order("position", { ascending: false }).limit(1);
  const { data, error } = await supabase
    .from("modules")
    .insert({ track_id: trackId, title, position: (last?.[0]?.position ?? 0) + 1 })
    .select("id")
    .single();
  return { id: error ? null : (data.id as string), error };
}

export async function removeModule(id: string): Promise<DbError> {
  const supabase = await createClient();
  const { error } = await supabase.from("modules").delete().eq("id", id);
  return error;
}

export async function getModuleTrackId(id: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("modules").select("track_id").eq("id", id).maybeSingle();
  return data ? (data.track_id as string) : null;
}

export async function listTrackModuleIds(trackId: string): Promise<{ ids: string[]; error: DbError }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("modules").select("id").eq("track_id", trackId).order("position").order("id");
  return { ids: (data ?? []).map((r) => r.id as string), error };
}

export async function reorderModules(trackId: string, ids: string[]): Promise<DbError> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_reorder_modules", { p_track: trackId, p_ids: ids });
  return error;
}
