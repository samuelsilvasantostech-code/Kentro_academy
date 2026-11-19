import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { allLessons, getCatalog, getMe, isRequired, lessonsOf, nextOf, progress } from "@/lib/catalog";
import { createClient } from "@/lib/supabase/server";
import { duration, firstName, thumb } from "@/lib/format";
import { topicIcon } from "@/lib/topic";
import { Chev } from "@/components/cards";
import { CrystalHero } from "@/components/crystal/CrystalHero";
import { Explorer } from "@/components/explorer";
import { Ico } from "@/components/ico";
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
        <CrystalHero />
      </section>

      <section className="ksec" aria-labelledby="cont-h">
        <div className="sec-h">
          <h2 id="cont-h">{p.done ? "Continue de onde parou" : "Comece por aqui"}</h2>
          <p className="sec-hint">
            {done.size === 0 ? "São poucos minutos por aula."
              : moved ? `Você concluiu ${cur.name}. Siga para a próxima trilha.`
              : certified ? `Você concluiu ${t.name}.`
              : p.pct === 100 ? "Falta só o quiz para o seu certificado."
              : `${p.total - p.done} ${p.total - p.done === 1 ? "aula falta" : "aulas faltam"} para o certificado.`}
          </p>
        </div>
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
              <span className="kmeta"><Ico name="video" size={16} />{p.done} de {p.total} {p.total === 1 ? "aula com vídeo concluída" : "aulas com vídeo concluídas"}</span>
              {certified
                ? <Link className="btn btn-p" href={`/certificado/${t.id}`}><Ico name="award" size={14} />Ver certificado</Link>
                : <Link className="btn btn-p" href={`/aula/${t.id}/${l.id}`}><Ico name="play" size={14} />{p.done ? "Continuar aula" : "Começar aula"}</Link>}
            </div>
            <ul className="kcont-stats" aria-label="Seu progresso geral">
              <li><b>{overall}%</b>{started.length === 1 ? "da trilha atual" : `das ${started.length} trilhas que você começou`}</li>
              <li><b>{lessonsDone}</b>{lessonsDone === 1 ? "aula concluída" : "aulas concluídas"}</li>
              <li><b>{certs}</b>{certs === 1 ? "certificado" : "certificados"}</li>
            </ul>
          </div>
        </article>
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
          <ul className="knews">
            {news.map((n) => {
              const inner = <><span className="knews-top"><span className="ml-ico" aria-hidden><Ico name="bulb" size={16} /></span><span className="mtag">{n.href ? "Novo" : "Em breve"}</span></span><b>{n.title}</b><span className="knews-d">{n.description}</span></>;
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
