import Link from "next/link";
import { notFound } from "next/navigation";
import { getCatalog, getMe, nextOf, progress } from "@/lib/catalog";
import { createClient } from "@/lib/supabase/server";
import { duration, minutes } from "@/lib/format";
import { getTrackStatuses } from "../../certificado/completion";
import { nextTrack } from "@/lib/next-track";
import { Ico } from "@/components/ico";
import { Cover } from "@/components/cover";
import { coverOf } from "@/lib/covers";
import { COVERS, trackKind } from "@/lib/category";
import { trackCopy } from "@/lib/track-copy";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = (await getCatalog()).find((x) => x.id === id);
  return { title: t?.name ?? "Trilha" };
}

const Tick = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;

export default async function Trilha({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ concluida?: string }> }) {
  const { id } = await params;
  const { concluida } = await searchParams;
  // A situação do certificado começa junto (usa o mesmo getMe/getCatalog do pedido).
  const statusesP = getTrackStatuses();
  statusesP.catch(() => {}); // se a trilha não existir, o notFound abaixo sai antes de esperar
  const [{ done, quizPassed }, tracks] = await Promise.all([getMe(), getCatalog()]);
  const t = tracks.find((x) => x.id === id);
  if (!t) notFound();
  const p = progress(t, done);
  const nx = p.count ? nextOf(t, done) : null;

  const supabase = await createClient();
  const [{ data: qrows }, statuses] = await Promise.all([
    supabase.from("quiz_questions").select("module_id").in("module_id", t.modules.map((m) => m.id)),
    statusesP,
  ]);
  const quizCount = new Map<string, number>();
  (qrows ?? []).forEach((r) => quizCount.set(r.module_id, (quizCount.get(r.module_id) ?? 0) + 1));
  const quizzes = t.modules.filter((m) => quizCount.get(m.id));
  const st = statuses.get(t.id);
  const earned = !!st?.certified;
  const nextT = earned ? nextTrack(tracks, t.id, (x) => !!statuses.get(x)?.certified) : null;
  // O que falta, em palavras: "faltam 3 aulas + 2 quizzes".
  const lessonsLeft = p.total - p.done;
  const quizzesLeft = quizzes.filter((m) => !quizPassed.has(m.id)).length;
  const left = [
    lessonsLeft > 0 && `${lessonsLeft} ${lessonsLeft === 1 ? "aula" : "aulas"}`,
    quizzesLeft > 0 && `${quizzesLeft} ${quizzesLeft === 1 ? "quiz" : "quizzes"}`,
  ].filter(Boolean).join(" + ");
  const leftText = left ? `${lessonsLeft + quizzesLeft === 1 ? "Falta" : "Faltam"} ${left}${p.secondsLeft > 0 ? ` (cerca de ${minutes(p.secondsLeft)})` : ""}.` : earned ? "Trilha concluída." : "Tudo feito. Seu certificado está liberado.";
  // Só o módulo onde o aluno está fica aberto (o da próxima aula; se a trilha acabou, nenhum).
  const openModule = nx && lessonsLeft > 0 ? nx.moduleIndex : -1;

  const copy = trackCopy(t);
  const { art } = trackKind(t);
  const cv = COVERS[art];
  const first = p.done === 0;

  return (
    <>
      <nav className="bc" aria-label="Você está em"><ol><li><Link href="/trilhas">Trilhas</Link></li><li><span aria-current="page">{t.name}</span></li></ol></nav>
      {concluida && st?.completed && <p className="ok-msg" style={{ marginBottom: 16 }}>Trilha concluída! Parabéns.</p>}
      {nextT && (
        <aside className="khelp next-track" style={{ marginBottom: 20 }}>
          <div><h2>Você concluiu esta trilha. Próxima: {nextT.name}</h2><p>{nextT.pitch}</p></div>
          <Link className="btn btn-p" href={`/trilha/${nextT.id}`}>Ver a próxima trilha<Ico name="arrowR" /></Link>
        </aside>
      )}

      <section className="th2" aria-labelledby="th2-t">
        <Cover img={coverOf(t.id)} icon={cv.icon} tilt={cv.tilt} sizes="100vw" priority className="th2-bg" />
        <span className="th2-stripes" aria-hidden />
        <div className="th2-in">
          <div className="th2-copy">
            <p className="th2-cat"><Ico name={cv.icon} size={14} />{cv.label}<span aria-hidden>·</span>{t.audience}</p>
            <h1 id="th2-t">{t.name}</h1>
            <p className="th2-head">{copy.headline}</p>
            <p className="th2-lead">{copy.lead}</p>
            <ul className="th2-stats" aria-label="Sobre a trilha">
              <li><Ico name="layers" size={16} /><b>{t.modules.length}</b> {t.modules.length === 1 ? "módulo" : "módulos"}</li>
              <li><Ico name="video" size={16} /><b>{p.count}</b> aulas</li>
              <li><Ico name="clock" size={16} /><b>{minutes(p.seconds)}</b></li>
              <li><Ico name="award" size={16} />Certificado</li>
            </ul>
            <div className="th2-cta">
              {nx && lessonsLeft > 0 && (
                <Link className="btn btn-p btn-lg th2-go" href={`/aula/${t.id}/${nx.id}`}>
                  <Ico name="play" size={16} />{first ? "Começar trilha" : "Continuar trilha"}
                </Link>
              )}
              {earned ? <Link className="btn btn-s btn-lg" href={`/certificado/${t.id}`}><Ico name="award" size={16} />Ver certificado</Link>
                : <a className="btn btn-ghost btn-lg" href="#conteudo">Ver o conteúdo</a>}
            </div>
            {nx && lessonsLeft > 0 && (
              <p className="th2-next"><span className="dim">{first ? "Primeira aula:" : "Próxima aula:"}</span> {nx.title}{nx.duration_seconds > 0 ? ` · ${duration(nx.duration_seconds)}` : ""}</p>
            )}
            {st?.hasNew && <span className="pill a">Novo conteúdo nesta trilha</span>}
          </div>

          <aside className="th2-card" aria-labelledby="th2-gain">
            <h2 id="th2-gain">Ao final você vai conseguir</h2>
            <ul className="th2-gains">{copy.gains.map((g) => <li key={g}><Ico name="check" size={15} strokeWidth={3} /><span>{g}</span></li>)}</ul>
            <div className="th2-prog">
              <div className="kprog"><span className="pbar" role="progressbar" aria-label="Progresso na trilha" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p.pct}><i style={{ width: `${p.pct}%` }} /></span><b>{p.pct}%</b></div>
              <p>{first ? `São ${p.count} aulas curtas. Seu progresso fica salvo e você continua de onde parou.` : leftText}</p>
            </div>
          </aside>
        </div>
      </section>


      <section className="sec" id="conteudo">
        <div className="sec-h"><h2>Conteúdo da trilha</h2><p className="sec-hint">{t.modules.length} {t.modules.length === 1 ? "módulo" : "módulos"}. Abra um módulo para ver as aulas.</p></div>
        {!p.count && (
          <div className="empty" style={{ marginTop: 16 }}>
            
            <h3>Esta trilha ainda não tem aulas</h3>
            <p className="muted">Estamos preparando o conteúdo. Enquanto isso, veja as outras trilhas.</p>
            <Link className="btn btn-s" href="/trilhas">Ver trilhas</Link>
          </div>
        )}
        {p.count > 0 && <div className="timeline">
          {t.modules.map((m, mi) => {
            const d = m.lessons.filter((l) => done.has(l.id)).length;
            const all = m.lessons.length > 0 && d === m.lessons.length;
            const secs = m.lessons.reduce((a, l) => a + l.duration_seconds, 0);
            const nq = quizCount.get(m.id) ?? 0;
            return (
              <details key={m.id} className={`mod mcardx ${all ? "done" : ""}${nx?.moduleIndex === mi && lessonsLeft > 0 ? " is-here" : ""}`} open={mi === openModule || (openModule < 0 && mi === 0 && !all)}>
                <summary className="mod-h">
                  <Cover img={coverOf(t.id, mi)} icon={cv.icon} tilt={(mi % 3) * 10 - 10} sizes="(max-width: 700px) 30vw, 200px" className="mod-cov" />
                  <span className="mod-n">{all ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12.5l4.5 4.5L19 7.5" /></svg> : mi + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span className="mod-k">Módulo {mi + 1}{nx?.moduleIndex === mi && lessonsLeft > 0 ? " · você está aqui" : ""}</span>
                    <h3>{m.title}</h3>
                    <div className="meta"><span>{m.lessons.length} {m.lessons.length === 1 ? "aula" : "aulas"}</span><span>{minutes(secs)}</span><span>{d}/{m.lessons.length} concluídas</span>{quizPassed.has(m.id) && <span style={{ color: "var(--sinal-tx)" }}>Quiz aprovado</span>}</div>
                  </div>
                  <svg className="chev dim" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m6 9 6 6 6-6" /></svg>
                </summary>
                <div className="mod-b">
                  {m.lessons.map((l) => (
                    <Link key={l.id} className={`li${nx?.id === l.id && !done.has(l.id) ? " nxt" : ""}`} href={`/aula/${t.id}/${l.id}`}>
                      <span className={`chk ${done.has(l.id) ? "on" : ""}`}>{done.has(l.id) ? <Tick /> : null}</span>
                      <span className="t">{l.title}{done.has(l.id) && <span className="sr-only"> (concluída)</span>}{nx?.id === l.id && !done.has(l.id) && <span className="li-next">Próxima</span>}</span><span className="dur">{l.youtube_id && l.duration_seconds > 0 ? duration(l.duration_seconds) : !l.youtube_id ? "Leitura" : ""}</span>
                    </Link>
                  ))}
                  {nq > 0 && (
                    <Link className="li quiz" href={`/quiz/${t.id}/${mi}`}>
                      <span className={`chk chk-q ${quizPassed.has(m.id) ? "on" : ""}`}>{quizPassed.has(m.id) ? <Tick /> : <Ico name="help" size={13} strokeWidth={2.4} />}</span>
                      <span className="t">Quiz do módulo<span className="dim" style={{ fontWeight: 400, marginLeft: 10 }}>{nq} pergunta{nq > 1 ? "s" : ""}</span></span><span className="dur">~{Math.max(1, Math.round(nq * 0.7))} min</span>
                    </Link>
                  )}
                </div>
              </details>
            );
          })}
          <div className={`cert${earned ? " is-on" : ""}`}>
            <span className="cert-ico" aria-hidden><Ico name={earned ? "award" : "lock"} size={26} /></span>
            <div style={{ flex: 1 }}>
              <b>Certificado: {t.name}</b>
              <div className="dim" style={{ fontSize: 13 }}>{earned ? `Conquistado${st?.hasNew ? ". Esta trilha ganhou conteúdo novo" : ""}.` : `Liberado ao concluir todas as aulas${quizzes.length ? " e quizzes" : ""}.`}</div>
            </div>
            {earned ? <Link className="btn btn-p btn-sm" href={`/certificado/${t.id}`}>Ver certificado</Link> : <span className="cert-pct">{p.pct}%</span>}
          </div>
        </div>}
      </section>
    </>
  );
}
