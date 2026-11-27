export type Lesson = {
  id: string;
  youtube_id: string | null;
  title: string;
  duration_seconds: number;
  summary: string | null;
  steps: string[];
};
export type Module = { id: string; title: string; position: number; lessons: Lesson[] };
export type Track = {
  id: string;
  name: string;
  audience: string;
  icon: string;
  color: string;
  pitch: string;
  outcomes: string[];
  position: number;
  modules: Module[];
};

export type Profile = {
  id: string;
  full_name: string;
  company: string | null;
  role_track: string | null;
  experience: string | null;
  is_admin: boolean;
  last_track_id: string | null;
  last_lesson_id: string | null;
};

/** Dados brutos do aluno, como vêm do armazenamento. */
export type StudentState = {
  profile: Profile;
  doneLessonIds: string[];
  quizAttempts: { module_id: string; score: number; total: number }[];
};

export type Me = {
  user: { id: string; email: string };
  profile: Profile;
  done: Set<string>;
  quizDone: Set<string>;
  /** Módulos com tentativa aprovada (mesma regra do banco: nota >= 70%). */
  quizPassed: Set<string>;
};

export type Chapter = { start_seconds: number; title: string };
export type MaterialItem = { id: string; title: string; description: string | null; url: string };
export type Note = { id: string; body: string; lesson_id: string; created_at: string };
export type LessonNote = { id: string; body: string; created_at: string };
export type LessonQuestion = {
  id: string; body: string; answer: string | null; created_at: string; answered_at: string | null; answer_seen_at: string | null;
};
export type UnseenAnswer = { id: string; lesson_id: string; body: string; answered_at: string | null };
export type NewsItem = { id: string; title: string; description: string | null; href: string | null };

export type LessonPage = {
  chapters: Chapter[];
  materials: MaterialItem[];
  notes: LessonNote[];
  questions: LessonQuestion[];
  /** Módulos da trilha que têm quiz. */
  quizModuleIds: Set<string>;
  keyPoints: string[];
  /** Onde o aluno parou no vídeo (s), se a migração 0007 existir e houver registro. */
  serverAt: number | null;
  /** Texto da aula. `draft` só é true na pré-visualização do admin. */
  article: { md: string; draft: boolean } | null;
};

/** Pergunta do quiz como o aluno enxerga: nunca traz `correct` nem `explanation`. */
export type QuizQuestionView = { question: string; options: string[] };
export type QuizForStudent = {
  questions: QuizQuestionView[];
  /** Aula para rever em cada pergunta (vazio se a migração 0007 não existir). */
  review: (string | null)[];
};

export type QuizResult = {
  score: number;
  total: number;
  passed: boolean;
  /** Acerto por questão. */
  results: boolean[];
  /** Só vêm quando passed = true. */
  correct?: number[];
  explanations?: string[];
  /** Só vem quando o banco recusou por tentativa seguida (too_fast). */
  tooFast?: true;
};

export type Completion = { completed: boolean; completed_at: string | null };

export type TrackStatus = {
  /** Existe linha em track_certificates: o certificado é do aluno para sempre. */
  certified: boolean;
  /** Data da primeira conclusão (issued_at). */
  issuedAt: string | null;
  /** A trilha, do jeito que está hoje, está concluída (regra de track_completion). */
  completed: boolean;
  /** Tem certificado, mas a trilha ganhou conteúdo que o aluno ainda não fez. */
  hasNew: boolean;
};
