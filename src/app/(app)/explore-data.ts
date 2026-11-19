import type { LessonItem, TrackItem } from "@/components/explorer";
import { lessonsOf, progress, type Track } from "@/lib/catalog";
import { trackKind } from "@/lib/category";
import { normalize } from "@/lib/format";
import type { TrackStatus } from "./certificado/completion";

/** Dados do explorador (busca + filtros) a partir do catálogo real e do progresso do aluno. */
export function exploreData(tracks: Track[], done: Set<string>, statuses: Map<string, TrackStatus>, recId?: string) {
  const items: TrackItem[] = tracks.map((t) => {
    const p = progress(t, done);
    const s = statuses.get(t.id);
    const { cat, art } = trackKind(t);
    const L = lessonsOf(t);
    return {
      id: t.id,
      name: t.name,
      pitch: t.pitch,
      audience: t.audience,
      cat,
      art,
      count: p.count,
      seconds: p.seconds,
      pct: p.pct,
      started: p.done > 0,
      tag: s?.hasNew ? "Novo conteúdo" : s?.certified ? "Concluída" : t.id === recId ? "Recomendada" : p.done > 0 ? "Em andamento" : null,
      text: normalize([t.name, t.pitch, t.audience, ...t.modules.map((m) => m.title), ...L.map((l) => l.title)].join(" ")),
    };
  });
  // Uma aula pode estar em mais de uma trilha: aparece uma vez, na primeira trilha.
  const seen = new Set<string>();
  const lessons: LessonItem[] = tracks.flatMap((t) => {
    const { cat } = trackKind(t);
    return lessonsOf(t).filter((l) => !seen.has(l.id) && !!seen.add(l.id)).map((l) => ({
      id: l.id,
      title: l.title,
      trackId: t.id,
      trackName: t.name,
      moduleTitle: l.moduleTitle,
      seconds: l.duration_seconds,
      done: done.has(l.id),
      cat,
      text: normalize(`${l.title} ${l.moduleTitle} ${l.summary ?? ""} ${l.steps.join(" ")}`),
    }));
  });
  return { items, lessons };
}
