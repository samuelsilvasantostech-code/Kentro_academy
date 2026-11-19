import { useId } from "react";

/**
 * Cristal facetado em SVG (sem JS): fallback do cristal 3D do início e glifo das capas das trilhas.
 * Facetas em tons de roxo com luz vindo do alto à esquerda; `orbit` desenha o anel fino em volta
 * (metade de trás atrás do cristal, metade da frente por cima). Sempre decorativo.
 */
export function CrystalGlyph({ orbit = true, tilt = -14, className }: { orbit?: boolean; tilt?: number; className?: string }) {
  const g = `cg${useId().replace(/:/g, "")}`;
  return (
    <svg className={className} viewBox="0 0 120 120" fill="none" aria-hidden focusable="false">
      <defs>
        <radialGradient id={g} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#8000FF" stopOpacity=".55" />
          <stop offset="1" stopColor="#8000FF" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="60" cy="60" r="54" fill={`url(#${g})`} />
      {orbit && (
        <g transform={`rotate(${tilt} 60 62)`}>
          <path d="M8 62a52 13 0 0 1 104 0" stroke="#C9A8FF" strokeOpacity=".45" strokeWidth="1.4" />
        </g>
      )}
      <g strokeLinejoin="round">
        {/* coroa */}
        <path d="M60 10 38 34h44L60 10z" fill="#C9A8FF" />
        <path d="M60 10 38 34l-14 8 36-32z" fill="#B98AFF" />
        <path d="M60 10l22 24 14 8L60 10z" fill="#8000FF" />
        <path d="M38 34h44l14 8H24l14-8z" fill="#9B4DFF" />
        {/* pavilhão */}
        <path d="M24 42h36l0 68L24 42z" fill="#6A00E0" />
        <path d="M60 42h36L60 110V42z" fill="#350A76" />
        <path d="M44 42h16v68L44 42z" fill="#8000FF" fillOpacity=".55" />
        {/* arestas */}
        <path d="M60 10 24 42l36 68 36-68L60 10zM24 42h72M38 34h44M60 10v100" stroke="#E2CCFF" strokeOpacity=".4" strokeWidth=".9" />
      </g>
      {orbit && (
        <g transform={`rotate(${tilt} 60 62)`}>
          <path d="M112 62a52 13 0 0 1-104 0" stroke="#C9A8FF" strokeOpacity=".7" strokeWidth="1.4" />
          <circle cx="103" cy="69.5" r="2.6" fill="#E2CCFF" />
        </g>
      )}
    </svg>
  );
}
