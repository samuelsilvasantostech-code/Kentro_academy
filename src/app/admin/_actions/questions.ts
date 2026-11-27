"use server";

import { revalidatePath } from "next/cache";
import { answerQuestionRow, requireAdmin } from "@/lib/db/admin";
import { logDbError } from "@/lib/admin/db-error";
import { GENERIC_ERROR, done, fail, fields, type FormState } from "@/lib/admin/form-state";
import { parseUuid, text } from "@/lib/admin/validate";

/**
 * Responde (ou corrige a resposta de) uma dúvida de aluno.
 * FormData: id (uuid da dúvida), answer (1 a 4000 caracteres).
 * Grava answer, answered_at, answered_by e zera answer_seen_at (o aluno vê o destaque "nova resposta").
 */
export async function answerQuestion(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const f = fields();
  const id = f.get("id", parseUuid(form.get("id")));
  const answer = f.get("answer", text(form.get("answer"), { min: 1, max: 4000 }));
  if (f.failed) return fail("Escreva a resposta.", form, f.errors);

  const { found, error } = await answerQuestionRow(admin, id!, answer!, admin.user.id);
  if (error) {
    logDbError("answerQuestion", error);
    return fail(GENERIC_ERROR, form);
  }
  if (!found) return fail("Dúvida não encontrada.", form);
  revalidatePath("/", "layout");
  return done("Resposta enviada.", id);
}
