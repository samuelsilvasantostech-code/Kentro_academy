"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { updatePassword } from "./actions";

export function NewPasswordForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState(updatePassword, undefined);
  useEffect(() => {
    if (!state?.ok) return;
    const t = setTimeout(() => router.replace("/"), 1800);
    return () => clearTimeout(t);
  }, [state, router]);

  return (
    <form action={action} className="auth-card">
      <div>
        <h1>Crie uma nova senha</h1>
        <p className="muted" style={{ marginTop: 6 }}>Escolha uma senha com pelo menos 8 caracteres.</p>
      </div>
      <label className="field">Nova senha<input className="input" type="password" name="password" maxLength={72} autoComplete="new-password" required /></label>
      <label className="field">Repita a nova senha<input className="input" type="password" name="confirm" maxLength={72} autoComplete="new-password" required /></label>
      {state?.error && <p className="err" role="alert">{state.error}</p>}
      {state?.ok && <p className="ok-msg" role="status">Senha alterada. Levando você para o Início…</p>}
      <button className="btn btn-p" disabled={pending || state?.ok}>{pending ? "Salvando…" : "Salvar nova senha"}</button>
      {state?.ok && <Link href="/" className="auth-back">Ir para o Início agora</Link>}
    </form>
  );
}
