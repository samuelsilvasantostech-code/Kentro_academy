import { useId } from "react";

/** Medalha roxa com o cristal ao centro, em SVG. */
function SealGlyph({ className }: { className?: string }) {
  const g = `sg${useId().replace(/:/g, "")}`;
  const studs = Array.from({ length: 24 }, (_, i) => {
    const a = (i / 24) * Math.PI * 2;
    return [60 + Math.cos(a) * 45.5, 60 + Math.sin(a) * 45.5];
  });
  return (
    <svg className={className} viewBox="0 0 120 120" fill="none" aria-hidden focusable="false">
      <defs>
        <radialGradient id={`${g}a`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#8000FF" stopOpacity=".5" />
          <stop offset="1" stopColor="#8000FF" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${g}b`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9440FF" />
          <stop offset="1" stopColor="#4A0FA8" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="58" fill={`url(#${g}a)`} />
      <circle cx="60" cy="60" r="52" fill={`url(#${g}b)`} />
      <circle cx="60" cy="60" r="52" stroke="#C9A8FF" strokeOpacity=".5" />
      {studs.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.5" fill="#E2CCFF" fillOpacity=".8" />)}
      <circle cx="60" cy="60" r="36" stroke="#E2CCFF" strokeOpacity=".5" />
      <g transform="translate(60 61) scale(.5) translate(-60 -60)" strokeLinejoin="round">
        <path d="M60 10 38 34h44L60 10z" fill="#E2CCFF" />
        <path d="M60 10 38 34l-14 8 36-32z" fill="#C9A8FF" />
        <path d="M60 10l22 24 14 8L60 10z" fill="#9B4DFF" />
        <path d="M38 34h44l14 8H24l14-8z" fill="#B98AFF" />
        <path d="M24 42h36l0 68L24 42z" fill="#9440FF" />
        <path d="M60 42h36L60 110V42z" fill="#6A00E0" />
        <path d="M60 10 24 42l36 68 36-68L60 10zM24 42h72" stroke="#F5F3FF" strokeOpacity=".5" strokeWidth="1.2" />
      </g>
    </svg>
  );
}

/** Selo de conquista no topo do certificado (SVG puro, renderizado no servidor). */
export function CertSeal() {
  return <div className="kseal" aria-hidden><SealGlyph className="kseal-svg" /></div>;
}
