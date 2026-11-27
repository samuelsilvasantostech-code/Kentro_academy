"use server";

import { catalogChanged } from "@/lib/admin/revalidate";
import {
  deleteLesson as dbDeleteLesson, findLessonByYoutube, getModuleLessonIds, linkLesson as dbLinkLesson, reorderLessonsInModule,
  requireAdmin, saveLesson as dbSaveLesson, saveLessonKeyPoints, saveLessonText, saveLessonTranscript,
  setLessonPublished as dbSetLessonPublished, unlinkLesson as dbUnlinkLesson,
} from "@/lib/db/admin";
import { logDbError, isUnique } from "@/lib/admin/db-error";
import { GENERIC_ERROR, done, fail, fields, type FormState } from "@/lib/admin/form-state";
import {
  moveId, parseChapters, parseDirection, parseDuration, parseLessonId, parseLines, parseMaterials,
  parseUuid, parseYouTubeId, text,
} from "@/lib/admin/validate";

/**
 * Cria ou edita uma aula (atômico, via RPC admin_save_lesson).
 * FormData:
 *   id            vazio = criar (nasce RASCUNHO, no fim do módulo); preenchido = editar
 *   youtube       link do YouTube ou ID de 11 caracteres; vazio = aula sem vídeo
 *   duration      "m:ss" ou "h:mm:ss" (obrigatório quando há vídeo; ignorado sem vídeo)
 *   title         2 a 160 caracteres
 *   summary       opcional, até 2000
 *   steps         "Faça agora no seu Kentro": um passo por linha
 *   key_points    pontos-chave, um por linha, até 8 (só vem no form com a migração 0007; ausente = não mexe)
 *   body_md       texto da aula em markdown simples, até 30000 (só vem no form com a migração 0008; ausente = não mexe)
 *   body_pub      "on" = texto publicado para os alunos; ausente = rascunho
 *   transcript    transcrição só para a busca, até 200000 (só vem no form com a migração 0009; ausente = não mexe, vazio = apaga)
 *   chapters      uma linha por capítulo: "mm:ss Título"
 *   materials     uma linha por material: "Título | https://link | descrição opcional"
 *   module_id     uuid do módulo (obrigatório só na criação; na edição use linkLesson/unlinkLesson)
 * (track_id pode ir no form para a tela filtrar os módulos, mas o servidor ignora.)
 * Vídeo já cadastrado em outra aula: erro no campo "youtube" com id e título da aula existente.
 * A aula só aparece para o aluno depois de setLessonPublished(id, true).
 */
export async function saveLesson(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const rawId = String(form.get("id") ?? "").trim();
  const f = fields();
  const id = rawId ? f.get("id", parseLessonId(rawId)) : undefined;
  const moduleId = rawId ? undefined : f.get("module_id", parseUuid(form.get("module_id")));

  const rawYoutube = String(form.get("youtube") ?? "").trim();
  const youtubeId = rawYoutube ? f.get("youtube", parseYouTubeId(rawYoutube)) : null;
  const duration = youtubeId ? f.get("duration", parseDuration(form.get("duration"))) : 0;
  const title = f.get("title", text(form.get("title"), { min: 2, max: 160 }));
  const summary = f.get("summary", text(form.get("summary"), { max: 2000 }));
  const steps = f.get("steps", parseLines(form.get("steps"), { max: 20, maxLen: 300 }));
  const keyPoints = form.has("key_points") ? f.get("key_points", parseLines(form.get("key_points"), { max: 8, maxLen: 200 })) : undefined;
  const body = form.has("body_md") ? f.get("body_md", text(form.get("body_md"), { max: 30000 })) : undefined;
  const transcript = form.has("transcript") ? f.get("transcript", text(form.get("transcript"), { max: 200000 })) : undefined;
  const chapters = f.get("chapters", parseChapters(form.get("chapters")));
  const materials = f.get("materials", parseMaterials(form.get("materials")));
  if (f.failed) return fail("Confira os campos destacados.", form, f.errors);

  if (youtubeId) {
    const dup = await findLessonByYoutube(admin, youtubeId);
    if (dup && dup.id !== id)
      return fail("Esse vídeo já está cadastrado.", form, {
        youtube: `Esse vídeo já está na aula “${dup.title}” (id ${dup.id}).`,
      });
  }

  const { id: savedId, error } = await dbSaveLesson(admin, id ?? null, moduleId ?? null, {
    youtube_id: youtubeId ?? null, title: title!, summary: summary!, duration_seconds: duration!, steps: steps!, chapters: chapters!, materials: materials!,
  });
  if (error) {
    if (isUnique(error)) return fail("Esse vídeo já está cadastrado.", form, { youtube: "Esse vídeo já está em outra aula." });
    logDbError("saveLesson", error);
    if (error.code === "P0002") return fail("Aula ou módulo não encontrado.", form);
    if (error.code === "23503") return fail("Módulo não encontrado.", form);
    return fail(GENERIC_ERROR, form);
  }
  const lessonId = savedId as string;
  if (keyPoints) {
    // Fora da RPC para não depender da versão dela; a aula já foi salva, então uma falha aqui só avisa.
    const kpErr = await saveLessonKeyPoints(admin, lessonId, keyPoints);
    if (kpErr) {
      logDbError("saveLesson.key_points", kpErr);
      catalogChanged();
      return done("Aula salva, mas os pontos-chave não foram gravados. Abra a aula e salve de novo.", lessonId);
    }
  }
  if (body !== undefined) {
    const txErr = await saveLessonText(admin, lessonId, body, form.get("body_pub") === "on");
    if (txErr) {
      logDbError("saveLesson.text", txErr);
      catalogChanged();
      return done("Aula salva, mas o texto não foi gravado. Abra a aula e salve de novo.", lessonId);
    }
  }
  if (transcript !== undefined) {
    const trErr = await saveLessonTranscript(admin, lessonId, transcript);
    if (trErr) {
      logDbError("saveLesson.transcript", trErr);
      catalogChanged();
      return done("Aula salva, mas a transcrição não foi gravada. Abra a aula e salve de novo.", lessonId);
    }
  }
  catalogChanged();
  return done(id ? "Aula salva." : "Aula criada como rascunho. Publique quando estiver pronta.", lessonId);
}

/** Publica (true) ou volta para rascunho (false). */
export async function setLessonPublished(id: string, published: boolean): Promise<FormState> {
  const admin = await requireAdmin();
  const lessonId = parseLessonId(id);
  if (!lessonId.ok || typeof published !== "boolean") return { ok: false, message: "Não foi possível concluir. Recarregue a página e tente de novo." };
  const { found, error } = await dbSetLessonPublished(admin, lessonId.value, published);
  if (error) {
    logDbError("setLessonPublished", error);
    return { ok: false, message: GENERIC_ERROR };
  }
  if (!found) return { ok: false, message: "Aula não encontrada." };
  catalogChanged();
  return { ok: true, message: published ? "Aula publicada." : "Aula voltou para rascunho." };
}

/** Apaga a aula em todas as trilhas, com o progresso, anotações e dúvidas dos alunos nela. A tela deve confirmar. */
export async function deleteLesson(id: string): Promise<FormState> {
  const admin = await requireAdmin();
  const lessonId = parseLessonId(id);
  if (!lessonId.ok) return { ok: false, message: lessonId.error };
  const error = await dbDeleteLesson(admin, lessonId.value);
  if (error) {
    logDbError("deleteLesson", error);
    return { ok: false, message: GENERIC_ERROR };
  }
  catalogChanged();
  return { ok: true, message: "Aula excluída." };
}

/** Coloca uma aula existente no fim de outro módulo (a mesma aula pode estar em várias trilhas). */
export async function linkLesson(lessonId: string, moduleId: string): Promise<FormState> {
  const admin = await requireAdmin();
  const l = parseLessonId(lessonId);
  const m = parseUuid(moduleId);
  if (!l.ok || !m.ok) return { ok: false, message: "Não foi possível concluir. Recarregue a página e tente de novo." };
  const error = await dbLinkLesson(admin, l.value, m.value);
  if (error) {
    logDbError("linkLesson", error);
    return { ok: false, message: error.code === "23503" ? "Aula ou módulo não encontrado." : GENERIC_ERROR };
  }
  catalogChanged();
  return { ok: true, message: "Aula vinculada ao módulo." };
}

/** Tira a aula de um módulo (a aula continua existindo e nos outros módulos). */
export async function unlinkLesson(lessonId: string, moduleId: string): Promise<FormState> {
  const admin = await requireAdmin();
  const l = parseLessonId(lessonId);
  const m = parseUuid(moduleId);
  if (!l.ok || !m.ok) return { ok: false, message: "Não foi possível concluir. Recarregue a página e tente de novo." };
  const error = await dbUnlinkLesson(admin, l.value, m.value);
  if (error) {
    logDbError("unlinkLesson", error);
    return { ok: false, message: GENERIC_ERROR };
  }
  catalogChanged();
  return { ok: true, message: "Aula desvinculada do módulo." };
}

export async function moveLessonInModule(moduleId: string, lessonId: string, dir: string): Promise<FormState> {
  const admin = await requireAdmin();
  const m = parseUuid(moduleId);
  const l = parseLessonId(lessonId);
  const d = parseDirection(dir);
  if (!m.ok || !l.ok || !d.ok) return { ok: false, message: "Não foi possível concluir. Recarregue a página e tente de novo." };
  const { ids, error } = await getModuleLessonIds(admin, m.value);
  if (error) {
    logDbError("moveLessonInModule.read", error);
    return { ok: false, message: GENERIC_ERROR };
  }
  const next = moveId(ids, l.value, d.value);
  if (!next) return { ok: true };
  const e2 = await reorderLessonsInModule(admin, m.value, next);
  if (e2) {
    logDbError("moveLessonInModule.rpc", e2);
    return { ok: false, message: GENERIC_ERROR };
  }
  catalogChanged();
  return { ok: true };
}
