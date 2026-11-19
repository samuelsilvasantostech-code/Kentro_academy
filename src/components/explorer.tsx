"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { Ico } from "@/components/ico";
import { CrystalGlyph } from "@/components/crystal/CrystalGlyph";
import { CATS, COVERS, type ArtId, type CatId } from "@/lib/category";
import { duration, minutes, normalize } from "@/lib/format";
import { topicIcon } from "@/lib/topic";

export type TrackItem = {
  id: string;
  name: string;
  pitch: string;
  audience: string;
  cat: CatId;
  art: ArtId;
  count: number;
  seconds: number;
  pct: number;
  started: boolean;
  tag: string | null;
  text: string;
};
export type LessonItem = { id: string; title: string; trackId: string; trackName: string; moduleTitle: string; seconds: number; done: boolean; cat: CatId; text: string };

const matches = (text: string, words: string[]) => words.every((w) => text.includes(w));

/**
 * Busca + filtros + cards de trilha. Filtra no navegador o catálogo real (vem do servidor);
 * Enter leva para /buscar com todos os resultados.
 */
export function Explorer({ tracks, lessons, headingLevel = 2, title, more }: { tracks: TrackItem[]; lessons: LessonItem[]; headingLevel?: 2 | 1; title: string; more?: React.ReactNode }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<CatId | "tudo">("tudo");
  const statusId = useId();
  const words = useMemo(() => normalize(q).trim().split(/\s+/).filter(Boolean), [q]);
  const cats = CATS.filter((c) => tracks.some((t) => t.cat === c.id));

  const shownTracks = tracks.filter((t) => (cat === "tudo" || t.cat === cat) && matches(t.text, words));
  const shownLessons = words.length && q.trim().length >= 2 ? lessons.filter((l) => (cat === "tudo" || l.cat === cat) && matches(l.text, words)) : [];
  const H = headingLevel === 1 ? "h1" : "h2";

  return (
    <section className="xp" aria-labelledby={`${statusId}-h`}>
      <form className="xp-bar" action="/buscar" role="search">
        <label className="xp-search">
          <Ico name="search" size={19} />
          <input name="q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="O que você quer aprender hoje?" aria-label="Buscar trilhas e aulas" autoComplete="off" />
          {q && <button type="button" className="xp-clear" onClick={() => setQ("")} aria-label="Limpar busca"><Ico name="x" size={16} /></button>}
        </label>
        <div className="xp-chips" role="group" aria-label="Filtrar por assunto">
          {[{ id: "tudo" as const, label: "Tudo" }, ...cats].map((c) => (
            <button key={c.id} type="button" className={`chip2${cat === c.id ? " on" : ""}`} aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>
              {c.label}
            </button>
          ))}
        </div>
      </form>

      <div className="sec-h">
        <H id={`${statusId}-h`}>{title}</H>
        <p className="sec-hint" id={statusId} aria-live="polite">
          {shownTracks.length} {shownTracks.length === 1 ? "trilha" : "trilhas"}
          {q.trim().length >= 2 && <> e {shownLessons.length} {shownLessons.length === 1 ? "aula" : "aulas"} para “{q.trim()}”</>}
        </p>
        {more}
      </div>

      {shownTracks.length > 0 ? (
        <ul className="tgrid">
          {shownTracks.map((t, i) => (
            <li key={t.id} style={{ ["--i" as string]: i }}>
              <Link className="tcard3" href={`/trilha/${t.id}`}>
                <span className={`tposter tc-${t.cat}`} aria-hidden>
                  <CrystalGlyph className="tp-gem" tilt={COVERS[t.art].tilt} />
                  <span className="tp-ico"><Ico name={COVERS[t.art].icon} size={18} /></span>
                  <span className="tp-mod">{COVERS[t.art].label}</span>
                </span>
                <span className="tc-body">
                  <span className="sr-only">{CATS.find((c) => c.id === t.cat)?.label}: </span>
                  {t.tag && <span className="tc-tag">{t.tag}</span>}
                  <h3>{t.name}</h3>
                  <span className="tc-desc">{t.pitch}</span>
                  {t.started && (
                    <span className="tc-prog">
                      <span className="pbar" role="progressbar" aria-valuenow={t.pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Progresso em ${t.name}`}><i style={{ width: `${t.pct}%` }} /></span>
                      <span>{t.pct}%</span>
                    </span>
                  )}
                  <span className="tc-foot">
                    <span><Ico name="video" size={14} />{t.count} aulas</span>
                    {t.seconds > 0 && <span><Ico name="clock" size={14} />{minutes(t.seconds)}</span>}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="xp-empty">
          <p><b>Nenhuma trilha encontrada.</b> Tente outra palavra ou volte para “Tudo”.</p>
          {(q || cat !== "tudo") && <button type="button" className="btn btn-s btn-sm" onClick={() => { setQ(""); setCat("tudo"); }}>Limpar filtros</button>}
        </div>
      )}

      {shownLessons.length > 0 && (
        <div className="xp-lessons">
          <h3 className="sub-h">Aulas encontradas</h3>
          <ul className="mlist">
            {shownLessons.slice(0, 6).map((l) => (
              <li key={`${l.trackId}-${l.id}`}>
                <Link href={`/aula/${l.trackId}/${l.id}`}>
                  <span className={`ml-ico${l.done ? " on" : ""}`} aria-hidden><Ico name={l.done ? "check" : topicIcon(l.title, l.moduleTitle)} size={16} /></span>
                  <span className="ml-main">
                    <b>{l.title}{l.done && <span className="sr-only"> (concluída)</span>}</b>
                    <span className="mmeta"><span>{l.trackName}</span><span>{l.moduleTitle}</span></span>
                  </span>
                  <span className="ml-time">{l.seconds ? duration(l.seconds) : "Leitura"}</span>
                </Link>
              </li>
            ))}
          </ul>
          {shownLessons.length > 6 && <Link className="mlink xp-all" href={`/buscar?q=${encodeURIComponent(q.trim())}`}>Ver as {shownLessons.length} aulas encontradas</Link>}
        </div>
      )}
    </section>
  );
}
