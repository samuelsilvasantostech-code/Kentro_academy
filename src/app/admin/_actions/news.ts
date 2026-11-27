"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/require-admin";
import { logDbError } from "@/lib/admin/db-error";
import { GENERIC_ERROR, done, fail, fields, type FormState } from "@/lib/admin/form-state";
import { moveId, parseCheckbox, parseDirection, parseHttpUrl, parseUuid, text } from "@/lib/admin/validate";

/**
 * Cria ou edita uma novidade.
 * FormData: id (vazio = criar), title, description (opcional), href (opcional; http(s) ou "/caminho"; vazio = "em breve"),
 * published ("on" = publicada).
 */
export async function saveNews(_prev: FormState, form: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const rawId = String(form.get("id") ?? "").trim();
  const f = fields();
  const id = rawId ? f.get("id", parseUuid(rawId)) : undefined;
  const title = f.get("title", text(form.get("title"), { min: 2, max: 120 }));
  const description = f.get("description", text(form.get("description"), { max: 500 }));
  const rawHref = String(form.get("href") ?? "").trim();
  const href = rawHref ? f.get("href", parseHttpUrl(rawHref, { allowRelative: true })) : null;
  if (f.failed) return fail("Confira os campos destacados.", form, f.errors);

  const row = { title, description: description || null, href, published: parseCheckbox(form.get("published")) };
  if (id) {
    const { data, error } = await supabase.from("news").update(row).eq("id", id).select("id");
    if (error) {
      logDbError("saveNews.update", error);
      return fail(GENERIC_ERROR, form);
    }
    if (!data?.length) return fail("Novidade não encontrada.", form);
    revalidatePath("/", "layout");
    return done("Novidade salva.", id);
  }
  const { data: last } = await supabase.from("news").select("position").order("position", { ascending: false }).limit(1);
  const { data, error } = await supabase.from("news").insert({ ...row, position: (last?.[0]?.position ?? 0) + 1 }).select("id").single();
  if (error) {
    logDbError("saveNews.insert", error);
    return fail(GENERIC_ERROR, form);
  }
  revalidatePath("/", "layout");
  return done("Novidade criada.", data.id as string);
}

export async function deleteNews(id: string): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const uuid = parseUuid(id);
  if (!uuid.ok) return { ok: false, message: uuid.error };
  const { error } = await supabase.from("news").delete().eq("id", uuid.value);
  if (error) {
    logDbError("deleteNews", error);
    return { ok: false, message: GENERIC_ERROR };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Novidade excluída." };
}

export async function moveNews(id: string, dir: string): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const uuid = parseUuid(id);
  const d = parseDirection(dir);
  if (!uuid.ok || !d.ok) return { ok: false, message: "Não foi possível concluir. Recarregue a página e tente de novo." };
  const { data, error } = await supabase.from("news").select("id").order("position").order("id");
  if (error) {
    logDbError("moveNews.read", error);
    return { ok: false, message: GENERIC_ERROR };
  }
  const next = moveId((data ?? []).map((r) => r.id as string), uuid.value, d.value);
  if (!next) return { ok: true };
  const { error: e2 } = await supabase.rpc("admin_reorder_news", { p_ids: next });
  if (e2) {
    logDbError("moveNews.rpc", e2);
    return { ok: false, message: GENERIC_ERROR };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
