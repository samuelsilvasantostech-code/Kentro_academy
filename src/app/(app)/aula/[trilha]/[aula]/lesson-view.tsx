"use client";

import Link from "next/link";
import { useEffect, useState, useTransition, type KeyboardEvent } from "react";
import type { TrackLesson } from "@/lib/catalog";
import { duration, mmss } from "@/lib/format";
import { Ico } from "@/components/ico";
import { VideoCover } from "./video-cover";
import { FlowStrip } from "@/components/flow/FlowStrip";
import type { Flow } from "@/components/flow/model";
import { askQuestion, completeLesson, deleteNote, markAnswersSeen, saveNote, undoLesson } from "../../../actions";

type Props = {
  track: { id: string; name: string };
  lesson: TrackLesson;
  position: { index: number; total: number };
  prevId?: string;
  hasNext: boolean;
  done: boolean;
  others: { id: string; name: string }[];
  chapters: { start_seconds: number; title: string }[];
  materials: { id: string; title: string; description: string | null; url: string }[];
  notes: { id: string; body: string; created_at: string }[];
  questions: { id: string; body: string; answer: string | null; created_at: string; answered_at: string | null; answer_seen_at: string | null }[];
  initialTab?: "duvidas";
  /** Fluxo da trilha montado no servidor (objeto simples) e rótulos da faixa. */
  flow?: Flow;
  flowLabel?: string;
};

const TABS = { resumo: "Resumo", capitulos: "Capítulos", materiais: "Materiais", anotacoes: "Anotações", duvidas: "Dúvidas" } as const;
type Tab = keyof typeof TABS;
const date = (s: string) => new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
const PASSOS_PADRAO = ["Abra o Kentro em outra aba.", "Vá até o menu mostrado no vídeo.", "Repita o passo a passo com um caso real da sua empresa.", "Volte aqui e marque a aula como concluída."];

export function LessonView(p: Props) {
  const { track, lesson: l } = p;
  const [tab, setTab] = useState<Tab>(p.initialTab ?? "resumo");
  const [start, setStart] = useState(0);
  // O player só entra depois do clique na capa (ou num capítulo).
  const [playingFor, setPlayingFor] = useState<string | null>(null);
  const playing = playingFor === l.id;
  const [note, setNote] = useState("");
  const [question, setQuestion] = useState("");
  const [pending, run] = useTransition();
  // Aula em que o aluno acabou de clicar em concluir: só nela o check faz o "pop" (resposta à ação dele).
  const [popFor, setPopFor] = useState<string | null>(null);
  if (popFor && !pending && !p.done) setPopFor(null);
  const pop = popFor === l.id;

  const unseen = p.questions.some((q) => q.answer && !q.answer_seen_at);
  useEffect(() => {
    if (tab === "duvidas" && unseen) markAnswersSeen(l.id);
  }, [tab, unseen, l.id]);

  const tabs = (Object.keys(TABS) as Tab[]).filter((k) => k !== "capitulos" || p.chapters.length);
  // Setas esquerda e direita trocam de aba (padrão de abas do WAI-ARIA).
  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = tabs[(tabs.indexOf(tab) + d + tabs.length) % tabs.length];
    setTab(next);
    document.getElementById(`tab-${next}`)?.focus();
  };
  const steps = l.steps.length ? l.steps : PASSOS_PADRAO;

  return (
    <div className="lesson">
      <nav className="bc" aria-label="Você está em">
        <ol>
          <li><Link href="/trilhas">Trilhas</Link></li>
          <li><Link href={`/trilha/${track.id}`}>{track.name}</Link></li>
          <li><span aria-current="page">{l.moduleTitle}</span></li>
        </ol>
      </nav>

      {l.youtube_id ? (
        <VideoCover youtubeId={l.youtube_id} title={l.title} moduleTitle={l.moduleTitle} trackName={track.name} position={p.position} seconds={l.duration_seconds} start={start} playing={playing} onPlay={() => setPlayingFor(l.id)} />
      ) : (
        <div className="doit soon">
          <span className="pill a"><Ico name="video" size={14} />Vídeo em breve</span>
          <p className="muted" style={{ whiteSpace: "pre-line" }}>{l.summary || "Esta aula ainda não tem vídeo. Siga o passo a passo abaixo e marque como concluída."}</p>
        </div>
      )}

      <div className="lesson-flow">{p.flow && <FlowStrip flow={p.flow} label={p.flowLabel ?? "Posição da aula na trilha"} />}</div>

      <header className="lesson-head">
        <div>
          <h1 className="lesson-title">{l.title}</h1>
          <div className="meta lesson-meta">
            <span>Aula {p.position.index} de {p.position.total}</span>
            <span><Ico name="clock" size={15} />{l.duration_seconds ? duration(l.duration_seconds) : "Leitura"}</span>
          </div>
        </div>
        <div className="lesson-bar">
          {p.prevId && <Link className="btn btn-s" href={`/aula/${track.id}/${p.prevId}`}><Ico name="arrowL" />Aula anterior</Link>}
          {p.done ? (
            <>
              <button className="btn btn-s" disabled={pending} onClick={() => { setPopFor(null); run(() => undoLesson(l.id)); }} title="Desmarcar como concluída">{pop ? <span className="ck-pop" aria-hidden="true"><Ico name="check" strokeWidth={3} /></span> : <Ico name="check" strokeWidth={3} />}Concluída</button>
              {p.hasNext && <button className="btn btn-p" disabled={pending} onClick={() => run(() => completeLesson(track.id, l.id))}>Próxima aula<Ico name="arrowR" /></button>}
            </>
          ) : (
            <button className="btn btn-p" disabled={pending} onClick={() => { setPopFor(l.id); run(() => completeLesson(track.id, l.id)); }}>
              {pending ? <>{pop && <span className="ck-pop" aria-hidden="true"><Ico name="check" strokeWidth={3} /></span>}Salvando…</> : p.hasNext ? <>Concluir e avançar<Ico name="arrowR" /></> : <>Concluir trilha<Ico name="award" /></>}
            </button>
          )}
        </div>
      </header>

      <div className="tabs" role="tablist" aria-label="Seções da aula">
        {tabs.map((k) => (
          <button key={k} id={`tab-${k}`} role="tab" aria-selected={tab === k} aria-controls={`painel-${k}`} tabIndex={tab === k ? 0 : -1} className={tab === k ? "on" : ""} onClick={() => setTab(k)} onKeyDown={onTabKey}>
            {TABS[k]}{k === "capitulos" ? ` (${p.chapters.length})` : k === "anotacoes" && p.notes.length ? ` (${p.notes.length})` : ""}
            {k === "duvidas" && unseen && <span className="dot" role="img" aria-label="resposta nova" />}
          </button>
        ))}
      </div>

      <div className="tabc" role="tabpanel" id={`painel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "resumo" && (
          <>
            {!l.youtube_id ? null : l.summary ? <p style={{ whiteSpace: "pre-line" }}>{l.summary}</p>
              : <p className="muted">Assista à aula e depois repita o passo a passo no seu Kentro.</p>}
            <section className="doit" aria-labelledby="faca-agora">
              <h2 id="faca-agora"><Ico name="wrench" size={18} />Faça agora no seu Kentro</h2>
              <ol className="dosteps">{steps.map((s, i) => <li key={`${i}-${s}`}><span>{s}</span></li>)}</ol>
              <div><a className="btn btn-s btn-sm" href="https://www.kentro.com.br" target="_blank" rel="noopener">Abrir o Kentro<Ico name="ext" size={16} /><span className="sr-only"> (abre em outra aba)</span></a></div>
            </section>
            {p.others.length > 0 && (
              <p className="also">
                <Ico name="layers" size={16} />
                <span>Esta aula também faz parte de {p.others.map((o, i) => <span key={o.id}>{i > 0 && ", "}<Link className="lnk" href={`/trilha/${o.id}`}>{o.name}</Link></span>)}. O seu progresso vale para todas.</span>
              </p>
            )}
          </>
        )}

        {tab === "capitulos" && p.chapters.map((c) => (
          <button key={c.start_seconds} className="chap" onClick={() => { setStart(c.start_seconds || 1); setPlayingFor(l.id); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
            <b>{mmss(c.start_seconds)}</b>{c.title}
          </button>
        ))}

        {tab === "materiais" && (p.materials.length ? p.materials.map((m) => (
          <div key={m.id} className="file">
            <span className="x"><Ico name="file" size={20} /></span>
            <div className="file-t"><b>{m.title}</b>{m.description && <div className="dim">{m.description}</div>}</div>
            <a className="btn btn-s btn-sm" href={m.url} target="_blank" rel="noopener">Abrir<span className="sr-only"> {m.title} em outra aba</span></a>
          </div>
        )) : <p className="dim">Esta aula não tem materiais de apoio.</p>)}

        {tab === "anotacoes" && (
          <>
            <label className="sr-only" htmlFor="nova-nota">Nova anotação</label>
            <textarea id="nova-nota" value={note} onChange={(e) => setNote(e.target.value)} maxLength={4000} placeholder="Escreva uma anotação. Só você vê." />
            <div><button className="btn btn-p btn-sm" disabled={pending || !note.trim()} onClick={() => run(async () => { await saveNote(l.id, note); setNote(""); })}>Salvar anotação</button></div>
            {p.notes.length === 0 && <p className="dim">Você ainda não fez anotações nesta aula.</p>}
            {p.notes.map((n) => (
              <div key={n.id} className="note note-row">
                <div className="note-body">
                  <div className="note-h"><b>{date(n.created_at)}</b></div>
                  {n.body}
                </div>
                <button className="lnk-btn" disabled={pending} onClick={() => run(() => deleteNote(n.id))} aria-label={`Apagar anotação de ${date(n.created_at)}`}>Apagar</button>
              </div>
            ))}
          </>
        )}

        {tab === "duvidas" && (
          <>
            <label className="sr-only" htmlFor="nova-duvida">Sua dúvida</label>
            <textarea id="nova-duvida" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={4000} placeholder="Ficou com alguma dúvida sobre esta aula? Pergunte aqui. A equipe Kentro responde por esta aba." />
            <div><button className="btn btn-p btn-sm" disabled={pending || !question.trim()} onClick={() => run(async () => { await askQuestion(l.id, question); setQuestion(""); })}>Enviar dúvida</button></div>
            {p.questions.length === 0 && <p className="dim">Nenhuma dúvida enviada nesta aula.</p>}
            {p.questions.map((q) => (
              <div key={q.id} className="note qa">
                <div className="qa-q">
                  <div className="note-h"><b>Você</b><span className="dim">{date(q.created_at)}</span></div>
                  <div style={{ whiteSpace: "pre-line" }}>{q.body}</div>
                </div>
                {q.answer ? (
                  <div className="qa-a">
                    <div className="note-h"><b>Equipe Kentro</b>{q.answered_at && <span className="dim">{date(q.answered_at)}</span>}</div>
                    <div style={{ whiteSpace: "pre-line" }}>{q.answer}</div>
                  </div>
                ) : (
                  <p className="qa-wait"><span className="pill a">Aguardando resposta</span><span className="dim">A equipe responde em até 2 dias úteis.</span></p>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
