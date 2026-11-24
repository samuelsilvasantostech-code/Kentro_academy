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
        <p className="kauth-sub">Informe o e-mail da sua conta e enviamos um link para criar uma nova.</p>
      </div>
      <label className="field">E-mail<input className="input" type="email" name="email" autoComplete="email" required /></label>
      {state?.error && <p className="err" role="alert">{state.error}</p>}
      {state?.info && <p className="ok-msg" role="status">{state.info}</p>}
      <button className="btn btn-p" disabled={pending}>{pending ? "Enviando…" : "Enviar link"}</button>
      <Link href="/entrar" className="kauth-back"><Ico name="arrowL" size={16} />Voltar para entrar</Link>
    </form>
  );
}
