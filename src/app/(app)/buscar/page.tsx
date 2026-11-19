import type { Metadata } from "next";
import Link from "next/link";
import Form from "next/form";
import { allLessons, getCatalog, getMe } from "@/lib/catalog";
import { normalize } from "@/lib/format";
import { LessonRow } from "@/components/cards";
import { Ico } from "@/components/ico";

export const metadata: Metadata = { title: "Buscar" };
const SUGESTOES = ["etiqueta", "whatsapp oficial", "funil", "relatório", "gatilho", "contato", "webchat"];

export default async function Buscar({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").trim();
  const [{ done }, tracks] = await Promise.all([getMe(), getCatalog()]);
  const words = normalize(q).split(/\s+/).filter(Boolean);
  const results = words.length
    ? allLessons(tracks).filter((l) => { const hay = normalize(`${l.title} ${l.moduleTitle} ${l.summary ?? ""} ${l.steps.join(" ")}`); return words.every((w) => hay.includes(w)); })
    : [];

  return (
    <div className="page-narrow">
      <h1>Buscar</h1>
      <Form action="/buscar" className="sbar" role="search">
        <div className="sbar-in">
          <Ico name="search" size={18} />
          <input className="input" name="q" defaultValue={q} placeholder="O que você quer aprender?" aria-label="Buscar aulas" autoFocus />
        </div>
        <button type="submit" className="btn btn-p">Buscar</button>
      </Form>
      <div className="chips">
        <span className="dim chips-l">Sugestões</span>
        {SUGESTOES.map((s) => <Link key={s} className="pill chip" href={`/buscar?q=${encodeURIComponent(s)}`}>{s}</Link>)}
      </div>
      {q && (
        <>
          <p className="muted res-n" role="status">{results.length} aula{results.length === 1 ? "" : "s"} para <b>“{q}”</b></p>
          {results.length > 0 && (
            <ul className="mlist">
              {results.map((l) => <LessonRow key={l.id} lesson={l} trackId={l.trackIds[0]} meta={[tracks.find((t) => t.id === l.trackIds[0])?.name ?? "", l.moduleTitle]} done={done.has(l.id)} />)}
            </ul>
          )}
          {!results.length && (
            <div className="empty">
              <span className="empty-ico" aria-hidden="true"><Ico name="search" size={28} /></span>
              <h3>Nenhuma aula encontrada</h3>
              <p className="muted">Tente outra palavra, como fila ou CRM, ou navegue pelas trilhas.</p>
              <Link className="btn btn-s" href="/trilhas">Ver trilhas</Link>
            </div>
          )}
        </>
      )}
      {!q && <p className="muted res-n">Digite um termo ou escolha uma sugestão para encontrar aulas em todas as trilhas.</p>}
    </div>
  );
}
