import type { SVGProps } from "react";

/* Ícones de traço (24x24, currentColor) usados nas telas de estudo, certificado, erros e admin.
   Sempre decorativos (aria-hidden): o texto ao lado diz o que é. */
const PATHS = {
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  wrench: <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />,
  file: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>,
  ext: <><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></>,
  arrowL: <path d="M19 12H5M11 6l-6 6 6 6" />,
  arrowR: <path d="M5 12h14M13 6l6 6-6 6" />,
  print: <><path d="M7 9V4h10v5" /><path d="M7 17H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2" /><path d="M7 14h10v6H7z" /></>,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  pen: <path d="M4 20l4-1L19 8a2.1 2.1 0 0 0-3-3L5 16zM14 7l3 3" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
  award: <><circle cx="12" cy="9" r="6" /><path d="M8.5 14.5L7 21l5-3 5 3-1.5-6.5" /></>,
  headset: <><path d="M4 14v-2a8 8 0 0 1 16 0v2" /><path d="M4 13h3v6H5a1 1 0 0 1-1-1zM20 13h-3v6h2a1 1 0 0 0 1-1z" /></>,
  chart: <path d="M5 20V10M12 20V4M19 20v-7" />,
  sliders: <><path d="M4 7h8M18 7h2M4 17h2M12 17h8" /><circle cx="15" cy="7" r="2.5" /><circle cx="9" cy="17" r="2.5" /></>,
  flow: <><circle cx="5" cy="12" r="2.5" /><path d="M7.5 12h3" /><rect x="10.5" y="9" width="6" height="6" rx="1" transform="rotate(45 13.5 12)" /><path d="M18 12h2" /></>,
  bulb: <><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" /></>,
  refresh: <path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6" />,
  book: <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11" />,
  layers: <path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5" />,
  video: <><path d="M4 6h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" /><path d="M16 10l6-3v10l-6-3" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01" /></>,
  alert: <><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5M12 16h.01" /></>,
  up: <path d="M12 19V5M6 11l6-6 6 6" />,
  down: <path d="M12 5v14M6 13l6 6 6-6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  chat: <path d="M4 5h16v11H9l-5 4z" />,
  tag: <><path d="M3 12V4h8l10 10-8 8z" /><circle cx="7.5" cy="8.5" r="1.5" /></>,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  play: <path d="M8 5.5v13l11-6.5z" fill="currentColor" />,
  home: <path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z" />,
  nivel1: <><path d="M6 20v-5" /><path d="M12 20v-9M18 20V5" opacity=".3" /></>,
  nivel2: <><path d="M6 20v-5M12 20v-9" /><path d="M18 20V5" opacity=".3" /></>,
  nivel3: <path d="M6 20v-5M12 20v-9M18 20V5" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 20c1-4 4-6 8-6s7 2 8 6" /></>,
  inbox: <><path d="M4 13l2.5-7h11L20 13v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" /><path d="M4 13h4.5l1 2h5l1-2H20" /></>,
  eye: <><path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z" /><circle cx="12" cy="12" r="3" /></>,
  sleep: <><circle cx="12" cy="12" r="9" /><path d="M9 10h3l-3 4h3M14 8h2l-2 2.5h2" /></>,
} as const;

export type IcoName = keyof typeof PATHS;

export function Ico({ name, size = 18, ...rest }: { name: IcoName; size?: number } & Omit<SVGProps<SVGSVGElement>, "name">) {
  return (
    <svg className="ico" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>
      {PATHS[name]}
    </svg>
  );
}
