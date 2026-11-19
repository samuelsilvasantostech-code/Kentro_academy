import type { Metadata } from "next";
import Link from "next/link";
import { NameForm } from "./name-form";
import { allLessons, getCatalog, getMe, progress } from "@/lib/catalog";
import { createClient } from "@/lib/supabase/server";
import { minutes } from "@/lib/format";
import { TrackRow } from "@/components/cards";
import { Ico, type IcoName } from "@/components/ico";
import { getTrackStatuses } from "../certificado/completion";

export const metadata: Metadata = { title: "Meu aprendizado" };

function Stat({ icon, label, children }: { icon: IcoName; label: string; children: React.ReactNode }) {
  return (
    <div className="stat">
      <div className="stat-h"><Ico name={icon} size={16} />{label}</div>
      <div className="n">{children}</div>
    </div>
  );
}

export default async function Meu() {
  const [{ user, profile, done, quizDone }, tracks] = await Promise.all([getMe(), getCatalog()]);
  const all = allLessons(tracks);
  const studied = all.filter((l) => done.has(l.id)).reduce((a, l) => a + l.duration_seconds, 0);
  const started = tracks.filter((t) => progress(t, done).done > 0);

  const supabase = await createClient();
  // Certificado existente OU conclusão atual (getTrackStatuses emite o certificado se for a primeira vez).
  const [statuses, { data: notes }] = await Promise.all([
    getTrackStatuses(),
    supabase.from("notes").select("id, body, lesson_id, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
  ]);
  const completed = new Set(tracks.filter((t) => statuses.get(t.id)?.certified).map((t) => t.id));
  const certs = completed.size;
  const byId = new Map(all.map((l) => [l.id, l]));

  return (
    <div className="page-narrow">
      <h1>Meu aprendizado</h1>
      <p className="muted" style={{ marginTop: 6 }}>Seu progresso, suas conquistas e seus certificados.</p>
      <div className="grid g4 stats" style={{ marginTop: 24 }}>
        <Stat icon="book" label="Aulas concluídas">{done.size}<span className="dim n-sub"> de {all.length}</span></Stat>
        <Stat icon="clock" label="Tempo de estudo">{minutes(studied)}</Stat>
        <Stat icon="help" label="Quizzes feitos">{quizDone.size}</Stat>
        <Stat icon="award" label="Trilhas concluídas">{certs}</Stat>
      </div>

      <section className="sec" aria-labelledby="m-trilhas">
        <div className="sec-h"><h2 id="m-trilhas">Minhas trilhas</h2></div>
        {started.length === 0 && (
          <div className="empty" style={{ marginBottom: 16 }}>
            <span className="empty-ico" aria-hidden="true"><Ico name="flow" size={28} /></span>
            <h3>Você ainda não começou nenhuma aula</h3>
            <p className="muted">Escolha uma trilha e assista à primeira aula. Seu progresso aparece aqui.</p>
            <div className="empty-btns">
              <Link className="btn btn-p" href="/trilhas">Ver trilhas</Link>
              <Link className="btn btn-s" href="/comecar">Descobrir minha trilha</Link>
            </div>
          </div>
        )}
        <ul className="mlist">
          {(started.length ? started : tracks.filter((t) => t.id === profile.role_track)).map((t) => <TrackRow key={t.id} track={t} done={done} status={statuses.get(t.id)} />)}
        </ul>
        {tracks.filter((t) => completed.has(t.id)).map((t) => (
          <Link key={t.id} className="btn btn-s btn-sm" style={{ marginTop: 12, marginRight: 8 }} href={`/certificado/${t.id}`}><Ico name="award" size={16} />Certificado de {t.name}</Link>
        ))}
      </section>

      <section className="sec" aria-labelledby="m-conq">
        <div className="sec-h"><div><h2 id="m-conq">Conquistas</h2><p className="dim" style={{ fontSize: 14 }}>Ganhe um selo ao concluir cada trilha.</p></div></div>
        {!certs && !done.size && !quizDone.size && <p className="dim" style={{ marginBottom: 12 }}>Nenhum selo ainda. Conclua sua primeira aula para ganhar o primeiro.</p>}
        <div className="grid g3">
          {tracks.map((t) => {
            const p = progress(t, done);
            const got = completed.has(t.id);
            return (
              <div key={t.id} className={`badge ${got ? "" : "lock"}`}>
                <div className="m" style={{ borderColor: t.color, background: `${t.color}22` }} aria-hidden="true">{t.icon}</div>
                <b>{t.name}</b>
                {got ? (
                  <>
                    <span className="pill v"><Ico name="check" size={14} strokeWidth={3} />Conquistado</span>
                    {statuses.get(t.id)?.hasNew && <span className="dim bd-s">A trilha ganhou conteúdo novo.</span>}
                  </>
                ) : (
                  <>
                    <span className="pill"><Ico name="lock" size={14} />Bloqueado</span>
                    <span className="dim bd-s">{p.pct}% concluído. Faltam {p.total - p.done} aulas.</span>
                  </>
                )}
              </div>
            );
          })}
          <div className={`badge ${done.size ? "" : "lock"}`}>
            <div className="m m-ico" aria-hidden="true"><Ico name="book" size={30} /></div><b>Primeira aula</b>
            {done.size ? <span className="pill v"><Ico name="check" size={14} strokeWidth={3} />Conquistado</span> : <span className="pill"><Ico name="lock" size={14} />Bloqueado</span>}
          </div>
          <div className={`badge ${quizDone.size ? "" : "lock"}`}>
            <div className="m m-ico" aria-hidden="true"><Ico name="target" size={30} /></div><b>Primeiro quiz</b>
            {quizDone.size ? <span className="pill v"><Ico name="check" size={14} strokeWidth={3} />Conquistado</span> : <span className="pill"><Ico name="lock" size={14} />Bloqueado</span>}
          </div>
        </div>
      </section>

      <section className="sec" id="nome" aria-labelledby="m-nome">
        <div className="sec-h"><h2 id="m-nome">Seu nome no certificado</h2></div>
        <NameForm current={profile.full_name ?? ""} />
      </section>

      <section className="sec" aria-labelledby="m-notas">
        <div className="sec-h"><h2 id="m-notas">Anotações</h2></div>
        {notes?.length ? <div className="notes-list">{notes.map((n) => {
          const l = byId.get(n.lesson_id);
          return l && (
            <Link key={n.id} className="note note-link" href={`/aula/${l.trackIds[0]}/${l.id}`}>
              <span className="note-t">{l.title}</span>{n.body}
            </Link>
          );
        })}</div> : <div className="empty"><span className="empty-ico" aria-hidden="true"><Ico name="pen" size={28} /></span><p className="muted">Você ainda não fez anotações. Use a aba Anotações durante uma aula.</p></div>}
      </section>
    </div>
  );
}
