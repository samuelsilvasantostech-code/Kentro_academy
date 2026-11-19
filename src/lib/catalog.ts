import { cache } from "react";
import { unstable_cache } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Lesson = {
  id: string;
  youtube_id: string | null;
  title: string;
  duration_seconds: number;
  summary: string | null;
  steps: string[];
};
export type Module = { id: string; title: string; position: number; lessons: Lesson[] };
export type Track = {
  id: string;
  name: string;
  audience: string;
  icon: string;
  color: string;
  pitch: string;
  outcomes: string[];
  position: number;
  modules: Module[];
};
/** Aula dentro de uma trilha: sabe em que módulo está e em que posição. */
export type TrackLesson = Lesson & { moduleIndex: number; moduleTitle: string; index: number };

type Row = Omit<Track, "modules"> & {
  modules: { id: string; title: string; position: number; module_lessons: { position: number; lessons: Lesson & { published: boolean } }[] }[];
};

/** Tag do cache do catálogo. As actions do admin que mexem em trilha, módulo ou aula chamam `updateTag(CATALOG_TAG)`. */
export const CATALOG_TAG = "catalogo";

type Client = Awaited<ReturnType<typeof createClient>>;

async function loadCatalog(supabase: Client): Promise<Track[]> {
  const { data, error } = await supabase
    .from("tracks")
    .select("*, modules(id, title, position, module_lessons(position, lessons(*)))")
    .order("position");
  if (error) throw error;
  return (data as Row[]).map(({ modules, ...t }) => ({
    ...t,
    modules: modules
      .sort((a, b) => a.position - b.position)
      .map((m) => ({
        id: m.id,
        title: m.title,
        position: m.position,
        // Rascunho nunca entra no catálogo do aluno (nem do admin: ele edita pelo /admin).
        lessons: m.module_lessons
          .filter((ml) => ml.lessons.published)
          .sort((a, b) => a.position - b.position)
          .map((ml) => ml.lessons),
      })),
  }));
}

/**
 * Catálogo dos alunos, guardado entre pedidos. Para quem não é admin, o RLS devolve o mesmo resultado
 * a todos (só trilhas publicadas, nada depende do aluno), então uma cópia serve para todos.
 * A consulta usa a sessão de quem pediu primeiro (o catálogo exige login; sem chave de serviço).
 * Vale até o admin publicar algo (updateTag) ou, no máximo, 5 min (rede de segurança para edições
 * feitas direto no banco).
 */
const cachedStudentCatalog = (supabase: Client) =>
  unstable_cache(() => loadCatalog(supabase), ["catalogo-aluno-v1"], { tags: [CATALOG_TAG], revalidate: 300 })();

/**
 * Catálogo inteiro (são ~70 aulas). O admin lê sempre direto do banco: o RLS dele também mostra
 * trilhas em rascunho, que não podem cair no cache dos alunos.
 */
export const getCatalog = cache(async (): Promise<Track[]> => {
  const [{ profile }, supabase] = await Promise.all([getMe(), createClient()]);
  return profile?.is_admin ? loadCatalog(supabase) : cachedStudentCatalog(supabase);
});

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

export type Profile = {
  id: string;
  full_name: string;
  company: string | null;
  role_track: string | null;
  experience: string | null;
  is_admin: boolean;
  last_track_id: string | null;
  last_lesson_id: string | null;
};

/**
 * Usuário logado, perfil e progresso. Sem sessão, vai para /entrar.
 * getClaims valida o token localmente (assinatura assimétrica), sem ida ao Auth. As actions que gravam
 * continuam usando getUser, que também detecta sessão revogada.
 */
export const getMe = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect("/entrar");
  const user = { id: claims.sub, email: typeof claims.email === "string" ? claims.email : "" };
  const [{ data: profile }, { data: done }, { data: quizzes }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("lesson_progress").select("lesson_id").eq("user_id", user.id),
    supabase.from("quiz_attempts").select("module_id, score, total").eq("user_id", user.id),
  ]);
  return {
    user,
    profile: profile as Profile,
    done: new Set((done ?? []).map((r) => r.lesson_id as string)),
    quizDone: new Set((quizzes ?? []).map((r) => r.module_id as string)),
    /** Módulos com tentativa aprovada (mesma regra do banco: nota >= 70%). */
    quizPassed: new Set((quizzes ?? []).filter((r) => r.total > 0 && r.score * 100 >= 70 * r.total).map((r) => r.module_id as string)),
  };
});

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
