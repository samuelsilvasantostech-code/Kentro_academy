// Tipos e regras puras do catálogo (sem acesso a dados). A leitura do catálogo e do aluno fica em "@/lib/db/aluno".
import type { Lesson, Track } from "@/lib/db/aluno/types";

export type { Lesson, Module, Track, Profile } from "@/lib/db/aluno/types";

/** Aula dentro de uma trilha: sabe em que módulo está e em que posição. */
export type TrackLesson = Lesson & { moduleIndex: number; moduleTitle: string; index: number };

export const lessonsOf = (t: Track): TrackLesson[] => {
  let index = 0;
  return t.modules.flatMap((m, moduleIndex) =>
    m.lessons.map((l) => ({ ...l, moduleIndex, moduleTitle: m.title, index: index++ })),
  );
};

/** Aulas únicas com as trilhas em que aparecem. */
export const allLessons = (tracks: Track[]) => {
  const map = new Map<string, TrackLesson & { trackIds: string[] }>();
  tracks.forEach((t) =>
    lessonsOf(t).forEach((l) => {
      const found = map.get(l.id);
      if (found) found.trackIds.push(t.id);
      else map.set(l.id, { ...l, trackIds: [t.id] });
    }),
  );
  return [...map.values()];
};

/** Aula que conta para o progresso e para o certificado: publicada (o catálogo já filtra) e com vídeo. */
export const isRequired = (l: Lesson) => !!l.youtube_id;

/**
 * Regra única de progresso (a mesma do certificado, track_completion): só aulas com vídeo contam.
 * Aula de leitura (sem vídeo) fica fora do denominador e, se concluída, também não entra no numerador.
 * `count` é o total de aulas para exibição.
 */
export function progress(t: Track, done: Set<string>) {
  const L = lessonsOf(t);
  const R = L.filter(isRequired);
  const d = R.filter((l) => done.has(l.id)).length;
  return {
    done: d,
    total: R.length,
    count: L.length,
    pct: R.length ? Math.round((d / R.length) * 100) : 0,
    seconds: L.reduce((a, l) => a + l.duration_seconds, 0),
    secondsLeft: R.filter((l) => !done.has(l.id)).reduce((a, l) => a + l.duration_seconds, 0),
  };
}

export const nextOf = (t: Track, done: Set<string>) => {
  const L = lessonsOf(t);
  return L.find((l) => !done.has(l.id)) ?? L[0];
};
