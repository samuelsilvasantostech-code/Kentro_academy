import type { FormState } from "@/lib/admin/form-state";

/** Resultado da action: sucesso em role=status, erro em role=alert. */
export function FormMessage({ state }: { state: FormState }) {
  if (!state?.message) return null;
  return state.ok ? (
    <p className="ok-msg adm-msg" role="status">{state.message}</p>
  ) : (
    <p className="err adm-msg" role="alert">{state.message}</p>
  );
}
