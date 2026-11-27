"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { saveTrack } from "../_actions/tracks";
import type { AdminTrack } from "@/lib/db/admin";
import { Field } from "./field";
import { FormMessage } from "./form-message";
import { SubmitButton } from "./submit-button";

type Initial = Pick<AdminTrack, "id" | "name" | "audience" | "icon" | "color" | "pitch" | "outcomes" | "published">;

export function TrackForm({ initial }: { initial?: Initial }) {
  const [state, action] = useActionState(saveTrack, undefined);
  const router = useRouter();
  const editing = !!initial;
  const err = state?.fieldErrors ?? {};
  const v = (k: string, fallback: string) => state?.values?.[k] ?? fallback;

  useEffect(() => {
    if (!editing && state?.ok && state.id) router.push(`/admin/trilhas/${state.id}`);
  }, [editing, state, router]);

  return (
    <form action={action} className="adm-form" noValidate>
      <input type="hidden" name="original_id" value={initial?.id ?? ""} />
      <div className="adm-2">
        <Field name="name" label="Nome da trilha" defaultValue={v("name", initial?.name ?? "")} error={err.name} required />
        {editing ? (
          <Field name="id" label="Endereço (slug)" value={initial.id} readOnly hint="Não pode ser alterado depois que a trilha é criada." />
        ) : (
          <Field
            name="id" label="Endereço (slug)" defaultValue={v("id", "")} error={err.id}
            hint="Aparece no link. Ex.: gestao-da-operacao" placeholder="minha-trilha" required
          />
        )}
      </div>
      <Field name="audience" label="Para quem é" defaultValue={v("audience", initial?.audience ?? "")} error={err.audience} placeholder="Ex.: Agentes de atendimento" />
      <div className="adm-2">
        <Field name="icon" label="Ícone (emoji)" defaultValue={v("icon", initial?.icon ?? "📚")} error={err.icon} maxLength={16} required />
        <Field name="color" label="Cor" type="color" defaultValue={v("color", initial?.color ?? "#6D28F5")} error={err.color} style={{ height: 46, padding: 4 }} />
      </div>
      <Field name="pitch" label="Resumo" multiline rows={3} defaultValue={v("pitch", initial?.pitch ?? "")} error={err.pitch} hint="Uma ou duas frases sobre o que o aluno ganha com a trilha." />
      <Field
        name="outcomes" label="O que o aluno aprende" multiline rows={5}
        defaultValue={v("outcomes", initial?.outcomes.join("\n") ?? "")} error={err.outcomes}
        hint="Um resultado por linha." placeholder={"Responder mais rápido com mensagens prontas\nOrganizar conversas com etiquetas"}
      />
      <label className="adm-check">
        <input type="checkbox" name="published" defaultChecked={state?.values ? state.values.published === "on" : (initial?.published ?? false)} />
        <span>Publicada (visível para os alunos)</span>
      </label>
      <FormMessage state={state} />
      <div className="adm-btns">
        <SubmitButton>{editing ? "Salvar trilha" : "Criar trilha"}</SubmitButton>
      </div>
    </form>
  );
}
