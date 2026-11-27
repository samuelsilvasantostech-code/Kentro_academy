// Estado devolvido pelas actions do /admin (useActionState). Sem imports do Next: usável no cliente.
// React 19 reseta o <form> depois da action; por isso, em erro devolvemos `values` para repor os campos.
export type FormState =
  | {
      ok?: boolean;
      message?: string;
      fieldErrors?: Record<string, string>;
      values?: Record<string, string>;
      /** Id do registro criado/salvo (ex.: aula nova), para a tela redirecionar ou abrir a edição. */
      id?: string;
    }
  | undefined;

export const GENERIC_ERROR = "Não foi possível concluir agora. Tente de novo em instantes.";

/** Valores em texto do formulário (ignora arquivos e os campos internos "$ACTION_*" do React). */
export function formValues(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string" && !k.startsWith("$")) out[k] = v;
  return out;
}

export const fail = (message: string, form?: FormData, fieldErrors?: Record<string, string>): FormState => ({
  ok: false,
  message,
  fieldErrors,
  values: form ? formValues(form) : undefined,
});

export const done = (message: string, id?: string): FormState => ({ ok: true, message, id });

/** Junta erros por campo: `f.get("nome", text(...))` devolve o valor ou registra o erro. */
export function fields() {
  const errors: Record<string, string> = {};
  return {
    errors,
    get<T>(name: string, r: { ok: true; value: T } | { ok: false; error: string }): T | undefined {
      if (r.ok) return r.value;
      errors[name] = r.error;
      return undefined;
    },
    get failed() {
      return Object.keys(errors).length > 0;
    },
  };
}
