import { createClient } from "../client";
import type { DbError } from "../../types";
import type { TrackInput } from "../../admin/types";

export async function updateTrackRow(slug: string, row: TrackInput): Promise<{ found: boolean; error: DbError }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("tracks").update(row).eq("id", slug).select("id");
  return { found: !!data?.length, error };
}

/** Cria a trilha no fim da lista. */
export async function insertTrack(slug: string, row: TrackInput): Promise<DbError> {
  const supabase = await createClient();
  const { data: last } = await supabase.from("tracks").select("position").order("position", { ascending: false }).limit(1);
  const { error } = await supabase.from("tracks").insert({ id: slug, ...row, position: (last?.[0]?.position ?? 0) + 1 });
  return error;
}

export async function removeTrack(slug: string): Promise<DbError> {
  const supabase = await createClient();
  const { error } = await supabase.from("tracks").delete().eq("id", slug);
  return error;
}

export async function listTrackIds(): Promise<{ ids: string[]; error: DbError }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("tracks").select("id").order("position").order("id");
  return { ids: (data ?? []).map((r) => r.id as string), error };
}

export async function reorderTracks(ids: string[]): Promise<DbError> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_reorder_tracks", { p_ids: ids });
  return error;
}
