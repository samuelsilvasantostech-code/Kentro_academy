import type { Metadata } from "next";
import Link from "next/link";
import { NameForm } from "./name-form";
import { allLessons, getCatalog, getMe, nextOf, progress, type Track } from "@/lib/catalog";
import { createClient } from "@/lib/supabase/server";
import { minutes } from "@/lib/format";
import { Ico, type IcoName } from "@/components/ico";
import { CrystalGlyph } from "@/components/crystal/CrystalGlyph";
import { getTrackStatuses, type TrackStatus } from "../certificado/completion";

export const metadata: Metadata = { title: "Meus cursos" };

const TABS = [
  ["cursos", "Cursos", "layers"],
  ["conquistas", "Conquistas", "award"],
  ["anotacoes", "Anotações", "pen"],
  ["perfil", "Perfil", "user"],
] as const satisfies readonly (readonly [string, string, IcoName])[];
type Tab = (typeof TABS)[number][0];

const dateBR = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" });

function Stat({ icon, label, children }: { icon: IcoName; label: string; children: React.ReactNode }) {
  return (
    <div className="stat">
      <div className="stat-h"><Ico name={icon} size={16} />{label}</div>
      <div className="n">{children}</div>
    </div>
  );
}

/** Trilha em andamento: progresso, o que falta e a próxima aula. */
function CourseRow({ t, done }: { t: Track; done: Set<string> }) {
  const p = progress(t, done);
  const nx = nextOf(t, done);
  return (
    <li className="mcourse">
      <div className="mcourse-main">
        <Link className="mcourse-t" href={`/trilha/${t.id}`}>{t.name}</Link>
        <div className="mcourse-prog">
          <span className="pbar" aria-hidden><i style={{ width: `${p.pct}%` }} /></span>
          <span className="tnum">{p.pct}%</span>
        </div>
        <p className="mcourse-meta">{p.done} de {p.total} aulas{p.secondsLeft > 0 ? ` · faltam cerca de ${minutes(p.secondsLeft)}` : ""}</p>
        {nx && <p className="mcourse-next"><span className="dim">Próxima aula:</span> {nx.title}</p>}
      </div>
      {nx && <Link className="btn btn-p mcourse-go" href={`/aula/${t.id}/${nx.id}`}><Ico name="play" size={14} />Continuar<span className="sr-only"> {t.name}</span></Link>}
    </li>
  );
}

function DoneRow({ t, st }: { t: Track; st?: TrackStatus }) {
  return (
    <li className="mcourse is-done">
      <span className="mcourse-ico" aria-hidden><Ico name="award" size={20} /></span>
      <div className="mcourse-main">
        <Link className="mcourse-t" href={`/trilha/${t.id}`}>{t.name}</Link>
        <p className="mcourse-meta">Concluída{st?.issuedAt ? ` em ${dateBR(st.issuedAt)}` : ""}{st?.hasNew ? " · ganhou conteúdo novo" : ""}</p>
      </div>
      <Link className="btn btn-s mcourse-go" href={`/certificado/${t.id}`}>Ver certificado<span className="sr-only"> de {t.name}</span></Link>
    </li>
  );
}

export default async function Meu({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const { aba } = await searchParams;
  const tab: Tab = TABS.some(([k]) => k === aba) ? (aba as Tab) : "cursos";
  const [{ user, profile, done, quizDone }, tracks] = await Promise.all([getMe(), getCatalog()]);
  const all = allLessons(tracks);
  const studied = all.filter((l) => done.has(l.id)).reduce((a, l) => a + l.duration_seconds, 0);

  const supabase = await createClient();
  // Certificado existente OU conclusão atual (getTrackStatuses emite o certificado se for a primeira vez).
  const [statuses, notesQ] = await Promise.all([
    getTrackStatuses(),
    tab === "anotacoes"
      ? supabase.from("notes").select("id, body, lesson_id, created_at", { count: "exact" }).eq("user_id", user.id).order("created_at", { ascending: false }).limit(50)
      : supabase.from("notes").select("id", { count: "exact", head: true }).eq("user_id", user.id),
  ]);
  const notesCount = notesQ.count ?? 0;
  type Note = { id: string; body: string; lesson_id: string; created_at: string };
  const notes = tab === "anotacoes" ? ((notesQ.data ?? []) as Note[]) : [];
  const byId = new Map(all.map((l) => [l.id, l]));
  const completed = tracks.filter((t) => statuses.get(t.id)?.certified);
  const inProgress = tracks.filter((t) => !statuses.get(t.id)?.certified && progress(t, done).done > 0);
  const badgesTotal = tracks.length + 2;
  const badgesGot = completed.length + (done.size ? 1 : 0) + (quizDone.size ? 1 : 0);
  const counts: Record<Tab, string> = {
    cursos: String(inProgress.length + completed.length),
    conquistas: `${badgesGot}/${badgesTotal}`,
    anotacoes: String(notesCount),
    perfil: "",
  };

  return (
    <div className="page-narrow meu">
      <h1>Meus cursos</h1>
      <p className="muted" style={{ marginTop: 6 }}>Seu progresso, suas conquistas e seus certificados.</p>
      <div className="grid g4 stats" style={{ marginTop: 24 }}>
        <Stat icon="book" label="Aulas concluídas">{done.size}<span className="dim n-sub"> de {all.length}</span></Stat>
        <Stat icon="clock" label="Tempo de estudo">{minutes(studied)}</Stat>
        <Stat icon="help" label="Quizzes feitos">{quizDone.size}</Stat>
        <Stat icon="award" label="Trilhas concluídas">{completed.length}</Stat>
      </div>

      <nav className="mtabs" aria-label="Seções de Meus cursos">
        {TABS.map(([k, label, icon]) => (
          <Link key={k} href={k === "cursos" ? "/meu" : `/meu?aba=${k}`} aria-current={tab === k ? "page" : undefined} scroll={false}>
            <Ico name={icon} size={16} />{label}{counts[k] && <span className="mtabs-n">{counts[k]}</span>}
          </Link>
        ))}
      </nav>

      {tab === "cursos" && (
        <div className="mpanel">
          <section aria-labelledby="m-and">
            <h2 className="mpanel-h" id="m-and">Em andamento</h2>
            {inProgress.length ? (
              <ul className="mcourses">{inProgress.map((t) => <CourseRow key={t.id} t={t} done={done} />)}</ul>
            ) : (
              <div className="empty">
                <span className="empty-ico" aria-hidden="true"><Ico name="flow" size={28} /></span>
                <h3>{completed.length ? "Nenhuma trilha em andamento" : "Você ainda não começou nenhuma aula"}</h3>
                <p className="muted">Escolha uma trilha e assista à primeira aula. Seu progresso aparece aqui.</p>
                <div className="empty-btns">
                  <Link className="btn btn-p" href="/trilhas">Ver trilhas</Link>
                  <Link className="btn btn-s" href="/comecar">Descobrir minha trilha</Link>
                </div>
              </div>
            )}
          </section>
          {completed.length > 0 && (
            <section aria-labelledby="m-done">
              <h2 className="mpanel-h" id="m-done">Concluídas</h2>
              <ul className="mcourses">{completed.map((t) => <DoneRow key={t.id} t={t} st={statuses.get(t.id)} />)}</ul>
            </section>
          )}
        </div>
      )}

      {tab === "conquistas" && (
        <div className="mpanel">
          <h2 className="mpanel-h">Selos</h2>
          <p className="muted mpanel-sub">Ganhe um selo ao concluir cada trilha, além dos selos de primeira aula e primeiro quiz.</p>
          <ul className="mbadges">
            {[
              { k: "aula", name: "Primeira aula", got: done.size > 0, hint: "Conclua sua primeira aula.", tilt: -8 },
              { k: "quiz", name: "Primeiro quiz", got: quizDone.size > 0, hint: "Faça o quiz de um módulo.", tilt: 10 },
              ...tracks.map((t, i) => {
                const p = progress(t, done);
                const st = statuses.get(t.id);
                return { k: t.id, name: t.name, got: !!st?.certified, hint: `${p.pct}% concluído. Faltam ${p.total - p.done} aulas.`, pct: p.pct, href: st?.certified ? `/certificado/${t.id}` : `/trilha/${t.id}`, date: st?.issuedAt, tilt: (i % 3) * 8 - 8 };
              }),
            ].map((b) => (
              <li key={b.k} className={`mbadge${b.got ? " is-on" : ""}`}>
                <CrystalGlyph className="mbadge-gem" tilt={b.tilt} orbit={b.got} />
                <b>{b.name}</b>
                {b.got ? (
                  <span className="mbadge-st"><Ico name="check" size={14} strokeWidth={3} />{"date" in b && b.date ? `Conquistado em ${dateBR(b.date)}` : "Conquistado"}</span>
                ) : (
                  <>
                    <span className="mbadge-st is-lock"><Ico name="lock" size={14} />Bloqueado</span>
                    <span className="dim mbadge-hint">{b.hint}</span>
                    {"pct" in b && <span className="pbar" aria-hidden><i style={{ width: `${b.pct}%` }} /></span>}
                  </>
                )}
                {"href" in b && b.href && <Link className="mbadge-a" href={b.href}>{b.got ? "Ver certificado" : "Ir para a trilha"}<span className="sr-only">: {b.name}</span></Link>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === "anotacoes" && (
        <div className="mpanel">
          <h2 className="mpanel-h">Suas anotações</h2>
          {notesCount > 50 && <p className="muted mpanel-sub">Mostrando as 50 mais recentes.</p>}
          {notes.length ? (
            <ul className="mnotes">
              {notes.map((n) => {
                const l = byId.get(n.lesson_id);
                if (!l) return null;
                return (
                  <li key={n.id}>
                    <Link className="mnote" href={`/aula/${l.trackIds[0]}/${l.id}`}>
                      <span className="mnote-h"><b>{l.title}</b><time dateTime={n.created_at}>{dateBR(n.created_at)}</time></span>
                      <span className="mnote-b">{n.body}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="empty"><span className="empty-ico" aria-hidden="true"><Ico name="pen" size={28} /></span><p className="muted">Você ainda não fez anotações. Use a aba Anotações durante uma aula.</p></div>
          )}
        </div>
      )}

      {tab === "perfil" && (
        <div className="mpanel" id="nome">
          <h2 className="mpanel-h">Seu nome no certificado</h2>
          <NameForm current={profile.full_name ?? ""} />
          <p className="dim mpanel-sub" style={{ marginTop: 16 }}>Conta: {user.email}</p>
        </div>
      )}
    </div>
  );
}
