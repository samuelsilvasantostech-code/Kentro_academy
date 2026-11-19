import type { Metadata } from "next";
import Link from "next/link";
import { allLessons, getCatalog, getMe, nextOf, progress, type Track } from "@/lib/catalog";
import { minutes } from "@/lib/format";
import { COVERS, trackKind } from "@/lib/category";
import { coverOf } from "@/lib/covers";
import { trackCopy } from "@/lib/track-copy";
import { Cover } from "@/components/cover";
import { Ico } from "@/components/ico";
import { PointerGlow } from "@/components/pointer-glow";
import { getTrackStatuses, type TrackStatus } from "../certificado/completion";

export const metadata: Metadata = { title: "Trilhas" };

type Card = { t: Track; pct: number; started: boolean; certified: boolean; next: string | null; status?: TrackStatus };

function TrackCard({ c, rec, i }: { c: Card; rec: boolean; i: number }) {
  const { t } = c;
  const p = progress(t, new Set());
  const { art } = trackKind(t);
  const cv = COVERS[art];
  const tag = c.status?.hasNew ? "Novo conteúdo" : c.certified ? "Concluída" : rec ? "Recomendada para você" : c.started ? "Em andamento" : null;
  const shown = t.modules.slice(0, 3);
  return (
    <li style={{ "--i": i } as React.CSSProperties}>
      <Link className="ccard kglow" href={`/trilha/${t.id}`}>
        <span className="ccard-top">
          <Cover img={coverOf(t.id)} icon={cv.icon} tilt={cv.tilt} sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 460px" />
          <span className="ccard-cat"><Ico name={cv.icon} size={13} />{cv.label}</span>
          {tag && <span className={`ccard-tag${c.certified ? " is-ok" : ""}`}>{tag}</span>}
        </span>
        <span className="ccard-body">
          <b className="ccard-t">{t.name}</b>
          <span className="ccard-p">{trackCopy(t).headline}</span>
          <span className="ccard-meta">
            <span><Ico name="layers" size={14} />{t.modules.length} {t.modules.length === 1 ? "módulo" : "módulos"}</span>
            <span><Ico name="video" size={14} />{p.count} aulas</span>
            <span><Ico name="clock" size={14} />{minutes(p.seconds)}</span>
            <span><Ico name="award" size={14} />Certificado</span>
          </span>
          <span className="ccard-mods" aria-label="Módulos">
            {shown.map((m) => <span key={m.id}>{m.title}</span>)}
            {t.modules.length > shown.length && <span className="more">+{t.modules.length - shown.length}</span>}
          </span>
          <span className="ccard-foot">
            {c.started || c.certified ? (
              <span className="ccard-prog">
                <span className="pbar" aria-hidden><i style={{ width: `${c.pct}%` }} /></span>
                <span className="tnum">{c.pct}%</span>
              </span>
            ) : <span className="ccard-for"><Ico name="user" size={14} />{t.audience}</span>}
            <span className="ccard-go">{c.certified ? "Rever" : c.started ? "Continuar" : "Conhecer"}<Ico name="arrowR" size={16} /></span>
          </span>
          {c.started && !c.certified && c.next && <span className="ccard-next"><span className="dim">Próxima aula:</span> {c.next}</span>}
        </span>
      </Link>
    </li>
  );
}

export default async function Trilhas() {
  const [{ profile, done }, tracks, statuses] = await Promise.all([getMe(), getCatalog(), getTrackStatuses()]);
  const recId = profile.role_track ?? undefined;
  const cards: Card[] = tracks.map((t) => {
    const p = progress(t, done);
    const st = statuses.get(t.id);
    return { t, pct: p.pct, started: p.done > 0, certified: !!st?.certified, next: p.count ? nextOf(t, done)?.title ?? null : null, status: st };
  });
  // Ordem: a recomendada, as em andamento, as que faltam começar e por fim as concluídas.
  const rank = (c: Card) => (c.t.id === recId && !c.certified ? 0 : c.certified ? 3 : c.started ? 1 : 2);
  const ordered = [...cards].sort((a, b) => rank(a) - rank(b));
  const lessons = allLessons(tracks).length;
  const secs = allLessons(tracks).reduce((a, l) => a + l.duration_seconds, 0);

  return (
    <div className="kh cat">
      <PointerGlow />
      <header className="cat-h">
        <div>
          <p className="cat-k">Catálogo</p>
          <h1>Trilhas de aprendizagem</h1>
          <p className="cat-sub">Escolha um caminho, assista às aulas curtas e ganhe seu certificado. Cada trilha leva você do básico ao uso completo de uma parte do Kentro.</p>
        </div>
        <ul className="cat-stats" aria-label="Resumo do catálogo">
          <li><b>{tracks.length}</b><span>trilhas</span></li>
          <li><b>{lessons}</b><span>aulas</span></li>
          <li><b>{Math.round(secs / 3600)}h</b><span>de conteúdo</span></li>
        </ul>
      </header>

      <ol className="cat-how" aria-label="Como funciona">
        <li><span className="cat-how-n">1</span><div><b>Escolha a trilha</b><span>Comece pela recomendada para a sua função ou pela que você precisa agora.</span></div></li>
        <li><span className="cat-how-n">2</span><div><b>Assista às aulas</b><span>Vídeos curtos, com passo a passo para repetir no seu Kentro.</span></div></li>
        <li><span className="cat-how-n">3</span><div><b>Ganhe o certificado</b><span>Conclua as aulas e os quizzes e baixe o seu certificado.</span></div></li>
      </ol>

      <section aria-labelledby="cat-all">
        <h2 id="cat-all" className="sr-only">Todas as trilhas</h2>
        <ul className="cgrid">
          {ordered.map((c, i) => <TrackCard key={c.t.id} c={c} rec={c.t.id === recId} i={i} />)}
        </ul>
      </section>
      <p className="cat-cred dim"><Link href="/creditos">Créditos das fotos das capas</Link></p>
    </div>
  );
}
