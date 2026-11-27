import * as sb from "../supabase/aluno/search";
import * as pg from "../pg/aluno";
import { pick } from "../pg/sql";
import type { Hit } from "@/lib/search";

const { loadPublishedTexts, searchLessonsRpc } = pick(sb, pg);

/** Busca no banco. Null = indisponível (migração 0009 ausente): use a busca em memória. */
export const searchLessons = (q: string, words: string[]): Promise<Hit[] | null> => searchLessonsRpc(q, words);
/** Textos publicados das aulas (de `ids`, ou de todas). */
export const getPublishedTexts = (ids?: string[]): Promise<Map<string, string>> => loadPublishedTexts(ids);
