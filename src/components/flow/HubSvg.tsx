import { PALCO, SINAL, VIOLETA } from "./model";

const sinal = `var(--sinal, ${SINAL})`;
const violeta = `var(--violeta, ${VIOLETA})`;
const traco = { fill: "none", stroke: "#a99cff", strokeWidth: 3, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** Ilustração estática do hub (fallback do HubStage): núcleo Kentro e cinco canais abstratos. */
export function HubSvg({ className }: { className?: string }) {
  const R = 230;
  const pos = Array.from({ length: 5 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
    return { x: 400 + Math.cos(a) * R * 1.25, y: 260 + Math.sin(a) * R * 0.78 };
  });
  return (
    <svg className={className} viewBox="60 40 680 440" preserveAspectRatio="xMidYMid meet" aria-hidden style={{ display: "block", width: "100%", height: "100%", background: `var(--palco, ${PALCO})` }}>
      <defs>
        <radialGradient id="hub-glow">
          <stop offset="0" stopColor="#6D28F5" stopOpacity=".55" />
          <stop offset="1" stopColor="#6D28F5" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="400" cy="260" r="190" fill="url(#hub-glow)" />
      <ellipse cx="400" cy="260" rx={R * 1.25} ry={R * 0.78} fill="none" stroke="#a68bff" strokeOpacity=".4" strokeWidth="2" />
      {pos.map((p, i) => (
        <g key={i}>
          <line x1={p.x} y1={p.y} x2="400" y2="260" style={{ stroke: sinal, strokeOpacity: 0.55, strokeWidth: 3, strokeDasharray: "2 12", strokeLinecap: "round" }} />
          <rect x={p.x + (400 - p.x) * 0.45 - 11} y={p.y + (260 - p.y) * 0.45 - 5} width="22" height="10" rx="5" style={{ fill: sinal }} transform={`rotate(${(Math.atan2(260 - p.y, 400 - p.x) * 180) / Math.PI} ${p.x + (400 - p.x) * 0.45} ${p.y + (260 - p.y) * 0.45})`} />
          <g transform={`translate(${p.x} ${p.y})`}>
            <circle r="38" style={{ fill: PALCO, stroke: "#a99cff", strokeOpacity: 0.35, strokeWidth: 2 }} />
            {i === 0 && <path d="M-16-10h32v20h-18l-8 8v-8h-6z" style={traco} />}
            {i === 1 && (
              <g style={traco}>
                <circle r="16" />
                <ellipse rx="7" ry="16" />
                <path d="M-16 0h32" />
              </g>
            )}
            {i === 2 && <path d="M-18-12h36v24h-36zM-18-12l18 14l18-14" style={traco} />}
            {i === 3 && (
              <g style={traco}>
                <circle r="7" />
                <path d="M0-18v6M0 12v6M-18 0h6M12 0h6M-12.7-12.7l4.2 4.2M8.5 8.5l4.2 4.2M12.7-12.7l-4.2 4.2M-8.5 8.5l-4.2 4.2" />
              </g>
            )}
            {i === 4 && (
              <g style={traco}>
                <circle cx="-14" cy="8" r="4" />
                <circle cx="0" cy="-10" r="4" />
                <circle cx="14" cy="6" r="4" />
                <path d="M-11-6l8-2M3-7l8 9" />
              </g>
            )}
          </g>
        </g>
      ))}
      <circle cx="400" cy="260" r="72" style={{ fill: violeta }} />
      <circle cx="400" cy="260" r="96" fill="none" stroke="#a68bff" strokeOpacity=".4" strokeWidth="2" strokeDasharray="4 8" />
      <path d="M382 238v44M382 260l30-22M388 258l26 24" fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
