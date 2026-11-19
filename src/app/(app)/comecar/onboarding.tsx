"use client";

import { useState, useTransition } from "react";
import { Ico, type IcoName } from "@/components/ico";
import { minutes } from "@/lib/format";
import { finishOnboarding } from "../actions";

type Plan = { name: string; color: string; outcomes: string[]; total: number; seconds: number };
type Role = { k: string; t: string; s: string };

const ROLE_ICON: Record<string, IcoName> = { atendente: "headset", gestor: "chart", implantacao: "sliders", automacao: "flow" };
const TEMPO: [string, IcoName, string][] = [["novo", "nivel1", "Estou começando agora"], ["meses", "nivel2", "Uso há alguns meses"], ["exp", "nivel3", "Uso há mais de um ano"]];

export function Onboarding({ roles, plans }: { roles: Role[]; plans: Record<string, Plan> }) {
  const [step, setStep] = useState(0);
  const [role, setRole] = useState<string | null>(null);
  const [tempo, setTempo] = useState<string | null>(null);
  const [pending, run] = useTransition();
  const head = (
    <>
      <p className="step-n">Passo {step + 1} de 3</p>
      <div className="steps" aria-hidden="true">{[0, 1, 2].map((i) => <i key={i} className={i <= step ? "on" : ""} />)}</div>
    </>
  );

  if (step === 0) return (
    <div className="center">{head}
      <h1 id="q-papel">Qual é o seu papel no Kentro?</h1>
      <p className="muted" style={{ marginTop: 6 }}>Vamos montar um caminho de aprendizado só com o que importa para você.</p>
      <div className="opts" role="radiogroup" aria-labelledby="q-papel">
        {roles.map((r) => (
          <label key={r.k} className="qopt qopt-big">
            <input type="radio" name="papel" checked={role === r.k} onChange={() => setRole(r.k)} />
            <span className="qopt-ico" aria-hidden="true"><Ico name={ROLE_ICON[r.k] ?? "flow"} size={22} /></span>
            <span className="qopt-t"><b>{r.t}</b><small>{r.s}</small></span>
          </label>
        ))}
      </div>
      <button className="btn btn-p" disabled={!role} onClick={() => setStep(1)}>Continuar<Ico name="arrowR" /></button>
    </div>
  );

  if (step === 1) return (
    <div className="center">{head}
      <h1 id="q-tempo">Há quanto tempo você usa o Kentro?</h1>
      <div className="opts" role="radiogroup" aria-labelledby="q-tempo">
        {TEMPO.map(([k, ic, t]) => (
          <label key={k} className="qopt qopt-big">
            <input type="radio" name="tempo" checked={tempo === k} onChange={() => setTempo(k)} />
            <span className="qopt-ico" aria-hidden="true"><Ico name={ic} size={22} /></span>
            <span className="qopt-t"><b>{t}</b></span>
          </label>
        ))}
      </div>
      <div className="btn-row">
        <button className="btn btn-s" onClick={() => setStep(0)}><Ico name="arrowL" />Voltar</button>
        <button className="btn btn-p" disabled={!tempo} onClick={() => setStep(2)}>Continuar<Ico name="arrowR" /></button>
      </div>
    </div>
  );

  const t = plans[role!];
  return (
    <div className="center">{head}
      <h1>Seu plano está pronto: comece por <mark className="plan-mark" style={{ "--tc": t.color } as React.CSSProperties}>{t.name}</mark></h1>
      <div className="meta plan-meta">
        <span><Ico name="book" size={16} />{t.total} aulas curtas</span>
        <span><Ico name="clock" size={16} />{minutes(t.seconds)} no total</span>
        <span><Ico name="award" size={16} />Certificado ao final</span>
      </div>
      <div className="side-box plan-box">
        <h2>Ao final você vai conseguir</h2>
        <ul className="outc">{t.outcomes.map((o) => <li key={o}>{o}</li>)}</ul>
        <p className="plan-tip"><Ico name="bulb" size={16} />Com 15 minutos por dia, você conclui em cerca de {Math.max(1, Math.ceil(t.seconds / 60 / 15))} dias.</p>
      </div>
      <div className="btn-row">
        <button className="btn btn-p" disabled={pending} onClick={() => run(() => finishOnboarding(role!, tempo!))}>{pending ? "Preparando…" : <>Começar minha trilha<Ico name="arrowR" /></>}</button>
        <button className="btn btn-s" onClick={() => setStep(0)}>Refazer escolhas</button>
      </div>
    </div>
  );
}
