"use server";

import { catalogChanged } from "@/lib/admin/revalidate";
import { createTrack, deleteTrack as dbDeleteTrack, getTrackIds, reorderTracks, requireAdmin, updateTrack } from "@/lib/db/admin";
import { logDbError, isUnique } from "@/lib/admin/db-error";
import { GENERIC_ERROR, done, fail, fields, type FormState } from "@/lib/admin/form-state";
import { moveId, parseCheckbox, parseDirection, parseHexColor, parseLines, parseSlug, text } from "@/lib/admin/validate";

/**
 * Cria ou edita uma trilha.
 * FormData: original_id (vazio = criar), id (slug; imutável na edição), name, audience, icon, color (#RRGGBB),
 * pitch, outcomes (uma por linha), published ("on" = publicada).
 */
export async function saveTrack(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const originalId = String(form.get("original_id") ?? "").trim();
  const f = fields();
  const slug = f.get("id", parseSlug(originalId || form.get("id")));
  const name = f.get("name", text(form.get("name"), { min: 2, max: 80 }));
  const audience = f.get("audience", text(form.get("audience"), { max: 200 }));
  const icon = f.get("icon", text(form.get("icon"), { min: 1, max: 16 }));
  const color = f.get("color", parseHexColor(form.get("color")));
  const pitch = f.get("pitch", text(form.get("pitch"), { max: 600 }));
  const outcomes = f.get("outcomes", parseLines(form.get("outcomes"), { max: 12, maxLen: 200 }));
  if (f.failed) return fail("Confira os campos destacados.", form, f.errors);

  const row = {
    name: name!, audience: audience!, icon: icon!, color: color!, pitch: pitch!, outcomes: outcomes!,
    published: parseCheckbox(form.get("published")),
  };
  if (originalId) {
    const { found, error } = await updateTrack(admin, slug!, row);
    if (error) {
      logDbError("saveTrack.update", error);
      return fail(GENERIC_ERROR, form);
    }
    if (!found) return fail("Trilha não encontrada.", form);
  } else {
    const error = await createTrack(admin, slug!, row);
    if (error) {
      if (isUnique(error)) return fail("Escolha outro endereço para a trilha.", form, { id: "Esse endereço já está em uso" });
      logDbError("saveTrack.insert", error);
      return fail(GENERIC_ERROR, form);
    }
  }
  catalogChanged();
  return done("Trilha salva.", slug);
}

/** Apaga a trilha e seus módulos (as aulas continuam existindo, só perdem o vínculo). */
export async function deleteTrack(id: string): Promise<FormState> {
  const admin = await requireAdmin();
  const slug = parseSlug(id);
  if (!slug.ok) return { ok: false, message: slug.error };
  const error = await dbDeleteTrack(admin, slug.value);
  if (error) {
    logDbError("deleteTrack", error);
    return { ok: false, message: GENERIC_ERROR };
  }
  catalogChanged();
  return { ok: true, message: "Trilha excluída." };
}

export async function moveTrack(id: string, dir: string): Promise<FormState> {
  const admin = await requireAdmin();
  const slug = parseSlug(id);
  const d = parseDirection(dir);
  if (!slug.ok || !d.ok) return { ok: false, message: "Não foi possível concluir. Recarregue a página e tente de novo." };
  const { ids, error } = await getTrackIds(admin);
  if (error) {
    logDbError("moveTrack.read", error);
    return { ok: false, message: GENERIC_ERROR };
  }
  const next = moveId(ids, slug.value, d.value);
  if (!next) return { ok: true };
  const e2 = await reorderTracks(admin, next);
  if (e2) {
    logDbError("moveTrack.rpc", e2);
    return { ok: false, message: GENERIC_ERROR };
  }
  catalogChanged();
  return { ok: true };
}
