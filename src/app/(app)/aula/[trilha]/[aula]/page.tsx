import Link from "next/link";
import { notFound } from "next/navigation";
import { allLessons, getCatalog, getMe, lessonsOf, progress } from "@/lib/catalog";
import { createClient } from "@/lib/supabase/server";
import { duration } from "@/lib/format";
import { Ico } from "@/components/ico";
import { LessonView } from "./lesson-view";

type P = { params: Promise<{ trilha: string; aula: string }>; searchParams: Promise<{ aba?: string }> };

export async function generateMetadata({ params }: P) {
  const { trilha, aula } = await params;
  const t = (await getCatalog()).find((x) => x.id === trilha);
  return { title: t && lessonsOf(t).find((l) => l.id === aula)?.title || "Aula" };
}

export default async function Aula({ params, searchParams }: P) {
  const { trilha, aula } = await params;
  const { aba } = await searchParams;
  const [{ user, done, quizPassed }, tracks] = await Promise.all([getMe(), getCatalog()]);
  const t = tracks.find((x) => x.id === trilha);
  if (!t) notFound();
  const L = lessonsOf(t);
  const i = L.findIndex((l) => l.id === aula);
  if (i < 0) notFound();
  const l = L[i];
  const prev = L[i - 1];
  const next = L[i + 1];
  const p = progress(t, done);
  const others = (allLessons(tracks).find((x) => x.id === l.id)?.trackIds ?? []).filter((x) => x !== t.id)
    .map((id) => tracks.find((x) => x.id === id)!);

  const supabase = await createClient();
  // Pontos-chave e posição do vídeo vêm em consultas próprias: antes da migração 0007 dão erro e são ignoradas.
  // O texto da aula (migração 0008) também: o RLS só entrega rascunho para admin.
  const [{ data: chapters }, { data: materials }, { data: notes }, { data: questions }, { data: quizRows }, , kp, vp, tx] = await Promise.all([
    supabase.from("chapters").select("start_seconds, title").eq("lesson_id", l.id).order("start_seconds"),
    supabase.from("materials").select("id, title, description, url").eq("lesson_id", l.id).order("position"),
    supabase.from("notes").select("id, body, created_at").eq("lesson_id", l.id).eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("lesson_questions").select("id, body, answer, created_at, answered_at, answer_seen_at").eq("lesson_id", l.id).eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("quiz_questions").select("module_id").in("module_id", t.modules.map((m) => m.id)),
    supabase.from("profiles").update({ last_track_id: t.id, last_lesson_id: l.id }).eq("id", user.id),
    supabase.from("lessons").select("key_points").eq("id", l.id).maybeSingle(),
    supabase.from("video_progress").select("seconds").eq("user_id", user.id).eq("lesson_id", l.id).maybeSingle(),
    supabase.from("lesson_texts").select("body, published").eq("lesson_id", l.id).maybeSingle(),
  ]);
  const article = tx.data?.body?.trim() ? { md: tx.data.body as string, draft: !tx.data.published } : null;
  const keyPoints = (kp.data?.key_points as string[] | undefined) ?? [];
  const serverAt = typeof vp.data?.seconds === "number" ? vp.data.seconds : null;
  const quizModules = new Set((quizRows ?? []).map((r) => r.module_id as string));


  return (
    <div className="player-grid">
      <LessonView
        track={{ id: t.id, name: t.name }}
        lesson={l}
        position={{ index: i + 1, total: L.length }}
        prevId={prev?.id}
        hasNext={!!next}
        done={done.has(l.id)}
        others={others.map((o) => ({ id: o.id, name: o.name }))}
        chapters={chapters ?? []}
        materials={materials ?? []}
        notes={notes ?? []}
        questions={questions ?? []}
        keyPoints={keyPoints}
        serverAt={serverAt}
        article={article}
        initialTab={aba === "duvidas" ? "duvidas" : undefined}
      />
      <aside className="side" aria-label="Conteúdo da trilha">
        <div className="side-top">
          <span className="side-k">Aulas da trilha</span>
          <b>{t.name}</b>
          <div className="bar" role="progressbar" aria-label="Progresso na trilha" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p.pct}><i style={{ width: `${p.pct}%` }} /></div>
          <span className="side-prog">{p.done} de {p.total} {p.total === 1 ? "aula com vídeo concluída" : "aulas com vídeo concluídas"}, {p.pct}%</span>
        </div>
        <div className="side-list">
          {t.modules.map((m, mi) => {
            const d = m.lessons.filter((x) => done.has(x.id)).length;
            return (
              <details key={m.id} className="side-sec" open={mi === l.moduleIndex}>
                <summary className="side-mod">
                  <span>{mi + 1}. {m.title}</span>
                  <span className="side-mod-n">{d}/{m.lessons.length}</span>
                  <Ico name="down" size={16} className="side-chev" />
                </summary>
                {m.lessons.map((x) => (
                  <Link key={x.id} className={`li ${x.id === l.id ? "cur" : ""}`} href={`/aula/${t.id}/${x.id}`} aria-current={x.id === l.id ? "page" : undefined}>
                    <span className={`chk ${done.has(x.id) ? "on" : ""}`}>{done.has(x.id) ? <Ico name="check" size={13} strokeWidth={3} /> : null}</span>
                    <span className="t">{x.title}{done.has(x.id) && <span className="sr-only"> (concluída)</span>}</span><span className="dur">{x.duration_seconds ? duration(x.duration_seconds) : "Leitura"}</span>
                  </Link>
                ))}
                {quizModules.has(m.id) && (
                  <Link className="li quiz" href={`/quiz/${t.id}/${mi}`}><span className={`chk chk-q ${quizPassed.has(m.id) ? "on" : ""}`}>{quizPassed.has(m.id) ? <Ico name="check" size={13} strokeWidth={3} /> : <Ico name="help" size={13} strokeWidth={2.4} />}</span><span className="t">Quiz do módulo{quizPassed.has(m.id) && <span className="sr-only"> (aprovado)</span>}</span></Link>
                )}
              </details>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
