"use client";

import { parseYouTubeId } from "@/lib/admin/validate";

/** Prévia instantânea: iframe youtube-nocookie quando o link é válido. */
export function YoutubePreview({ value }: { value: string }) {
  const v = value.trim();
  if (!v) return null;
  const r = parseYouTubeId(v);
  if (!r.ok)
    return (
      <p className="adm-fielderr" role="status">
        Link inválido. Cole um link do YouTube ou o ID de 11 caracteres.
      </p>
    );
  return (
    <div className="video adm-pv">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${r.value}`}
        title="Prévia do vídeo da aula"
        loading="lazy"
        allow="encrypted-media; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}
