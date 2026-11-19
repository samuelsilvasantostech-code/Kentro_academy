"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children, pendingText = "Salvando…", className = "btn btn-p", disabled,
}: { children: React.ReactNode; pendingText?: string; className?: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending || disabled}>
      {pending ? pendingText : children}
    </button>
  );
}
