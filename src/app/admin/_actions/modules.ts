"use server";

import { catalogChanged } from "@/lib/admin/revalidate";
import {
  createModule, deleteModule as dbDeleteModule, getTrackIdOfModule, getTrackModuleIds, renameModule, reorderModules, requireAdmin,
} from "@/lib/db/admin";
import { logDbError } from "@/lib/admin/db-error";
import { GENERIC_ERROR, done, fail, fields, type FormState } from "@/lib/admin/form-state";
import { moveId, parseDirection, parseSlug, parseUuid, text } from "@/lib/admin/validate";

/**
 * Cria ou edita um módulo.
 * FormData: id (vazio = criar), track_id (slug da trilha; só na criação), title.
 */
export async function saveModule(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const rawId = String(form.get("id") ?? "").trim();
  const f = fields();
  const id = rawId ? f.get("id", parseUuid(rawId)) : undefined;
  const title = f.get("title", text(form.get("title"), { min: 2, max: 120 }));
  const trackId = rawId ? undefined : f.get("track_id", parseSlug(form.get("track_id")));
  if (f.failed) return fail("Confira os campos destacados.", form, f.errors);

  if (id) {
    const { found, error } = await renameModule(admin, id, title!);
    if (error) {
      logDbError("saveModule.update", error);
      return fail(GENERIC_ERROR, form);
    }
    if (!found) return fail("Módulo não encontrado.", form);
    catalogChanged();
    return done("Módulo salvo.", id);
  }
  const { id: newId, error } = await createModule(admin, trackId!, title!);
  if (error) {
    logDbError("saveModule.insert", error);
    return fail(error.code === "23503" ? "Trilha não encontrada." : GENERIC_ERROR, form);
  }
  catalogChanged();
  return done("Módulo criado.", newId as string);
}

/** Apaga o módulo, o quiz dele e as tentativas de quiz dos alunos (as aulas continuam existindo). */
export async function deleteModule(id: string): Promise<FormState> {
  const admin = await requireAdmin();
  const uuid = parseUuid(id);
  if (!uuid.ok) return { ok: false, message: uuid.error };
  const error = await dbDeleteModule(admin, uuid.value);
  if (error) {
    logDbError("deleteModule", error);
    return { ok: false, message: GENERIC_ERROR };
  }
  catalogChanged();
  return { ok: true, message: "Módulo excluído." };
}

export async function moveModule(id: string, dir: string): Promise<FormState> {
  const admin = await requireAdmin();
  const uuid = parseUuid(id);
  const d = parseDirection(dir);
  if (!uuid.ok || !d.ok) return { ok: false, message: "Não foi possível concluir. Recarregue a página e tente de novo." };
  const trackId = await getTrackIdOfModule(admin, uuid.value);
  if (!trackId) return { ok: false, message: "Módulo não encontrado." };
  const { ids, error } = await getTrackModuleIds(admin, trackId);
  if (error) {
    logDbError("moveModule.read", error);
    return { ok: false, message: GENERIC_ERROR };
  }
  const next = moveId(ids, uuid.value, d.value);
  if (!next) return { ok: true };
  const e2 = await reorderModules(admin, trackId, next);
  if (e2) {
    logDbError("moveModule.rpc", e2);
    return { ok: false, message: GENERIC_ERROR };
  }
  catalogChanged();
  return { ok: true };
}
