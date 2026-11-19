import type { Track } from "@/lib/catalog";

/**
 * Próxima trilha a sugerir depois de `currentId`: a primeira, na ordem do catálogo, que vem depois da atual
 * e ainda não tem certificado; se não houver, a primeira sem certificado antes dela. Null se todas estão feitas.
 */
export function nextTrack(tracks: Track[], currentId: string, certified: (id: string) => boolean): Track | null {
  const i = tracks.findIndex((t) => t.id === currentId);
  const order = i < 0 ? tracks : [...tracks.slice(i + 1), ...tracks.slice(0, i)];
  return order.find((t) => t.id !== currentId && !certified(t.id) && t.modules.some((m) => m.lessons.length)) ?? null;
}
