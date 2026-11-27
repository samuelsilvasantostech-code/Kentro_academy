import { createClient } from "../client";
import type { DbError } from "../../types";
import type { NewsInput } from "../../admin/types";

export async function updateNewsRow(id: string, row: NewsInput): Promise<{ found: boolean; error: DbError }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("news").update(row).eq("id", id).select("id");
  return { found: !!data?.length, error };
}

/** Cria a novidade no fim da lista. */
export async function insertNews(row: NewsInput): Promise<{ id: string | null; error: DbError }> {
  const supabase = await createClient();
  const { data: last } = await supabase.from("news").select("position").order("position", { ascending: false }).limit(1);
  const { data, error } = await supabase.from("news").insert({ ...row, position: (last?.[0]?.position ?? 0) + 1 }).select("id").single();
  return { id: error ? null : (data.id as string), error };
}

export async function removeNews(id: string): Promise<DbError> {
  const supabase = await createClient();
  const { error } = await supabase.from("news").delete().eq("id", id);
  return error;
}

export async function listNewsIds(): Promise<{ ids: string[]; error: DbError }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("news").select("id").order("position").order("id");
  return { ids: (data ?? []).map((r) => r.id as string), error };
}

export async function reorderNews(ids: string[]): Promise<DbError> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_reorder_news", { p_ids: ids });
  return error;
}
