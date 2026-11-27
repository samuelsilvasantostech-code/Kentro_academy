import type { Chapter, Material } from "@/lib/admin/validate";

export type AdminLessonRow = {
  id: string;
  youtube_id: string | null;
  title: string;
  duration_seconds: number;
  published: boolean;
  position: number;
};
export type AdminModule = { id: string; title: string; position: number; quizCount: number; lessons: AdminLessonRow[] };
export type AdminTrack = {
  id: string; name: string; audience: string; icon: string; color: string; pitch: string;
  outcomes: string[]; position: number; published: boolean; modules: AdminModule[];
};

export type AdminLessonLink = { moduleId: string; moduleTitle: string; trackId: string; trackName: string };
export type AdminLessonListItem = AdminLessonRow & { created_at: string; links: AdminLessonLink[] };

export type AdminLessonDetail = {
  id: string; youtube_id: string | null; title: string; summary: string | null; duration_seconds: number;
  steps: string[]; published: boolean; chapters: Chapter[]; materials: Material[]; links: AdminLessonLink[];
  /** Pontos-chave (migração 0007; lista vazia enquanto ela não existir). */
  key_points: string[];
  /** Texto da aula (migração 0008; vazio enquanto ela não existir). */
  text: { body: string; published: boolean };
  /** Transcrição só para a busca (migração 0009; vazia enquanto ela não existir). */
  transcript: string;
};

export type AdminQuizQuestion = { id: string; position: number; question: string; options: string[]; correct: number; explanation: string | null; lesson_id?: string | null };

export type AdminQuestion = {
  id: string; body: string; answer: string | null; created_at: string; answered_at: string | null;
  lesson: { id: string; title: string };
  student: { id: string; full_name: string; company: string | null };
};

export type AdminNews = { id: string; title: string; description: string | null; href: string | null; position: number; published: boolean };

/** Campos editáveis de uma trilha (o slug vai à parte). */
export type TrackInput = { name: string; audience: string; icon: string; color: string; pitch: string; outcomes: string[]; published: boolean };
export type NewsInput = { title: string; description: string | null; href: string | null; published: boolean };
export type LessonInput = {
  youtube_id: string | null; title: string; summary: string; duration_seconds: number; steps: string[]; chapters: Chapter[]; materials: Material[];
};

/** Linhas cruas lidas para o painel de métricas. */
export type MetricsSource = {
  profiles: { id: string; full_name: string | null; company: string | null; is_admin: boolean; last_track_id: string | null; created_at: string }[];
  progress: { user_id: string; lesson_id: string; completed_at: string }[];
  attempts: { user_id: string; module_id: string; score: number; total: number; created_at: string }[];
  certs: { user_id: string; track_id: string; issued_at: string }[];
  pendingQuestions: number;
};

export type StudentRow = {
  id: string; name: string; company: string | null; joined: string;
  lessons: number; certs: number; currentTrack: string | null; lastActive: string | null;
};
export type TrackRow = { id: string; name: string; published: boolean; total: number; started: number; certified: number; avgPct: number };
export type QuizRow = { moduleId: string; trackName: string; moduleTitle: string; students: number; attempts: number; passRate: number; firstTryRate: number };
export type DropRow = { trackName: string; lessonTitle: string; reached: number; previous: number };
