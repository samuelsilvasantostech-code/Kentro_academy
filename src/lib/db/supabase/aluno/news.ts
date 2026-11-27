import { createClient } from "../client";
import type { NewsItem } from "../../aluno/types";

/** Novidades publicadas, na ordem do admin. */
export async function loadPublishedNews(limit: number): Promise<NewsItem[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("news").select("*").eq("published", true).order("position").limit(limit);
  return (data ?? []) as NewsItem[];
}
