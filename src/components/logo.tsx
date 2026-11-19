import { useId } from "react";

/**
 * Marca da Kentro Academy: cristal lapidado (o mesmo do 3D) atravessado por uma órbita.
 * As facetas usam três tons do roxo da marca para dar volume sem depender de sombra.
 */
export function LogoMark({ size = 34, className }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg className={className ?? "logo-svg"} width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}a`} x1="8" y1="8" x2="22" y2="34" gradientUnits="userSpaceOnUse"><stop stopColor="#B98AFF" /><stop offset="1" stopColor="#8000FF" /></linearGradient>
        <linearGradient id={`${id}b`} x1="32" y1="8" x2="20" y2="34" gradientUnits="userSpaceOnUse"><stop stopColor="#8000FF" /><stop offset="1" stopColor="#3D0A87" /></linearGradient>
      </defs>
      {/* órbita atrás */}
      <path d="M4.5 25.5C2 21 9 14.5 20 11.5s19.5-1.6 16 4" stroke="#B98AFF" strokeOpacity=".45" strokeWidth="1.6" strokeLinecap="round" />
      {/* coroa */}
      <path d="M13 7h14l6 8H7z" fill="#E2CCFF" />
      <path d="M13 7l4 8h6l4-8z" fill="#C9A8FF" />
      {/* pavilhão */}
      <path d="M7 15h10l3 20z" fill={`url(#${id}a)`} />
      <path d="M17 15h6l-3 20z" fill="#A55BFF" />
      <path d="M23 15h10L20 35z" fill={`url(#${id}b)`} />
      {/* órbita na frente */}
      <path d="M36 15.5C33.5 21 24 26.5 13 28.5 7.5 29.5 5 28 4.5 25.5" stroke="#E2CCFF" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="36" cy="15.5" r="2.2" fill="#fff" />
    </svg>
  );
}

/** Marca + nome. "Kentro" em destaque e "Academy" em versalete mono, como assinatura de produto. */
export function Logo({ tag, size = 34 }: { tag?: string; size?: number }) {
  return (
    <>
      <LogoMark size={size} />
      <span className="logo-tx">
        <span className="logo-k">Kentro</span>
        <span className="logo-a">Academy{tag && <span className="adm-tag">{tag}</span>}</span>
      </span>
    </>
  );
}
