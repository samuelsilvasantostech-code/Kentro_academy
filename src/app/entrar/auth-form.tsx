"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { signIn, signUp } from "./actions";

export function AuthForm({ linkError = false }: { linkError?: boolean }) {
  const [mode, setMode] = useState<"entrar" | "criar">("entrar");
  const [inState, inAction, inPending] = useActionState(signIn, undefined);
  const [upState, upAction, upPending] = useActionState(signUp, undefined);
  const state = mode === "entrar" ? inState : upState;
  const pending = mode === "entrar" ? inPending : upPending;

  return (
    <form action={mode === "entrar" ? inAction : upAction} key={mode}>
      <div>
        <h2 className="klogin-h">{mode === "entrar" ? "Bem-vindo de volta" : "Crie sua conta"}</h2>
        <p className="muted" style={{ marginTop: 6 }}>
          {mode === "entrar" ? "Entre para continuar de onde parou." : "Leva 1 minuto. Seu progresso fica salvo em qualquer computador."}
        </p>
      </div>
      <div className="switch" role="tablist">
        <button type="button" role="tab" aria-selected={mode === "entrar"} className={mode === "entrar" ? "on" : ""} onClick={() => setMode("entrar")}>Entrar</button>
        <button type="button" role="tab" aria-selected={mode === "criar"} className={mode === "criar" ? "on" : ""} onClick={() => setMode("criar")}>Criar conta</button>
      </div>
      {mode === "criar" && (
        <>
          <label className="field">Seu nome<input className="input" name="full_name" autoComplete="name" required /></label>
          <label className="field">Empresa <span className="dim" style={{ fontWeight: 400 }}>(opcional)</span><input className="input" name="company" autoComplete="organization" /></label>
        </>
      )}
      <label className="field">E-mail<input className="input" type="email" name="email" autoComplete="email" placeholder="seuemail@empresa.com.br" required /></label>
      <label className="field">
        Senha
        <input className="input" type="password" name="password" minLength={mode === "criar" ? 8 : undefined}
          autoComplete={mode === "entrar" ? "current-password" : "new-password"} required />
        {mode === "criar" && <span className="dim" style={{ fontWeight: 400, fontSize: 13 }}>Pelo menos 8 caracteres.</span>}
      </label>
      {mode === "entrar" && <Link href="/entrar/esqueci" className="dim" style={{ fontSize: 13, justifySelf: "end", marginTop: -6 }}>Esqueci a senha</Link>}
      {linkError && !state && (
        <p className="err" role="alert">Link inválido ou vencido. Peça outro. <Link href="/entrar/esqueci" style={{ textDecoration: "underline" }}>Pedir novo link</Link></p>
      )}
      {state?.error && <p className="err" role="alert">{state.error}</p>}
      {state?.info && <p className="ok-msg" role="status">{state.info}</p>}
      <button className="btn btn-p" style={{ justifyContent: "center" }} disabled={pending}>
        {pending ? "Aguarde…" : mode === "entrar" ? "Entrar" : "Criar conta"}
      </button>
    </form>
  );
}
