"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import { Ico } from "@/components/ico";
import { submitQuiz, type QuizResult } from "../../../actions";

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

export function QuizForm({ moduleId, trackId, questions, reviewHref }: { moduleId: string; trackId: string; questions: { question: string; options: string[] }[]; reviewHref?: string }) {
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [failed, setFailed] = useState(false);
  const [wait, setWait] = useState(false);
  const [pending, run] = useTransition();
  const total = questions.length;
  const count = questions.filter((_, i) => answers[i] !== undefined).length;
  const answered = count === total;
  const passed = !!result?.passed;
  const reset = () => { setResult(null); setAnswers([]); setFailed(false); setWait(false); window.scrollTo({ top: 0 }); };
  // Ao corrigir, o foco vai para o resultado (leitor de tela anuncia e o teclado continua dali).
  const focusResult = useCallback((el: HTMLElement | null) => { el?.focus(); }, []);

  return (
    <>
      {questions.map((q, qi) => {
        const right = result?.results[qi];
        const state = result ? (right ? "is-right" : "is-wrong") : "";
        return (
          <section key={qi} className={`qq ${state}`} aria-labelledby={`q${qi}-t`}>
            <p className="qq-n">Pergunta {qi + 1} de {total}</p>
            <h2 className="qq-t" id={`q${qi}-t`}>{q.question}</h2>
            <div className="qq-opts" role="radiogroup" aria-labelledby={`q${qi}-t`}>
              {q.options.map((o, oi) => {
                const mine = answers[qi] === oi;
                // Só aprovado vê a alternativa certa; reprovado só vê as próprias escolhas.
                const isRight = passed && !!result?.correct && oi === result.correct[qi];
                const isWrong = passed && !!result?.correct && !isRight && mine;
                const mark = isRight ? "right" : isWrong ? "wrong" : "";
                return (
                  <label key={oi} className={`qopt ${mark}`}>
                    <input type="radio" name={`q${qi}`} checked={mine} disabled={!!result}
                      onChange={() => setAnswers((a) => { const n = [...a]; n[qi] = oi; return n; })} />
                    <span className="qopt-mark" aria-hidden="true">
                      {isRight ? <Ico name="check" size={14} strokeWidth={3.2} /> : isWrong ? <Ico name="x" size={14} strokeWidth={3.2} /> : null}
                    </span>
                    <span className="qopt-t">{o}</span>
                    {isRight && <span className="qopt-tag">Resposta correta</span>}
                    {isWrong && <span className="qopt-tag">Sua resposta</span>}
                    {!passed && result && mine && <span className="qopt-tag">Sua resposta</span>}
                  </label>
                );
              })}
            </div>
            {result && (
              <div className={`qfb ${right ? "ok" : "no"}`}>
                <Ico name={right ? "check" : "x"} size={18} strokeWidth={3} />
                <p>
                  <b>{right ? "Você acertou." : "Você errou."}</b>
                  {passed && result.explanations?.[qi] ? ` ${result.explanations[qi]}` : ""}
                </p>
              </div>
            )}
          </section>
        );
      })}

      <div className="qz-foot" aria-live="polite">
        {result ? (
          <div className={`qres ${passed ? "is-pass" : "is-fail"}`} tabIndex={-1} ref={focusResult}>
            <div className="qres-score"><b><CountUp to={result.score} /></b><span>de {result.total} corretas</span></div>
            {passed ? (
              <>
                <p className="pill v"><Ico name="check" size={14} strokeWidth={3} />Módulo concluído</p>
                <div className="qres-btns">
                  <Link className="btn btn-p" href={`/trilha/${trackId}`}>Voltar à trilha<Ico name="arrowR" /></Link>
                  <button className="btn btn-s" onClick={reset}>Refazer o quiz</button>
                </div>
              </>
            ) : (
              <>
                <p className="muted">Você precisa de 70% para concluir. Reveja as aulas deste módulo e tente de novo.</p>
                <div className="qres-btns">
                  <button className="btn btn-p" onClick={reset}>Tentar de novo</button>
                  {reviewHref
                    ? <Link className="btn btn-s" href={reviewHref}>Rever as aulas do módulo</Link>
                    : <Link className="btn btn-s" href={`/trilha/${trackId}`}>Voltar à trilha</Link>}
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="qz-prog">
              <div className="bar" role="progressbar" aria-label="Perguntas respondidas" aria-valuemin={0} aria-valuemax={total} aria-valuenow={count}><i style={{ width: `${(count / total) * 100}%` }} /></div>
              <span>{count} de {total} respondidas</span>
            </div>
            <button className="btn btn-p" disabled={!answered || pending}
              onClick={() => run(async () => { const r = await submitQuiz(moduleId, answers); if (r?.tooFast) { setWait(true); setFailed(false); return; } setWait(false); setResult(r); setFailed(!r); })}>
              {pending ? "Corrigindo…" : "Ver resultado"}
            </button>
            {wait && <p className="expl" role="alert">Para evitar envios repetidos, há um intervalo de 20 segundos entre as tentativas. Espere um pouco e clique em “Ver resultado” de novo.</p>}
            {failed && <p className="err" role="alert">Não foi possível corrigir o quiz. Verifique sua conexão e envie de novo.</p>}
          </>
        )}
      </div>
    </>
  );
}
