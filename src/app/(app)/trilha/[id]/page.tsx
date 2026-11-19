import Link from "next/link";
import { notFound } from "next/navigation";
import { getCatalog, getMe, nextOf, progress } from "@/lib/catalog";
import { createClient } from "@/lib/supabase/server";
import { duration, minutes } from "@/lib/format";
import { getTrackStatuses } from "../../certificado/completion";
import { FlowStage, buildFlow } from "@/components/flow";
import { IcAulas, IcCert, IcPessoa, IcTempo } from "@/components/cards";
import { nextTrack } from "@/lib/next-track";
import { Ico } from "@/components/ico";

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
  const flow = buildFlow(t, done, quizPassed, new Set(quizzes.map((m) => m.id)));
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
  const leftText = left ? `${lessonsLeft + quizzesLeft === 1 ? "Falta" : "Faltam"} ${left}${p.secondsLeft > 0 ? ` (cerca de ${minutes(p.secondsLeft)})` : ""}.` : earned ? "Trilha concluída." : "Tudo feito. O certificado já pode ser emitido.";
  // Só o módulo onde o aluno está fica aberto (o da próxima aula; se a trilha acabou, nenhum).
  const openModule = nx && lessonsLeft > 0 ? nx.moduleIndex : -1;

  return (
    <>
      <div className="crumb"><Link href="/trilhas">Trilhas</Link> › <span>{t.name}</span></div>
      {concluida && st?.completed && <p className="ok-msg" style={{ marginBottom: 16 }}>Trilha concluída! Parabéns.</p>}
      {nextT && (
        <aside className="khelp next-track" style={{ marginBottom: 20 }}>
          <div><h2>Você concluiu esta trilha. Próxima: {nextT.name}</h2><p>{nextT.pitch}</p></div>
          <Link className="btn btn-p" href={`/trilha/${nextT.id}`}>Ver a próxima trilha<Ico name="arrowR" /></Link>
        </aside>
      )}
      <section className="thero">
        <div className="thero-head">
          <div className="tico" style={{ background: "var(--rebaixo)", width: 56, height: 56, fontSize: 28 }}>{t.icon}</div>
          <h1>{t.name}</h1>
          <p className="muted" style={{ fontSize: 17 }}>{t.pitch}</p>
          <div className="meta" style={{ fontSize: 14 }}><span><IcPessoa />{t.audience}</span><span><IcAulas />{p.count} {p.count === 1 ? "aula" : "aulas"}</span><span><IcTempo />{minutes(p.seconds)}</span><span><IcCert />Certificado</span></div>
          <div className="thero-cta">
            {nx && <Link className="btn btn-p" href={`/aula/${t.id}/${nx.id}`}>{p.done ? "Continuar" : "Começar trilha"}</Link>}
            {earned && <Link className="btn btn-s" href={`/certificado/${t.id}`}><IcCert />Ver certificado</Link>}
            {st?.hasNew && <span className="pill a" style={{ alignSelf: "center" }}>Novo conteúdo nesta trilha</span>}
            {nx && p.done > 0 && p.pct < 100 && <span className="muted" style={{ alignSelf: "center", fontSize: 14 }}>Próxima: {nx.title}</span>}
          </div>
        </div>
        {flow.nodes.length > 0 && (
          <div className="thero-flow">
            <FlowStage flow={flow} />
            <ul className="flow-legend" aria-hidden>
              <li><i className="lg-done" />Concluído</li>
              <li><i className="lg-next" />Próximo passo</li>
              <li><i className="lg-quiz" />Quiz</li>
              <li><i className="lg-cert" />Certificado</li>
            </ul>
          </div>
        )}
        <div className="side-box thero-side">
          {t.outcomes.length > 0 && <>
            <b>Ao final você vai conseguir</b>
            <ul className="outc">{t.outcomes.map((o) => <li key={o}>{o}</li>)}</ul>
          </>}
          <div className="thero-prog">
            <div className="kprog"><span className="pbar" role="progressbar" aria-label="Progresso na trilha" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p.pct}><i style={{ width: `${p.pct}%` }} /></span><b>{p.pct}%</b></div>
            <p>{leftText}</p>
          </div>
        </div>
      </section>

      <section className="sec">
        <h2>Conteúdo da trilha</h2>
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
              <details key={m.id} className={`mod ${all ? "done" : ""}`} open={mi === openModule || (openModule < 0 && mi === 0 && !all)}>
                <summary className="mod-h">
                  <span className="mod-n">{all ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12.5l4.5 4.5L19 7.5" /></svg> : mi + 1}</span>
                  <div style={{ flex: 1 }}>
                    <h3>{m.title}</h3>
                    <div className="meta"><span>{m.lessons.length} {m.lessons.length === 1 ? "aula" : "aulas"}</span><span>{minutes(secs)}</span><span>{d}/{m.lessons.length} concluídas</span>{quizPassed.has(m.id) && <span style={{ color: "var(--sinal-tx)" }}>Quiz feito</span>}</div>
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
              <div className="dim" style={{ fontSize: 13 }}>{earned ? `Conquistado${st?.hasNew ? ". Novo conteúdo nesta trilha" : ""}.` : `Liberado ao concluir todas as aulas${quizzes.length ? " e quizzes" : ""}.`}</div>
            </div>
            {earned ? <Link className="btn btn-p btn-sm" href={`/certificado/${t.id}`}>Ver certificado</Link> : <span className="cert-pct">{p.pct}%</span>}
          </div>
        </div>}
      </section>
    </>
  );
}
