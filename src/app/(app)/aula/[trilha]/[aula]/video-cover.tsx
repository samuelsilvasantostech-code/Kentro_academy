"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Ico } from "@/components/ico";
import { duration, mmss } from "@/lib/format";
import { readPosition, subscribePosition, writePosition } from "@/lib/video-position";
import { topicIcon } from "@/lib/topic";

/**
 * Capa da aula: assunto, módulo e duração, com ícone do tema e botão de play.
 * O player do YouTube só é carregado depois do clique (página mais leve).
 * Retomada: o player avisa o tempo atual por postMessage (enablejsapi); guardamos neste navegador
 * e, na próxima visita, a capa oferece continuar de onde parou.
 */
const YT_ORIGIN = "https://www.youtube-nocookie.com";
export function VideoCover({ youtubeId, title, moduleTitle, trackName, position, seconds, start, playing, onPlay }: {
  youtubeId: string;
  title: string;
  moduleTitle: string;
  trackName: string;
  position: { index: number; total: number };
  seconds: number;
  start: number;
  playing: boolean;
  onPlay: () => void;
}) {
  const saved = useSyncExternalStore(subscribePosition, () => readPosition(youtubeId), () => 0);
  // Posição escolhida no clique; fica fixa enquanto o vídeo toca (o iframe não recarrega a cada gravação).
  const [from, setFrom] = useState(0);
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!playing) return;
    let last = 0;
    let heard = false;
    // O player pode ainda não estar pronto no onLoad: repete o pedido até ele responder (no máximo 10 s).
    let tries = 0;
    const ping = setInterval(() => {
      if (heard || ++tries > 10) return clearInterval(ping);
      frame.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: youtubeId, channel: "widget" }), YT_ORIGIN);
    }, 1000);
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== YT_ORIGIN || e.source !== frame.current?.contentWindow || typeof e.data !== "string") return;
      heard = true;
      try {
        const d = JSON.parse(e.data) as { event?: string; info?: { currentTime?: number; duration?: number } };
        const t = d.info?.currentTime;
        if (d.event !== "infoDelivery" || typeof t !== "number") return;
        // Grava no máximo a cada 5 s de vídeo (e sempre ao voltar para trás).
        if (Math.abs(t - last) < 5) return;
        last = t;
        writePosition(youtubeId, t, d.info?.duration || seconds);
      } catch {
        /* mensagem que não é do player */
      }
    };
    window.addEventListener("message", onMsg);
    return () => { clearInterval(ping); window.removeEventListener("message", onMsg); };
  }, [playing, youtubeId, seconds]);

  if (playing) {
    const at = start || from;
    return (
      <div className="video">
        <iframe
          ref={frame}
          key={at}
          src={`${YT_ORIGIN}/embed/${youtubeId}?rel=0&modestbranding=1&autoplay=1&enablejsapi=1&origin=${encodeURIComponent(location.origin)}${at ? `&start=${at}` : ""}`}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          title={title}
          // Pede ao player que passe a enviar o tempo atual.
          onLoad={(e) => e.currentTarget.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: youtubeId, channel: "widget" }), YT_ORIGIN)}
        />
      </div>
    );
  }
  const play = () => { setFrom(saved); onPlay(); };
  return (
    <div className="video">
      <button type="button" className="vcover" onClick={play} aria-label={saved ? `Continuar a aula de ${mmss(saved)}: ${title}` : `Assistir à aula: ${title}`}>
        <svg className="vc-flow" viewBox="0 0 400 120" aria-hidden="true" preserveAspectRatio="xMaxYMax meet">
          <path d="M10 90 C 70 90, 70 30, 130 30 S 190 90, 250 90 S 310 30, 370 30" />
          {[10, 130, 250, 370].map((x, i) => <circle key={x} cx={x} cy={i % 2 ? 30 : 90} r={i === 3 ? 9 : 6} />)}
        </svg>
        <span className="vc-top">
          <span className="vc-ico"><Ico name={topicIcon(title, moduleTitle)} size={22} /></span>
          <span className="vc-mod">{moduleTitle}</span>
        </span>
        <span className="vc-title">{title}</span>
        <span className="vc-foot">
          <span className="vc-play"><Ico name="play" size={22} /></span>
          <span className="vc-meta">
            <b>{saved ? `Continuar de ${mmss(saved)}` : "Assistir à aula"}</b>
            <span className="vc-sub"><span>{trackName}</span><span>Aula {position.index} de {position.total}</span>{seconds > 0 && <span>{duration(seconds)}</span>}</span>
          </span>
        </span>
      </button>
    </div>
  );
}
