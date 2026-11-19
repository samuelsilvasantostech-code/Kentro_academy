import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { allLessons, getCatalog, getMe, isRequired, lessonsOf, nextOf, progress } from "@/lib/catalog";
import { createClient } from "@/lib/supabase/server";
import { duration, firstName, thumb } from "@/lib/format";
import { topicIcon } from "@/lib/topic";
import { Chev } from "@/components/cards";
import { HeroArt } from "@/components/art";
import { Explorer } from "@/components/explorer";
import { Ico } from "@/components/ico";
import { getTrackStatuses } from "./certificado/completion";
import { exploreData } from "./explore-data";

const RING = 2 * Math.PI * 52;

export default async function Home() {
  const [{ user, profile, done }, tracks] = await Promise.all([getMe(), getCatalog()]);
  if (!profile.role_track) redirect("/comecar");

  const rec = tracks.find((t) => t.id === profile.role_track) ?? tracks[0];
  const t = tracks.find((x) => x.id === profile.last_track_id) ?? rec;
  const L = lessonsOf(t);
  const last = L.find((l) => l.id === profile.last_lesson_id);
  const l = last && !done.has(last.id) ? last : nextOf(t, done);
  const p = progress(t, done);
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
  const img = thumb(l.youtube_id);

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

  const { items, lessons } = exploreData([rec, ...tracks.filter((x) => x !== rec)], done, statuses, rec.id);
  const certified = statuses.get(t.id)?.certified && p.pct === 100;

  return (
    <div className="kh">
      <section className="khero" aria-labelledby="hero-h">
        <div className="khero-copy">
          <p className="khero-hi">{profile.full_name ? `Olá, ${firstName(profile.full_name)}` : "Seu espaço de aprendizado"}</p>
          <h1 id="hero-h">Aprenda no seu ritmo.<br /><span>Evolua com o Kentro.</span></h1>
          <p className="khero-sub">Treinamentos rápidos para dominar cada recurso e aproveitar mais do sistema.</p>
          <div className="khero-act">
            <Link className="btn btn-p btn-lg" href="/trilhas">Explorar trilhas<Ico name="arrow" size={17} /></Link>
            <Link className="btn btn-ghost btn-lg" href="/meu">Ver meus cursos</Link>
          </div>
        </div>
        <HeroArt />
      </section>

      <section className="ksec" aria-labelledby="cont-h">
        <div className="sec-h">
          <h2 id="cont-h">{p.done ? "Continue de onde parou" : "Comece por aqui"}</h2>
          <p className="sec-hint">
            {done.size === 0 ? "São poucos minutos por aula."
              : certified ? `Você concluiu ${t.name}.`
              : p.pct === 100 ? "Falta só o quiz para o seu certificado."
              : `${p.total - p.done} ${p.total - p.done === 1 ? "aula falta" : "aulas faltam"} para o certificado.`}
          </p>
        </div>
        <div className="kover">
          <article className="kcont">
            <Link className="kcont-thumb" href={`/aula/${t.id}/${l.id}`} tabIndex={-1} aria-hidden>
              {img ? <Image src={img} alt="" fill priority sizes="(max-width: 700px) 100vw, 360px" /> : <span className="kcont-ph"><Ico name={topicIcon(l.title, l.moduleTitle)} size={34} /></span>}
              <span className="kcont-play"><Ico name="play" size={22} /></span>
              {l.duration_seconds > 0 && <span className="kcont-dur">{duration(l.duration_seconds)}</span>}
            </Link>
            <div className="kcont-info">
              <span className="kpill">{certified ? "Concluída" : p.done ? "Em andamento" : "Sua trilha"}</span>
              <h3>{t.name}</h3>
              <p className="kcont-l"><span className="dim">Aula atual:</span> {l.title}</p>
              <div className="kprog">
                <span className="pbar" role="progressbar" aria-valuenow={p.pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Progresso em ${t.name}`}><i style={{ width: `${p.pct}%` }} /></span>
                <b>{p.pct}%</b>
              </div>
              <div className="kcont-foot">
                <span className="kmeta"><Ico name="video" size={16} />{p.done} de {p.total} aulas concluídas</span>
                <Link className="btn btn-p" href={`/aula/${t.id}/${l.id}`}><Ico name="play" size={14} />{p.done ? "Continuar aula" : "Começar aula"}</Link>
              </div>
            </div>
          </article>

          <aside className="kstats" aria-labelledby="stats-h">
            <h3 id="stats-h"><Ico name="chart" size={18} strokeWidth={2.6} />Seu progresso</h3>
            <div className="kstats-in">
              <div className="kring" role="img" aria-label={`${overall}% das trilhas que você começou`}>
                <svg viewBox="0 0 120 120" aria-hidden>
                  <circle cx="60" cy="60" r="52" className="kring-bg" />
                  <circle cx="60" cy="60" r="52" className="kring-fg" style={{ strokeDasharray: RING, ["--off" as string]: RING * (1 - overall / 100) }} />
                </svg>
                <b aria-hidden>{overall}%</b>
              </div>
              <ul className="kstat-list">
                <li><Ico name="check" size={18} strokeWidth={2.4} /><span><b>{lessonsDone}</b>{lessonsDone === 1 ? "aula concluída" : "aulas concluídas"}</span></li>
                <li><Ico name="award" size={18} /><span><b>{certs}</b>{certs === 1 ? "certificado" : "certificados"}</span></li>
              </ul>
            </div>
            <p className="kstats-note">{started.length === 1 ? "Na trilha atual" : `Nas ${started.length} trilhas que você começou`}</p>
          </aside>
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

      <div className="ksec">
        <Explorer tracks={items} lessons={lessons} title="Explore as trilhas" more={<Link className="mlink" href="/trilhas">Ver todas</Link>} />
      </div>

      {!!news?.length && (
        <section className="ksec" aria-labelledby="news-h">
          <div className="sec-h"><h2 id="news-h">Novidades</h2></div>
          <ul className="mlist kcard-list">
            {news.map((n) => {
              const inner = <><span className="ml-ico" aria-hidden><Ico name="bulb" size={16} /></span><span className="ml-main"><b>{n.title}</b><span className="mmeta"><span>{n.description}</span></span></span><span className="mtag">{n.href ? "Novo" : "Em breve"}</span>{n.href && <Chev />}</>;
              return <li key={n.id}>{n.href ? <Link href={n.href}>{inner}</Link> : <div>{inner}</div>}</li>;
            })}
          </ul>
        </section>
      )}

      <aside className="khelp">
        <div><h2>Precisa de ajuda para dar o próximo passo?</h2><p>Veja as respostas para as dúvidas mais comuns sobre trilhas, progresso e certificados.</p></div>
        <Link className="btn btn-s" href="/ajuda">Abrir a ajuda</Link>
      </aside>
    </div>
  );
}
