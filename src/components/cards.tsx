import Link from "next/link";
import type { Lesson, Track } from "@/lib/catalog";
import { progress } from "@/lib/catalog";
import type { TrackStatus } from "@/app/(app)/certificado/completion";
import { duration, minutes, thumb } from "@/lib/format";
import { FlowSvg } from "@/components/flow/FlowSvg";
import { Ico } from "@/components/ico";
import { topicIcon } from "@/lib/topic";
import type { Flow } from "@/components/flow/model";

const ico = (children: React.ReactNode) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{children}</svg>
);
export const IcPessoa = () => ico(<><circle cx="12" cy="8" r="4" /><path d="M4 20c1-4 4-6 8-6s7 2 8 6" /></>);
export const IcAulas = () => ico(<><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m10 9.5 5 2.5-5 2.5z" fill="currentColor" /></>);
export const IcTempo = () => ico(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>);
export const IcCert = () => ico(<><circle cx="12" cy="9" r="5" /><path d="m9 13-1.5 7L12 18l4.5 2L15 13" /></>);

export function LessonCard({ lesson, track, subtitle, done }: { lesson: Lesson; track: Track; subtitle: string; done: boolean }) {
  const img = thumb(lesson.youtube_id);
  return (
    <Link className="lcard" href={`/aula/${track.id}/${lesson.id}`}>
      <div className="im">
        {img ? <img loading="lazy" src={img} alt="" /> : <div className="play dim" style={{ fontSize: 13 }}>Leitura</div>}
        {lesson.youtube_id && lesson.duration_seconds > 0 ? <span className="d">{duration(lesson.duration_seconds)}</span> : !lesson.youtube_id && <span className="d">Leitura</span>}
        {done && <span className="ok"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>Concluída</span>}
      </div>
      <div className="b"><h4>{lesson.title}</h4><p><span>{track.name}</span><span className="sub">{subtitle}</span></p></div>
    </Link>
  );
}

export function TrackCard({ track, done, recommended, status, flow }: { track: Track; done: Set<string>; recommended?: boolean; status?: TrackStatus; flow?: Flow }) {
  const p = progress(track, done);
  return (
    <Link className="tcard" href={`/trilha/${track.id}`}>
      {flow && flow.nodes.length > 0 && <div className="tcard-flow"><FlowSvg flow={flow} size="compact" /></div>}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
        <div className="tico" style={{ background: `${track.color}22` }}>{track.icon}</div>
        {status?.hasNew ? <span className="pill a">Novo conteúdo</span>
          : status?.certified ? <span className="pill v">Concluída</span>
          : recommended ? <span className="pill v">Recomendada para você</span>
          : p.done > 0 && <span className="pill r">Em andamento</span>}
      </div>
      <div><h3>{track.name}</h3><p className="muted" style={{ fontSize: 14, marginTop: 4 }}>{track.pitch}</p></div>
      <div className="meta"><span><IcPessoa />{track.audience}</span><span><IcAulas />{p.count} aulas</span><span><IcTempo />{minutes(p.seconds)}</span></div>
      <div>
        <div className="bar"><i style={{ width: `${p.pct}%` }} /></div>
        <div className="meta" style={{ marginTop: 6, justifyContent: "space-between" }}><span>{p.pct}% concluído</span><span><IcCert />{status?.certified ? "conquistado" : "certificado"}</span></div>
      </div>
    </Link>
  );
}

export const PlayIcon = () => (
  <span><svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M8 5v14l11-7z" /></svg></span>
);

/* ---------- linhas do estilo minimalista (listas) ---------- */

export const Chev = () => (
  <svg className="ml-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m9 6 6 6-6 6" /></svg>
);

/** Trilha em uma linha: ponto de cor, nome, metadados, selo, progresso e seta. */
export function TrackRow({ track, done, status, recommended, pitch }: { track: Track; done: Set<string>; status?: TrackStatus; recommended?: boolean; pitch?: boolean }) {
  const p = progress(track, done);
  return (
    <li>
      <Link href={`/trilha/${track.id}`}>
        <span className="ml-dot" style={{ background: track.color }} aria-hidden />
        <span className="ml-main">
          <b>{track.name}</b>
          {pitch && <span className="ml-desc">{track.pitch}</span>}
          <span className="mmeta"><span>{track.audience}</span><span>{p.count} aulas</span><span>{minutes(p.seconds)}</span></span>
        </span>
        {status?.hasNew ? <span className="mtag">Novo conteúdo</span>
          : status?.certified ? <span className="mtag ok">Concluída</span>
          : recommended ? <span className="mtag ok">Recomendada</span>
          : null}
        <span className="mprog ml-prog"><span className="mbar"><i style={{ width: `${p.pct}%` }} /></span><span className="ml-pct">{p.pct}%</span></span>
        <Chev />
      </Link>
    </li>
  );
}

/** Aula em uma linha: marcador de concluída, título, trilha/módulo, duração e seta. */
export function LessonRow({ lesson, trackId, meta, done }: { lesson: Lesson; trackId: string; meta: string[]; done?: boolean }) {
  return (
    <li>
      <Link href={`/aula/${trackId}/${lesson.id}`}>
        <span className={`ml-ico${done ? " on" : ""}`} aria-hidden>
          <Ico name={done ? "check" : topicIcon(lesson.title, meta[meta.length - 1])} size={16} strokeWidth={done ? 3 : 2} />
        </span>
        <span className="ml-main">
          <b>{lesson.title}{done && <span className="sr-only"> (concluída)</span>}</b>
          <span className="mmeta">{meta.filter(Boolean).map((m, i) => <span key={i}>{m}</span>)}</span>
        </span>
        <span className="ml-time">{lesson.duration_seconds ? duration(lesson.duration_seconds) : "Leitura"}</span>
        <Chev />
      </Link>
    </li>
  );
}
