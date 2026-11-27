"use server";

import { catalogChanged } from "@/lib/admin/revalidate";
import { requireAdmin } from "@/lib/admin/require-admin";
import { logDbError } from "@/lib/admin/db-error";
import { GENERIC_ERROR, done, fail, fields, type FormState } from "@/lib/admin/form-state";
import { moveId, parseDirection, parseSlug, parseUuid, text } from "@/lib/admin/validate";

/**
 * Cria ou edita um módulo.
 * FormData: id (vazio = criar), track_id (slug da trilha; só na criação), title.
 */
export async function saveModule(_prev: FormState, form: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const rawId = String(form.get("id") ?? "").trim();
  const f = fields();
  const id = rawId ? f.get("id", parseUuid(rawId)) : undefined;
  const title = f.get("title", text(form.get("title"), { min: 2, max: 120 }));
  const trackId = rawId ? undefined : f.get("track_id", parseSlug(form.get("track_id")));
  if (f.failed) return fail("Confira os campos destacados.", form, f.errors);

  if (id) {
    const { data, error } = await supabase.from("modules").update({ title }).eq("id", id).select("id");
    if (error) {
      logDbError("saveModule.update", error);
      return fail(GENERIC_ERROR, form);
    }
    if (!data?.length) return fail("Módulo não encontrado.", form);
    catalogChanged();
    return done("Módulo salvo.", id);
  }
  const { data: last } = await supabase.from("modules").select("position").eq("track_id", trackId!).order("position", { ascending: false }).limit(1);
  const { data, error } = await supabase
    .from("modules")
    .insert({ track_id: trackId, title, position: (last?.[0]?.position ?? 0) + 1 })
    .select("id")
    .single();
  if (error) {
    logDbError("saveModule.insert", error);
    return fail(error.code === "23503" ? "Trilha não encontrada." : GENERIC_ERROR, form);
  }
  catalogChanged();
  return done("Módulo criado.", data.id as string);
}

/** Apaga o módulo, o quiz dele e as tentativas de quiz dos alunos (as aulas continuam existindo). */
export async function deleteModule(id: string): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const uuid = parseUuid(id);
  if (!uuid.ok) return { ok: false, message: uuid.error };
  const { error } = await supabase.from("modules").delete().eq("id", uuid.value);
  if (error) {
    logDbError("deleteModule", error);
    return { ok: false, message: GENERIC_ERROR };
  }
  catalogChanged();
  return { ok: true, message: "Módulo excluído." };
}

export async function moveModule(id: string, dir: string): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const uuid = parseUuid(id);
  const d = parseDirection(dir);
  if (!uuid.ok || !d.ok) return { ok: false, message: "Não foi possível concluir. Recarregue a página e tente de novo." };
  const { data: me } = await supabase.from("modules").select("track_id").eq("id", uuid.value).maybeSingle();
  if (!me) return { ok: false, message: "Módulo não encontrado." };
  const { data, error } = await supabase.from("modules").select("id").eq("track_id", me.track_id).order("position").order("id");
  if (error) {
    logDbError("moveModule.read", error);
    return { ok: false, message: GENERIC_ERROR };
  }
  const next = moveId((data ?? []).map((r) => r.id as string), uuid.value, d.value);
  if (!next) return { ok: true };
  const { error: e2 } = await supabase.rpc("admin_reorder_modules", { p_track: me.track_id, p_ids: next });
  if (e2) {
    logDbError("moveModule.rpc", e2);
    return { ok: false, message: GENERIC_ERROR };
  }
  catalogChanged();
  return { ok: true };
}
