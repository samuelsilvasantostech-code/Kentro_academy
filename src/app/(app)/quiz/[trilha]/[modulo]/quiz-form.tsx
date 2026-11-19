"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Ico } from "@/components/ico";
import { submitQuiz, type QuizResult } from "../../../actions";

/** Intervalo entre tentativas, igual ao do banco (submit_quiz recusa com too_fast). */
const COOLDOWN = 20;
const LETTERS = "ABCDEF";

/**
 * Nota que sobe de 0 ao valor em ~600ms (uma vez). O número real fica num span só para leitores de tela
 * e o animado é aria-hidden. Com reduced-motion mostra o valor final direto.
 */
function CountUp({ to }: { to: number }) {
  const [v, setV] = useState(() => (to <= 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches ? to : 0));
  useEffect(() => {
    if (to <= 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / 600);
      setV(Math.round(to * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return (
    <>
      <span className="sr-only">{to}</span>
      <span aria-hidden="true">{v}</span>
    </>
  );
}

/** Segundos até poder enviar de novo; `start()` reinicia a contagem. */
function useCooldown() {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (left <= 0) return;
    const id = window.setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);
  return { left, start: () => setLeft(COOLDOWN) };
}

type Lesson = { id: string; title: string; href: string };

/**
 * Quiz com uma pergunta por tela. A correção é no servidor; reprovado vê só acerto/erro por questão
 * (nunca o gabarito) e a lista de aulas do módulo para rever. Gabarito e explicação só depois da aprovação.
 */
export function QuizForm({ moduleId, trackId, questions, lessons, submit = submitQuiz }: { moduleId: string; trackId: string; questions: { question: string; options: string[] }[]; lessons: Lesson[]; submit?: typeof submitQuiz }) {
  const [answers, setAnswers] = useState<number[]>([]);
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, run] = useTransition();
  const cool = useCooldown();
  const title = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  const total = questions.length;
  const last = step === total - 1;
  const q = questions[step];
  const chosen = answers[step];
  const passed = !!result?.passed;
  const wrong = result ? result.results.map((r, i) => (r ? -1 : i)).filter((i) => i >= 0) : [];

  // Ao trocar de pergunta o foco vai para o enunciado (não na primeira tela, para não pular o cabeçalho).
  useEffect(() => {
    if (moved.current) title.current?.focus();
  }, [step]);
  const go = (n: number) => { moved.current = true; setStep(n); };

  const reset = () => { setResult(null); setAnswers([]); setFailed(false); moved.current = false; setStep(0); window.scrollTo({ top: 0 }); };
  const focusResult = useCallback((el: HTMLElement | null) => { el?.focus(); }, []);

  const send = () => run(async () => {
    const r = await submit(moduleId, answers);
    if (r?.tooFast) { cool.start(); setFailed(false); return; }
    setResult(r);
    setFailed(!r);
    if (r) { cool.start(); window.scrollTo({ top: 0 }); }
  });

  if (result) {
    const pct = result.total ? Math.round((result.score / result.total) * 100) : 0;
    return (
      <>
        <div className={`qres ${passed ? "is-pass" : "is-fail"}`} tabIndex={-1} ref={focusResult} aria-live="polite">
          <div className="qres-top">
            <div className="qres-ring" style={{ "--p": pct } as React.CSSProperties} aria-hidden="true">
              <Ico name={passed ? "check" : "refresh"} size={26} strokeWidth={passed ? 3 : 2.4} />
            </div>
            <div className="qres-score"><b><CountUp to={result.score} /></b><span>de {result.total} corretas ({pct}%)</span></div>
          </div>
          {passed ? (
            <>
              <h2 className="qres-h">Módulo concluído</h2>
              <p className="muted">Veja abaixo a resposta certa e a explicação de cada pergunta.</p>
              <div className="qres-btns">
                <Link className="btn btn-p" href={`/trilha/${trackId}`}>Voltar à trilha<Ico name="arrowR" /></Link>
                <button className="btn btn-s" onClick={reset} disabled={cool.left > 0}>{cool.left > 0 ? `Refazer em ${cool.left} s` : "Refazer o quiz"}</button>
              </div>
            </>
          ) : (
            <>
              <h2 className="qres-h">Ainda não foi desta vez</h2>
              <p className="muted">Você precisa de 70% para concluir. {wrong.length === 1 ? "Você errou a pergunta" : "Você errou as perguntas"} {wrong.map((i) => i + 1).join(", ").replace(/, (\d+)$/, " e $1")}. Reveja as aulas e tente de novo.</p>
              {lessons.length > 0 && (
                <div className="qrev" id="rever">
                  <p className="qrev-k">Aulas deste módulo</p>
                  <ol>
                    {lessons.map((l, i) => (
                      <li key={l.id}><Link href={l.href}><span className="qrev-n">{i + 1}</span><span className="qrev-t">{l.title}</span><Ico name="arrowR" size={16} /></Link></li>
                    ))}
                  </ol>
                </div>
              )}
              <div className="qres-btns">
                <button className="btn btn-p" onClick={reset} disabled={cool.left > 0}>
                  {cool.left > 0 ? <span>Tentar de novo em <span className="tnum">{cool.left}</span> s</span> : "Tentar de novo"}
                </button>
                <Link className="btn btn-s" href={`/trilha/${trackId}`}>Voltar à trilha</Link>
              </div>
              {cool.left > 0 && <p className="dim qres-wait">Há um intervalo de {COOLDOWN} segundos entre as tentativas.</p>}
            </>
          )}
        </div>

        <h2 className="qrv-h">Suas respostas</h2>
        <ol className="qrv">
          {questions.map((qq, qi) => {
            const right = result.results[qi];
            const mineIdx = answers[qi];
            const correctIdx = passed ? result.correct?.[qi] : undefined;
            return (
              <li key={qi} className={`qq ${right ? "is-right" : "is-wrong"}`}>
                <p className="qq-n">Pergunta {qi + 1} de {total}</p>
                <h3 className="qq-t">{qq.question}</h3>
                <ul className="qrv-opts">
                  {qq.options.map((o, oi) => {
                    const mine = mineIdx === oi;
                    const isRight = correctIdx === oi;
                    if (!mine && !isRight) return null;
                    return (
                      <li key={oi} className={`qrv-o ${isRight ? "right" : mine && passed ? "wrong" : "mine"}`}>
                        <span className="qopt-l" aria-hidden="true">{LETTERS[oi]}</span>
                        <span className="qopt-t">{o}</span>
                        <span className="qopt-tag">{isRight ? (mine ? "Sua resposta, correta" : "Resposta correta") : "Sua resposta"}</span>
                      </li>
                    );
                  })}
                </ul>
                <div className={`qfb ${right ? "ok" : "no"}`}>
                  <Ico name={right ? "check" : "x"} size={18} strokeWidth={3} />
                  <p>
                    <b>{right ? "Você acertou." : "Você errou."}</b>
                    {passed && result.explanations?.[qi] ? ` ${result.explanations[qi]}` : ""}
                    {!passed && !right && lessons.length > 0 ? <> <a href="#rever">Reveja as aulas do módulo</a> antes de tentar de novo.</> : ""}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </>
    );
  }

  return (
    <div className="qstep">
      <div className="qsegs" aria-hidden="true">
        {questions.map((_, i) => <i key={i} className={i === step ? "cur" : answers[i] !== undefined ? "on" : ""} />)}
      </div>
      <section key={step} className="qq qq-one" aria-labelledby="qq-t">
        <p className="qq-n">Pergunta {step + 1} de {total}</p>
        <h2 className="qq-t" id="qq-t" tabIndex={-1} ref={title}>{q.question}</h2>
        <div className="qq-opts" role="radiogroup" aria-labelledby="qq-t">
          {q.options.map((o, oi) => (
            <label key={oi} className="qopt">
              <input type="radio" name={`q${step}`} checked={chosen === oi}
                onChange={() => setAnswers((a) => { const n = [...a]; n[step] = oi; return n; })} />
              <span className="qopt-l" aria-hidden="true">{LETTERS[oi]}</span>
              <span className="qopt-t">{o}</span>
              <span className="qopt-mark" aria-hidden="true" />
            </label>
          ))}
        </div>
      </section>

      <div className="qnav">
        {step > 0 && <button type="button" className="btn btn-s qnav-back" onClick={() => go(step - 1)} aria-label="Pergunta anterior"><Ico name="arrowL" /><span>Anterior</span></button>}
        {last ? (
          <button type="button" className="btn btn-p qnav-go" disabled={chosen === undefined || pending || cool.left > 0} onClick={send}>
            {pending ? "Corrigindo…" : cool.left > 0 ? <span>Aguarde <span className="tnum">{cool.left}</span> s</span> : <>Ver resultado<Ico name="check" /></>}
          </button>
        ) : (
          <button type="button" className="btn btn-p qnav-go" disabled={chosen === undefined} onClick={() => go(step + 1)}>Próxima<Ico name="arrowR" /></button>
        )}
      </div>
      {chosen === undefined && <p className="dim qnav-hint">Escolha uma alternativa para continuar.</p>}
      {cool.left > 0 && <p className="expl" role="status">Há um intervalo de {COOLDOWN} segundos entre as tentativas. O botão libera sozinho.</p>}
      {failed && <p className="err" role="alert">Não foi possível corrigir o quiz. Verifique sua conexão e envie de novo.</p>}
    </div>
  );
}
