import Link from "next/link";
import { notFound } from "next/navigation";
import { allLessons, lessonsOf, progress } from "@/lib/catalog";
import { getCatalog, getLessonPage, getMe, recordLastLesson } from "@/lib/db/aluno";
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
  const [{ user, profile, done, quizPassed }, tracks] = await Promise.all([getMe(), getCatalog()]);
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

  // Pontos-chave, texto e posição do vídeo: antes das migrações 0007/0008 dão erro e são ignorados.
  // Só o admin (pré-visualização) enxerga aula e texto em rascunho; para o aluno cada leitura filtra published.
  const [page] = await Promise.all([
    getLessonPage({ userId: user.id, lessonId: l.id, moduleIds: t.modules.map((m) => m.id), preview: profile.is_admin }),
    recordLastLesson(user.id, t.id, l.id),
  ]);
  const { chapters, materials, notes, questions, quizModuleIds: quizModules, keyPoints, serverAt, article } = page;

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
        chapters={chapters}
        materials={materials}
        notes={notes}
        questions={questions}
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
