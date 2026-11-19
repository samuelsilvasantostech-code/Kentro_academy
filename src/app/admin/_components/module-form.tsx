"use client";

import { useActionState } from "react";
import { saveModule } from "../_actions/modules";
import { Field } from "./field";
import { FormMessage } from "./form-message";
import { SubmitButton } from "./submit-button";

/** Criar (trackId) ou renomear (module) um módulo, em uma linha. */
export function ModuleForm({ trackId, module }: { trackId?: string; module?: { id: string; title: string } }) {
  const [state, action] = useActionState(saveModule, undefined);
  const err = state?.fieldErrors ?? {};
  return (
    <form action={action} className="adm-form" noValidate>
      <input type="hidden" name="id" value={module?.id ?? ""} />
      {!module && <input type="hidden" name="track_id" value={trackId ?? ""} />}
      <div className="adm-btns" style={{ alignItems: "flex-end" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <Field
            name="title" label={module ? "Nome do módulo" : "Novo módulo"} required
            defaultValue={state?.values?.title ?? module?.title ?? ""} error={err.title ?? err.track_id}
            placeholder={module ? undefined : "Ex.: Primeiros passos"}
          />
        </div>
        <SubmitButton className="btn btn-s btn-sm">{module ? "Renomear" : "Adicionar módulo"}</SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
