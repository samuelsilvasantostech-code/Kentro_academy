import { bubbleSvgLines, bubbleSvgPath } from "./bubble-shape";

/** Balão da logo em SVG: versão estática do herói (sem WebGL, menos movimento ou antes do 3D carregar). */
export function BubbleGlyph({ className, lit = 1 }: { className?: string; lit?: number }) {
  return (
    <svg className={className} viewBox="-1.3 -1.3 2.6 2.6" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="kb-glow"><stop stopColor="#8000FF" stopOpacity=".55" /><stop offset="1" stopColor="#8000FF" stopOpacity="0" /></radialGradient>
        <linearGradient id="kb-ring" x1="-1" y1="-1" x2="1" y2="1" gradientUnits="userSpaceOnUse"><stop stopColor="#8DFFD6" /><stop offset=".55" stopColor="#2CF8B0" /><stop offset="1" stopColor="#12A877" /></linearGradient>
      </defs>
      <circle className="kb-glow" r="1.3" fill="url(#kb-glow)" />
      <g className="kb-body"><circle r={0.72} fill="#1A0838" opacity=".85" />
      <path d={bubbleSvgPath()} fill="url(#kb-ring)" fillRule="evenodd" />
      {bubbleSvgLines().map((l, i) => (
        <rect key={i} className="kb-line" style={{ "--d": `${i * 0.6}s` } as React.CSSProperties} x={l.x} y={l.y} width={l.w} height={l.h} rx={l.r} fill={i < lit ? "#2CF8B0" : "#B98AFF"} opacity={i < lit ? 1 : 0.55} />
      ))}</g>
    </svg>
  );
}
