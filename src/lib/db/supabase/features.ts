import { createClient } from "./client";

async function tableExists(table: string, column: string): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.from(table).select(column).limit(1);
  return !error;
}

export const probeLearningFeatures = () => tableExists("video_progress", "lesson_id");
export const probeTranscripts = () => tableExists("lesson_transcripts", "lesson_id");
export const probeLessonTexts = () => tableExists("lesson_texts", "lesson_id");
