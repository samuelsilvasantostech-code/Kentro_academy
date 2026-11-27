import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { allLessons, getCatalog, getMe, isRequired, lessonsOf, nextOf, progress } from "@/lib/catalog";
import { createClient } from "@/lib/supabase/server";
import { duration, firstName, minutes } from "@/lib/format";
import { COVERS } from "@/lib/category";
import { Cover } from "@/components/cover";
import { coverOf } from "@/lib/covers";
import { Chev } from "@/components/cards";
import { BubbleHero } from "@/components/bubble/BubbleHero";
import { Ico } from "@/components/ico";
import { PointerGlow } from "@/components/pointer-glow";
import { nextTrack } from "@/lib/next-track";
import { getTrackStatuses } from "./certificado/completion";
import { exploreData } from "./explore-data";

export default async function Home() {
  const [{ user, profile, done }, tracks] = await Promise.all([getMe(), getCatalog()]);
  if (!profile.role_track) redirect("/comecar");

  const rec = tracks.find((t) => t.id === profile.role_track) ?? tracks[0];
  const cur = tracks.find((x) => x.id === profile.last_track_id) ?? rec;
  const supabase = await createClient();
  // Certificados, novidades e respostas de dúvidas saem juntos, não em fila.
  const [statuses, { data: news }, { data: answered }] = await Promise.all([
    getTrackStatuses(),
    supabase.from("news").select("*").eq("published", true).order("position").limit(3),
    supabase
      .from("lesson_questions")
      .select("id, lesson_id, body, answered_at")
      .eq("user_id", user.id)
      .not("answer", "is", null)
      .is("answer_seen_at", null)
      .order("answered_at", { ascending: false })
      .limit(5),
  ]);
  // Trilha atual já certificada: o card passa a sugerir a próxima sem certificado (se houver).
  const isCert = (id: string) => !!statuses.get(id)?.certified;
  const moved = isCert(cur.id) ? nextTrack(tracks, cur.id, isCert) : null;
  const t = moved ?? cur;
  const L = lessonsOf(t);
  const last = L.find((l) => l.id === profile.last_lesson_id);
  const l = last && !done.has(last.id) ? last : nextOf(t, done);
  const p = progress(t, done);
  const pos = L.findIndex((x) => x.id === l.id) + 1;
  const certified = statuses.get(t.id)?.certified && p.pct === 100;
  // Linhas acesas no balão da logo: uma a cada terço da trilha.
  const lit = certified ? 3 : Math.max(1, Math.ceil((p.pct / 100) * 3));

  // Resumo: trilhas já começadas (e a atual). Mesma regra do progresso: só aulas com vídeo contam.
  const started = tracks.filter((x) => x.id === t.id || progress(x, done).done > 0);
  const required = new Set(started.flatMap((x) => lessonsOf(x).filter(isRequired).map((y) => y.id)));
  const reqDone = [...required].filter((id) => done.has(id)).length;
  const overall = required.size ? Math.round((reqDone / required.size) * 100) : 0;
  const lessonsDone = new Set(allLessons(tracks).filter((x) => done.has(x.id)).map((x) => x.id)).size;
  const certs = [...statuses.values()].filter((s) => s.certified).length;

  const lessonIndex = new Map(allLessons(tracks).map((x) => [x.id, x]));
  const replies = (answered ?? []).flatMap((q) => {
    const x = lessonIndex.get(q.lesson_id as string);
    return x ? [{ id: q.id as string, body: q.body as string, trackId: x.trackIds[0], lessonId: x.id, title: x.title }] : [];
  });

  // Trilhas em destaque: a atual, as começadas, a recomendada e depois as demais (até 6).
  const ordered = [...new Set([t, ...started, rec, ...tracks])].slice(0, 6);
  const { items } = exploreData(ordered, done, statuses, rec.id);

  const hint = done.size === 0 ? "São poucos minutos por aula. Seu progresso fica salvo."
    : moved ? `Você concluiu ${cur.name}. Siga para a próxima trilha.`
    : certified ? `Você concluiu ${t.name}.`
    : p.pct === 100 ? "Aulas concluídas. Agora passe nos quizzes dos módulos para ganhar o certificado."
    : `${p.total - p.done === 1 ? "Falta 1 aula" : `Faltam ${p.total - p.done} aulas`} para o certificado.`;

  return (
    <div className="kh">
      <PointerGlow />
      <section className="kx" aria-labelledby="hero-h">
        <div className="kx-bg" aria-hidden>
          <Image className="kx-img" src="/hero/bolhas.jpg" alt="" fill priority sizes="100vw" />
          <span className="kx-grid" />
        </div>
        <div className="kx-main">
          <p className="khero-hi">{profile.full_name ? `Olá, ${firstName(profile.full_name)}` : "Seu espaço de aprendizado"}</p>
          <p className="kx-k">{certified ? "Trilha concluída" : p.done ? "Continue de onde parou" : "Comece por aqui"}</p>
          <h1 id="hero-h" className="kx-t">{certified ? t.name : l.title}</h1>
          <p className="kx-meta">
            <Link href={`/trilha/${t.id}`}>{t.name}</Link>
            {!certified && pos > 0 && <span>Aula {pos} de {L.length}</span>}
            {!certified && l.duration_seconds > 0 && <span><Ico name="clock" size={14} />{duration(l.duration_seconds)}</span>}
          </p>
          <div className="kx-prog">
            <span className="kx-prog-l"><span>Progresso na trilha</span><b className="tnum">{p.pct}%</b></span>
            <span className="pbar" role="progressbar" aria-valuenow={p.pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Progresso em ${t.name}`}><i style={{ width: `${p.pct}%` }} /></span>
          </div>
          <p className="kx-hint">{hint}</p>
          <div className="kx-cta">
            {certified
              ? <Link className="btn btn-p btn-lg" href={`/certificado/${t.id}`}><Ico name="award" size={16} />Ver certificado</Link>
              : <Link className="btn btn-p btn-lg" href={`/aula/${t.id}/${l.id}`}><Ico name="play" size={16} />{p.done ? "Continuar aula" : "Começar aula"}</Link>}
            <Link className="btn btn-ghost btn-lg" href={`/trilha/${t.id}`}>Ver trilha</Link>
          </div>
        </div>
        <div className="kx-stage"><BubbleHero lit={lit} /></div>
        <ul className="khud kx-hud" aria-label="Seu progresso geral">
          <li><span className="khud-k">Progresso</span><b>{overall}%</b><span className="khud-d">{started.length === 1 ? "da trilha atual" : `de ${started.length} trilhas`}</span></li>
          <li><span className="khud-k">Aulas</span><b>{lessonsDone}</b><span className="khud-d">{lessonsDone === 1 ? "concluída" : "concluídas"}</span></li>
          {certs > 0
            ? <li><span className="khud-k">Certificados</span><b>{certs}</b><span className="khud-d">{certs === 1 ? "emitido" : "emitidos"}</span></li>
            : <li className="is-goal"><span className="khud-k">Meta</span><b>1º</b><span className="khud-d">certificado</span></li>}
        </ul>
      </section>

      <section className="ksec" aria-labelledby="trk-h">
        <div className="sec-h">
          <h2 id="trk-h">Suas trilhas</h2>
          <Link className="mlink" href="/trilhas">Ver todas<span className="sr-only"> as trilhas</span></Link>
        </div>
        <ul className="kposts">
          {items.map((x, i) => (
            <li key={x.id} style={{ "--i": i } as React.CSSProperties}>
              <Link className={`kpost${x.pct === 100 ? " is-done" : ""}`} href={`/trilha/${x.id}`}>
                <Cover brand img={coverOf(x.id)} icon={COVERS[x.art].icon} tilt={COVERS[x.art].tilt} sizes="(max-width: 700px) 60vw, (max-width: 1100px) 33vw, 220px" />
                {x.tag && <span className={`kpost-tag${x.tag === "Concluída" ? " is-ok" : ""}`}>{x.tag}</span>}
                <span className="kpost-foot">
                  <span className="kpost-cat">{COVERS[x.art].label}</span>
                  <b>{x.name}</b>
                  <span className="kpost-meta">{x.count} {x.count === 1 ? "aula" : "aulas"} · {minutes(x.seconds)}</span>
                  <span className="kpost-prog">
                    <span className="pbar" aria-hidden><i style={{ width: `${x.pct}%` }} /></span>
                    <span className="tnum">{x.pct}%<span className="sr-only"> concluído</span></span>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {replies.length > 0 && (
        <section className="ksec" aria-labelledby="rep-h">
          <div className="sec-h"><h2 id="rep-h">Respostas da equipe</h2></div>
          <ul className="mlist kcard-list">
            {replies.map((r) => (
              <li key={r.id}><Link href={`/aula/${r.trackId}/${r.lessonId}?aba=duvidas`}>
                <span className="ml-ico" aria-hidden><Ico name="chat" size={16} /></span>
                <span className="ml-main"><b>{r.title}</b><span className="mmeta"><span className="ml-trunc">Sua dúvida: {r.body}</span></span></span>
                <span className="mtag">Respondida</span><Chev />
              </Link></li>
            ))}
          </ul>
        </section>
      )}

      {!!news?.length && (
        <section className="ksec" aria-labelledby="news-h">
          <div className="sec-h"><h2 id="news-h">Novidades</h2></div>
          <ul className="knews">
            {news.map((n) => {
              const inner = <><span className="knews-top"><span className="ml-ico" aria-hidden><Ico name="bulb" size={16} /></span><span className="mtag">{n.href ? "Novo" : "Em breve"}</span></span><b>{n.title}</b><span className="knews-d">{n.description}</span></>;
              return <li key={n.id}>{n.href ? <Link className="kglow" href={n.href}>{inner}</Link> : <div>{inner}</div>}</li>;
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
