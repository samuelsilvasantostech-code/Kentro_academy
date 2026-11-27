"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { saveNews } from "../_actions/news";
import type { AdminNews } from "@/lib/admin/queries";
import { Field } from "./field";
import { FormMessage } from "./form-message";
import { SubmitButton } from "./submit-button";

export function NewsForm({ initial }: { initial?: AdminNews }) {
  const [state, action] = useActionState(saveNews, undefined);
  const router = useRouter();
  const err = state?.fieldErrors ?? {};
  const v = (k: string, fallback: string) => state?.values?.[k] ?? fallback;

  useEffect(() => {
    if (!initial && state?.ok) router.push("/admin/novidades");
  }, [initial, state, router]);

  return (
    <form action={action} className="adm-form" noValidate>
      <input type="hidden" name="id" value={initial?.id ?? ""} />
      <Field name="title" label="Título" required defaultValue={v("title", initial?.title ?? "")} error={err.title} />
      <Field name="description" label="Descrição" note="(opcional)" multiline rows={3} defaultValue={v("description", initial?.description ?? "")} error={err.description} />
      <Field
        name="href" label="Link" note="(opcional)" defaultValue={v("href", initial?.href ?? "")} error={err.href}
        hint="Use um link https:// ou um caminho do site, como /trilha/crm. Sem link, a novidade aparece como “Em breve”." placeholder="/trilha/automacao"
      />
      <label className="adm-check">
        <input type="checkbox" name="published" defaultChecked={state?.values ? state.values.published === "on" : (initial?.published ?? true)} />
        <span>Publicada (aparece no Início dos alunos)</span>
      </label>
      <FormMessage state={state} />
      <div className="adm-btns">
        <SubmitButton>{initial ? "Salvar novidade" : "Criar novidade"}</SubmitButton>
      </div>
    </form>
  );
}
