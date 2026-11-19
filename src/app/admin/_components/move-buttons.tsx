import { ActionButton } from "./action-button";
import type { FormState } from "@/lib/admin/form-state";
import { Ico } from "@/components/ico";

/** Botões de subir e descer com rótulo acessível ("Mover módulo X para cima"); desabilitados nos extremos. */
export function MoveButtons({
  what, name, up, down, first, last,
}: {
  what: string;
  name: string;
  up: () => Promise<FormState>;
  down: () => Promise<FormState>;
  first: boolean;
  last: boolean;
}) {
  return (
    <>
      <ActionButton className="adm-icon" run={up} disabled={first} label={`Mover ${what} ${name} para cima`} title="Para cima"><Ico name="up" size={16} /></ActionButton>
      <ActionButton className="adm-icon" run={down} disabled={last} label={`Mover ${what} ${name} para baixo`} title="Para baixo"><Ico name="down" size={16} /></ActionButton>
    </>
  );
}
