"use server";

import { revalidatePath } from "next/cache";
import { createNews, deleteNews as dbDeleteNews, getNewsIds, reorderNews, requireAdmin, updateNews } from "@/lib/db/admin";
import { logDbError } from "@/lib/admin/db-error";
import { GENERIC_ERROR, done, fail, fields, type FormState } from "@/lib/admin/form-state";
import { moveId, parseCheckbox, parseDirection, parseHttpUrl, parseUuid, text } from "@/lib/admin/validate";

/**
 * Cria ou edita uma novidade.
 * FormData: id (vazio = criar), title, description (opcional), href (opcional; http(s) ou "/caminho"; vazio = "em breve"),
 * published ("on" = publicada).
 */
export async function saveNews(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const rawId = String(form.get("id") ?? "").trim();
  const f = fields();
  const id = rawId ? f.get("id", parseUuid(rawId)) : undefined;
  const title = f.get("title", text(form.get("title"), { min: 2, max: 120 }));
  const description = f.get("description", text(form.get("description"), { max: 500 }));
  const rawHref = String(form.get("href") ?? "").trim();
  const href = rawHref ? f.get("href", parseHttpUrl(rawHref, { allowRelative: true })) : null;
  if (f.failed) return fail("Confira os campos destacados.", form, f.errors);

  const row = { title: title!, description: description || null, href: href ?? null, published: parseCheckbox(form.get("published")) };
  if (id) {
    const { found, error } = await updateNews(admin, id, row);
    if (error) {
      logDbError("saveNews.update", error);
      return fail(GENERIC_ERROR, form);
    }
    if (!found) return fail("Novidade não encontrada.", form);
    revalidatePath("/", "layout");
    return done("Novidade salva.", id);
  }
  const { id: newId, error } = await createNews(admin, row);
  if (error) {
    logDbError("saveNews.insert", error);
    return fail(GENERIC_ERROR, form);
  }
  revalidatePath("/", "layout");
  return done("Novidade criada.", newId as string);
}

export async function deleteNews(id: string): Promise<FormState> {
  const admin = await requireAdmin();
  const uuid = parseUuid(id);
  if (!uuid.ok) return { ok: false, message: uuid.error };
  const error = await dbDeleteNews(admin, uuid.value);
  if (error) {
    logDbError("deleteNews", error);
    return { ok: false, message: GENERIC_ERROR };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Novidade excluída." };
}

export async function moveNews(id: string, dir: string): Promise<FormState> {
  const admin = await requireAdmin();
  const uuid = parseUuid(id);
  const d = parseDirection(dir);
  if (!uuid.ok || !d.ok) return { ok: false, message: "Não foi possível concluir. Recarregue a página e tente de novo." };
  const { ids, error } = await getNewsIds(admin);
  if (error) {
    logDbError("moveNews.read", error);
    return { ok: false, message: GENERIC_ERROR };
  }
  const next = moveId(ids, uuid.value, d.value);
  if (!next) return { ok: true };
  const e2 = await reorderNews(admin, next);
  if (e2) {
    logDbError("moveNews.rpc", e2);
    return { ok: false, message: GENERIC_ERROR };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
