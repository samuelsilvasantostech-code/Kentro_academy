import type { Track } from "@/lib/catalog";
import { createClient } from "@/lib/supabase/server";
import { buildFlow, type Flow } from "@/components/flow/model";

/** Ids dos módulos que têm quiz (com perguntas) nas trilhas dadas. Só leitura. */
export async function quizModuleIds(tracks: Track[]): Promise<Set<string>> {
  const ids = tracks.flatMap((t) => t.modules.map((m) => m.id));
  if (!ids.length) return new Set();
  const supabase = await createClient();
  const { data } = await supabase.from("quiz_questions").select("module_id").in("module_id", ids);
  return new Set((data ?? []).map((r) => r.module_id as string));
}

/** Um Flow (objeto simples, seguro para Client Component) por trilha. */
export function flowsOf(tracks: Track[], done: Set<string>, quizPassed: Set<string>, quizModules: Set<string>): Map<string, Flow> {
  return new Map(tracks.map((t) => [t.id, buildFlow(t, done, quizPassed, quizModules)]));
}
