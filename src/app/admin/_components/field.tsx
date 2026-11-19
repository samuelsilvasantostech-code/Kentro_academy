import { useId } from "react";

type Common = {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  /** Texto extra ao lado do rótulo (ex.: "(opcional)"). */
  note?: string;
};
type InputProps = Common & { multiline?: false } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "name">;
type AreaProps = Common & { multiline: true } & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "name">;

/** Campo com rótulo, dica e erro ligados por aria-describedby / aria-invalid. */
export function Field(props: InputProps | AreaProps) {
  const uid = useId();
  const { name, label, hint, error, note, multiline, ...rest } = props;
  const id = `${uid}-f`;
  const describedBy = [hint ? `${id}-h` : "", error ? `${id}-e` : ""].filter(Boolean).join(" ") || undefined;
  const shared = { id, name, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy };
  return (
    <div className="adm-field">
      <label htmlFor={id}>
        {label}
        {note && <span className="dim" style={{ fontWeight: 400 }}> {note}</span>}
      </label>
      {multiline ? (
        <textarea {...(rest as React.TextareaHTMLAttributes<HTMLTextAreaElement>)} {...shared} />
      ) : (
        <input className="input" {...(rest as React.InputHTMLAttributes<HTMLInputElement>)} {...shared} />
      )}
      {hint && <p className="adm-hint" id={`${id}-h`}>{hint}</p>}
      {error && <p className="adm-fielderr" id={`${id}-e`}>{error}</p>}
    </div>
  );
}

/** Select com o mesmo contrato do Field. */
export function SelectField({
  name, label, hint, error, children, ...rest
}: Common & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "name">) {
  const uid = useId();
  const id = `${uid}-f`;
  const describedBy = [hint ? `${id}-h` : "", error ? `${id}-e` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className="adm-field">
      <label htmlFor={id}>{label}</label>
      <select className="input" {...rest} id={id} name={name} aria-invalid={error ? true : undefined} aria-describedby={describedBy}>
        {children}
      </select>
      {hint && <p className="adm-hint" id={`${id}-h`}>{hint}</p>}
      {error && <p className="adm-fielderr" id={`${id}-e`}>{error}</p>}
    </div>
  );
}
