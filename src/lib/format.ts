export const mmss = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export const duration = (s: number) => (s ? mmss(s) : "sem vídeo");

export const minutes = (s: number) => {
  const m = Math.round(s / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}` : `${m} min`;
};

export const thumb = (youtubeId: string | null) =>
  youtubeId ? `https://i.ytimg.com/vi/${youtubeId}/mqdefault.jpg` : null;

export const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";

export const normalize = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export const firstName = (name: string) => name.trim().split(/\s+/)[0] || "";
