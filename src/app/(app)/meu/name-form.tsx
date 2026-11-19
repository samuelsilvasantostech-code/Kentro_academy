"use client";

import { useActionState, useId } from "react";
import { updateName, type NameState } from "../actions";

/** Nome do aluno, o mesmo que aparece no certificado. */
export function NameForm({ current }: { current: string }) {
  const [state, action, pending] = useActionState<NameState, FormData>(updateName, {});
  const id = useId();
  return (
    <form action={action} className="name-form">
      <label htmlFor={id}>Nome completo</label>
      <div className="name-row">
        <input id={id} className="input" name="full_name" defaultValue={state.name ?? current} required minLength={3} maxLength={80}
          autoComplete="name" aria-describedby={`${id}-msg`} aria-invalid={!!state.error} />
        <button className="btn btn-s" disabled={pending}>{pending ? "Salvando..." : "Salvar"}</button>
      </div>
      <p id={`${id}-msg`} className={state.error ? "name-msg is-err" : "name-msg"} role="status">
        {state.error ?? (state.ok ? "Nome salvo." : "É o nome que aparece nos seus certificados.")}
      </p>
    </form>
  );
}
