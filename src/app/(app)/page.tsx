import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { allLessons, getCatalog, getMe, isRequired, lessonsOf, nextOf, progress } from "@/lib/catalog";
import { createClient } from "@/lib/supabase/server";
import { duration, firstName, minutes, thumb } from "@/lib/format";
import { topicIcon } from "@/lib/topic";
import { COVERS } from "@/lib/category";
import { Chev } from "@/components/cards";
import { CrystalHero } from "@/components/crystal/CrystalHero";
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
  const img = thumb(l.youtube_id);
  const certified = statuses.get(t.id)?.certified && p.pct === 100;

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
    : p.pct === 100 ? "Falta só o quiz para o seu certificado."
    : `${p.total - p.done} ${p.total - p.done === 1 ? "aula falta" : "aulas faltam"} para o certificado.`;

  return (
    <div className="kh">
      <PointerGlow />
      <section className="kdash" aria-labelledby="hero-h">
        <div className="kdash-main">
          <p className="khero-hi">{profile.full_name ? `Olá, ${firstName(profile.full_name)}` : "Seu espaço de aprendizado"}</p>
          <h1 id="hero-h">{p.done ? "Continue de onde parou" : "Comece por aqui"}</h1>
          <p className="kdash-sub">{hint}</p>

          <article className="kcont kglow">
            <Link className="kcont-thumb" href={`/aula/${t.id}/${l.id}`} tabIndex={-1} aria-hidden>
              {img ? <Image src={img} alt="" fill priority sizes="(max-width: 700px) 100vw, 300px" /> : <span className="kcont-ph"><Ico name={topicIcon(l.title, l.moduleTitle)} size={34} /></span>}
              <span className="kcont-play"><Ico name="play" size={22} /></span>
              {l.duration_seconds > 0 && <span className="kcont-dur">{duration(l.duration_seconds)}</span>}
            </Link>
            <div className="kcont-info">
              <span className="kpill">{certified ? "Concluída" : p.done ? "Em andamento" : "Sua trilha"}</span>
              <h2 className="kcont-t">{t.name}</h2>
              <p className="kcont-l"><span className="dim">Aula atual:</span> {l.title}</p>
              <div className="kprog">
                <span className="pbar" role="progressbar" aria-valuenow={p.pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Progresso em ${t.name}`}><i style={{ width: `${p.pct}%` }} /></span>
                <b>{p.pct}%</b>
              </div>
              <div className="kcont-foot">
                <span className="kmeta"><Ico name="video" size={16} />{p.done} de {p.total} aulas</span>
                {certified
                  ? <Link className="btn btn-p" href={`/certificado/${t.id}`}><Ico name="award" size={14} />Ver certificado</Link>
                  : <Link className="btn btn-p" href={`/aula/${t.id}/${l.id}`}><Ico name="play" size={14} />{p.done ? "Continuar aula" : "Começar aula"}</Link>}
              </div>
            </div>
          </article>
        </div>

        <div className="kdash-side">
          <CrystalHero />
          <ul className="khud" aria-label="Seu progresso geral">
            <li><span className="khud-k">Progresso</span><b>{overall}%</b><span className="khud-d">{started.length === 1 ? "da trilha atual" : `de ${started.length} trilhas`}</span></li>
            <li><span className="khud-k">Aulas</span><b>{lessonsDone}</b><span className="khud-d">{lessonsDone === 1 ? "concluída" : "concluídas"}</span></li>
            <li><span className="khud-k">Certificados</span><b>{certs}</b><span className="khud-d">{certs === 1 ? "emitido" : "emitidos"}</span></li>
          </ul>
        </div>
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

      <section className="ksec" aria-labelledby="trk-h">
        <div className="sec-h">
          <h2 id="trk-h">Suas trilhas</h2>
          <Link className="mlink" href="/trilhas">Ver todas<span className="sr-only"> as trilhas</span></Link>
        </div>
        <ul className="ktrks">
          {items.map((x, i) => (
            <li key={x.id} style={{ "--i": i } as React.CSSProperties}>
              <Link className={`ktrk kglow${x.pct === 100 ? " is-done" : ""}`} href={`/trilha/${x.id}`}>
                <span className="ktrk-ring" style={{ "--p": x.pct } as React.CSSProperties} aria-hidden><span>{x.pct}%</span></span>
                <span className="ktrk-tx">
                  <span className="ktrk-cat"><Ico name={COVERS[x.art].icon} size={13} />{COVERS[x.art].label}</span>
                  <b>{x.name}</b>
                  <span className="ktrk-meta">{x.count} {x.count === 1 ? "aula" : "aulas"} · {minutes(x.seconds)}<span className="sr-only">, {x.pct}% concluído</span></span>
                </span>
                {x.tag && <span className={`ktrk-tag${x.tag === "Concluída" ? " is-ok" : ""}`}>{x.tag}</span>}
                <span className="ktrk-go" aria-hidden><Ico name="arrowR" size={16} /></span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

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
