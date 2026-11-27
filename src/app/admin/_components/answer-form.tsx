"use client";

import { useActionState } from "react";
import { answerQuestion } from "../_actions/questions";
import { Field } from "./field";
import { FormMessage } from "./form-message";
import { SubmitButton } from "./submit-button";

export function AnswerForm({ id, answer }: { id: string; answer?: string | null }) {
  const [state, action] = useActionState(answerQuestion, undefined);
  return (
    <form action={action} className="adm-form" noValidate>
      <input type="hidden" name="id" value={id} />
      <Field
        name="answer" label={answer ? "Resposta enviada (você pode editar)" : "Sua resposta"} multiline rows={3} required
        defaultValue={state?.values?.answer ?? answer ?? ""} error={state?.fieldErrors?.answer}
      />
      <FormMessage state={state} />
      <div className="adm-btns">
        <SubmitButton className="btn btn-p btn-sm" pendingText="Enviando…">{answer ? "Salvar resposta" : "Enviar resposta"}</SubmitButton>
      </div>
    </form>
  );
}
