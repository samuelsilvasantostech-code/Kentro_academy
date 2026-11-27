"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Ico } from "@/components/ico";
import { requestReset } from "../actions";

export function ResetRequestForm() {
  const [state, action, pending] = useActionState(requestReset, undefined);
  return (
    <form action={action}>
      <div>
        <h1>Esqueceu a senha?</h1>
        <p className="kauth-sub">Digite o e-mail da sua conta. Vamos enviar um link para você criar uma nova senha.</p>
      </div>
      <label className="field">E-mail<input className="input" type="email" name="email" autoComplete="email" required /></label>
      {state?.error && <p className="err" role="alert">{state.error}</p>}
      {state?.info && <p className="ok-msg" role="status">{state.info}</p>}
      <button className="btn btn-p" disabled={pending}>{pending ? "Enviando…" : "Enviar link"}</button>
      <Link href="/entrar" className="kauth-back"><Ico name="arrowL" size={16} />Voltar para Entrar</Link>
    </form>
  );
}
