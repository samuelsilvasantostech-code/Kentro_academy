import { unstable_cache } from "next/cache";
import { createClient } from "../client";
import { CATALOG_TAG } from "../../types";
import type { Lesson, Track } from "../../aluno/types";

type Client = Awaited<ReturnType<typeof createClient>>;

type Row = Omit<Track, "modules"> & {
  modules: { id: string; title: string; position: number; module_lessons: { position: number; lessons: Lesson & { published: boolean } }[] }[];
};

/**
 * `studentView` = só trilhas publicadas (filtro na própria consulta, sem depender do RLS).
 * Sem ele (pré-visualização do admin) as trilhas em rascunho também vêm.
 * Aula em rascunho nunca entra no catálogo (nem no do admin: ele edita pelo /admin).
 */
async function load(supabase: Client, studentView: boolean): Promise<Track[]> {
  let query = supabase.from("tracks").select("*, modules(id, title, position, module_lessons(position, lessons(*)))");
  if (studentView) query = query.eq("published", true);
  const { data, error } = await query.order("position");
  if (error) throw error;
  return (data as Row[]).map(({ modules, ...t }) => ({
    ...t,
    modules: modules
      .sort((a, b) => a.position - b.position)
      .map((m) => ({
        id: m.id,
        title: m.title,
        position: m.position,
        lessons: m.module_lessons
          .filter((ml) => ml.lessons.published)
          .sort((a, b) => a.position - b.position)
          .map((ml) => ml.lessons),
      })),
  }));
}

/**
 * Catálogo dos alunos, guardado entre pedidos: não depende de quem pede (só trilhas e aulas publicadas),
 * então uma cópia serve para todos. A consulta usa a sessão de quem pediu primeiro (o catálogo exige login;
 * sem chave de serviço). Vale até o admin publicar algo (updateTag(CATALOG_TAG)) ou, no máximo, 5 min.
 */
export async function loadStudentCatalog(): Promise<Track[]> {
  const supabase = await createClient();
  return unstable_cache(() => load(supabase, true), ["catalogo-aluno-v1"], { tags: [CATALOG_TAG], revalidate: 300 })();
}

/** Catálogo para o admin navegando como aluno: lê direto do banco, inclusive trilhas em rascunho. Nunca vai para o cache dos alunos. */
export async function loadPreviewCatalog(): Promise<Track[]> {
  return load(await createClient(), false);
}
