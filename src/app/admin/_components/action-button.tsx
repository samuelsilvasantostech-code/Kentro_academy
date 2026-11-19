"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { FormState } from "@/lib/admin/form-state";

export const ADMIN_ACTION_EVENT = "kentro:admin-action";

/**
 * Botão nativo que dispara uma server action direta (ex.: deleteX.bind(null, id)).
 * Mostra "…" enquanto roda, avisa erro em role=alert e, se pedido, navega ao concluir.
 */
export function ActionButton({
  run, children, className = "btn btn-s btn-sm", disabled, redirectTo, label, title,
}: {
  run: () => Promise<FormState>;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  redirectTo?: string;
  label?: string;
  title?: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  return (
    <>
      <button
        type="button"
        className={className}
        disabled={disabled || pending}
        aria-label={label}
        title={title}
        onClick={() =>
          start(async () => {
            setError(null);
            // Avisa os formulários da página (ex.: "Aula adicionada") para limparem a mensagem da ação anterior.
            window.dispatchEvent(new Event(ADMIN_ACTION_EVENT));
            const r = await run();
            if (r && r.ok === false) setError(r.message ?? "Não foi possível concluir.");
            else if (redirectTo) router.push(redirectTo);
          })
        }
      >
        {pending ? "…" : children}
      </button>
      {error && <span className="adm-fielderr" role="alert">{error}</span>}
    </>
  );
}
