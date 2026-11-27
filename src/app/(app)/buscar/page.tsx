import type { Metadata } from "next";
import Link from "next/link";
import Form from "next/form";
import { allLessons } from "@/lib/catalog";
import { getCatalog, getMe, getPublishedTexts, searchLessons } from "@/lib/db/aluno";
import { queryWords, searchInMemory, snippet, WHERE_LABEL, type Hit } from "@/lib/search";
import { LessonRow } from "@/components/cards";
import { Ico } from "@/components/ico";

export const metadata: Metadata = { title: "Buscar" };
const SUGESTOES = ["etiqueta", "whatsapp oficial", "funil", "relatório", "gatilho", "contato", "webchat"];

export default async function Buscar({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").trim();
  const [{ done }, tracks] = await Promise.all([getMe(), getCatalog()]);
  const words = queryWords(q);
  const lessons = allLessons(tracks);
  const byId = new Map(lessons.map((l) => [l.id, l]));

  let hits: Hit[] = [];
  let texts = new Map<string, string>();
  if (words.length) {
    const rpc = await searchLessons(q, words);
    if (rpc) {
      hits = rpc;
      const ids = rpc.filter((h) => h.matched === "text").map((h) => h.id);
      if (ids.length) texts = await getPublishedTexts(ids);
    } else {
      texts = await getPublishedTexts();
      hits = searchInMemory(lessons.map((l) => ({ ...l, text: texts.get(l.id) })), q);
    }
  }
  const results = hits.flatMap((h) => { const l = byId.get(h.id); return l ? [{ lesson: l, matched: h.matched }] : []; });

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
              {results.map(({ lesson: l, matched }) => {
                const body = matched === "text" ? texts.get(l.id) : undefined;
                const parts = body ? snippet(body, words) : null;
                return (
                  <LessonRow key={l.id} lesson={l} trackId={l.trackIds[0]} meta={[tracks.find((t) => t.id === l.trackIds[0])?.name ?? "", l.moduleTitle]} done={done.has(l.id)}
                    extra={<>
                      <span className="res-where">{WHERE_LABEL[matched]}</span>
                      {parts && <span className="res-snip">{parts.map((p, i) => p.hit ? <mark key={i}>{p.text}</mark> : p.text)}</span>}
                    </>} />
                );
              })}
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
      {!q && <p className="muted res-n">Digite uma palavra ou escolha uma sugestão para encontrar aulas em todas as trilhas.</p>}
    </div>
  );
}
