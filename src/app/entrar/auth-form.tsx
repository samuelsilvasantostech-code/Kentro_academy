"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn } from "./actions";

/**
 * Só login por enquanto: o cadastro pela tela de entrar está fechado (pedido do dono em 23/11/2026).
 * A ação `signUp` continua em actions.ts para reabrir depois.
 */
export function AuthForm({ linkError = false }: { linkError?: boolean }) {
  const [state, action, pending] = useActionState(signIn, undefined);

  return (
    <form action={action}>
      <div>
        <h1>Entre na Kentro Academy</h1>
        <p className="kauth-sub">Use o e-mail e a senha da sua conta para continuar de onde parou.</p>
      </div>
      <label className="field">E-mail<input className="input" type="email" name="email" autoComplete="email" placeholder="voce@empresa.com.br" required /></label>
      <label className="field">
        Senha
        <input className="input" type="password" name="password" autoComplete="current-password" required />
      </label>
      <Link href="/entrar/esqueci" className="kauth-link">Esqueci a senha</Link>
      {linkError && !state && (
        <p className="err" role="alert">Este link expirou ou já foi usado. <Link href="/entrar/esqueci" style={{ textDecoration: "underline" }}>Pedir um novo link</Link></p>
      )}
      {state?.error && <p className="err" role="alert">{state.error}</p>}
      {state?.info && <p className="ok-msg" role="status">{state.info}</p>}
      <button className="btn btn-p" disabled={pending}>
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
