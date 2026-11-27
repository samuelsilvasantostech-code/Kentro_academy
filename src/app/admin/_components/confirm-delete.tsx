"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { FormState } from "@/lib/admin/form-state";

/** Exclusão com confirmação explícita no próprio painel (sem window.confirm). */
export function ConfirmDelete({
  label, title, warning, run, redirectTo, alternative,
}: {
  label: string;
  title: string;
  warning: React.ReactNode;
  run: () => Promise<FormState>;
  redirectTo?: string;
  /** Alternativa mais segura (ex.: botões "Desvincular do módulo"). */
  alternative?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const id = useId();

  if (!open)
    return (
      <button type="button" className="btn btn-s btn-sm adm-danger" onClick={() => setOpen(true)}>
        {label}
      </button>
    );
  return (
    <div className="adm-confirm" role="group" aria-labelledby={`${id}-t`}>
      <b id={`${id}-t`}>{title}</b>
      <div className="adm-sub">{warning}</div>
      {alternative}
      <label className="adm-check">
        <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} />
        <span>Entendo que a exclusão não pode ser desfeita.</span>
      </label>
      {error && <p className="err" role="alert">{error}</p>}
      <div className="adm-btns">
        <button
          type="button"
          className="btn adm-btn-danger btn-sm"
          disabled={!ok || pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const r = await run();
              if (r && r.ok === false) setError(r.message ?? "Não foi possível excluir. Tente de novo.");
              else if (redirectTo) router.push(redirectTo);
              else setOpen(false);
            })
          }
        >
          {pending ? "Excluindo…" : "Excluir definitivamente"}
        </button>
        <button
          type="button"
          className="btn btn-s btn-sm"
          onClick={() => {
            setOpen(false);
            setOk(false);
            setError(null);
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
